#!/usr/bin/env node
/**
 * One-shot migration: re-replicate legacy Firebase-Storage photos to the 4
 * free hosts (Cloudinary + ImageKit + imgbb + GitHub Releases). Writes back
 * the `photos: PhotoRecord[]` field on each entry; keeps `photoUrls` intact
 * so old clients still render until they're forced to refresh.
 *
 * Run AFTER configuring keys in .env (see .env.example). DO NOT run blind —
 * it issues network requests against four external APIs and writes Firestore.
 *
 *   node scripts/migrate-photos-to-4-host.mjs --dry-run     # plan only
 *   node scripts/migrate-photos-to-4-host.mjs               # actually do it
 *   node scripts/migrate-photos-to-4-host.mjs --uid <uid>   # one user
 *
 * Requires: firebase-admin (npm i -D firebase-admin) and
 *   GOOGLE_APPLICATION_CREDENTIALS pointing at a service-account JSON.
 *
 * This script is intentionally not wired into package.json scripts — it's a
 * once-or-never operation.
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { Buffer } from 'node:buffer'
import { webcrypto as crypto } from 'node:crypto'

const args = process.argv.slice(2)
const DRY_RUN = args.includes('--dry-run')
const uidFilter = args.includes('--uid') ? args[args.indexOf('--uid') + 1] : null

// -------------------- env --------------------
const envPath = join(dirname(fileURLToPath(import.meta.url)), '..', '.env')
try {
  const txt = readFileSync(envPath, 'utf8')
  for (const line of txt.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
  }
} catch {
  console.warn('[migrate] no .env found at', envPath, '— relying on shell env')
}

const CLOUDINARY_NAME = process.env.PUBLIC_CLOUDINARY_CLOUD_NAME
const CLOUDINARY_PRESET = process.env.PUBLIC_CLOUDINARY_UPLOAD_PRESET
const IMAGEKIT_PUBLIC = process.env.PUBLIC_IMAGEKIT_PUBLIC_KEY
const IMAGEKIT_PRIVATE = process.env.IMAGEKIT_PRIVATE_KEY
const IMAGEKIT_ENDPOINT = process.env.PUBLIC_IMAGEKIT_URL_ENDPOINT
const IMGBB_KEY = process.env.PUBLIC_IMGBB_API_KEY || process.env.IMGBB_KEY
const GH_REPO = process.env.GH_RELEASES_REPO || process.env.PUBLIC_GH_RELEASES_REPO
const GH_TOKEN = process.env.GH_RELEASES_TOKEN

const need = { CLOUDINARY_NAME, CLOUDINARY_PRESET, IMAGEKIT_PUBLIC, IMAGEKIT_PRIVATE, IMAGEKIT_ENDPOINT, IMGBB_KEY, GH_REPO, GH_TOKEN }
const missing = Object.entries(need).filter(([, v]) => !v).map(([k]) => k)
if (missing.length) {
  console.error('[migrate] missing env keys:', missing.join(', '))
  if (!DRY_RUN) process.exit(1)
}

// -------------------- helpers --------------------
async function sha256Hex(buf) {
  const h = await crypto.subtle.digest('SHA-256', buf)
  return Buffer.from(h).toString('hex')
}

async function fetchBytes(url) {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`fetch ${url} → ${r.status}`)
  return Buffer.from(await r.arrayBuffer())
}

async function uploadCloudinary(buf, type) {
  const fd = new FormData()
  fd.append('file', new Blob([buf], { type }))
  fd.append('upload_preset', CLOUDINARY_PRESET)
  const r = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_NAME}/image/upload`, { method: 'POST', body: fd })
  if (!r.ok) return null
  return (await r.json()).secure_url || null
}

async function uploadImageKit(buf, type, name) {
  // Sign locally with the private key.
  const token = (crypto.randomUUID && crypto.randomUUID()) || Math.random().toString(36).slice(2)
  const expire = Math.floor(Date.now() / 1000) + 600
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', enc.encode(IMAGEKIT_PRIVATE), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign'])
  const sig = Buffer.from(await crypto.subtle.sign('HMAC', key, enc.encode(token + expire))).toString('hex')
  const fd = new FormData()
  fd.append('file', new Blob([buf], { type }), name)
  fd.append('fileName', name)
  fd.append('publicKey', IMAGEKIT_PUBLIC)
  fd.append('signature', sig)
  fd.append('expire', String(expire))
  fd.append('token', token)
  const r = await fetch('https://upload.imagekit.io/api/v1/files/upload', { method: 'POST', body: fd })
  if (!r.ok) return null
  return (await r.json()).url || null
}

async function uploadImgbb(buf) {
  const b64 = buf.toString('base64')
  const fd = new FormData()
  fd.append('image', b64)
  const r = await fetch(`https://api.imgbb.com/1/upload?key=${encodeURIComponent(IMGBB_KEY)}`, { method: 'POST', body: fd })
  if (!r.ok) return null
  return (await r.json()).data?.url || null
}

async function uploadGh(buf, sha, type) {
  const tag = `images-${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
  const name = `${sha.slice(0, 16)}.bin`
  const auth = { Authorization: `Bearer ${GH_TOKEN}`, Accept: 'application/vnd.github+json' }
  const get = await fetch(`https://api.github.com/repos/${GH_REPO}/releases/tags/${tag}`, { headers: auth })
  let rel
  if (get.ok) rel = await get.json()
  else {
    const create = await fetch(`https://api.github.com/repos/${GH_REPO}/releases`, {
      method: 'POST',
      headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ tag_name: tag, name: tag, body: 'migration' }),
    })
    if (!create.ok) return null
    rel = await create.json()
  }
  const base = rel.upload_url.replace('{?name,label}', '')
  const up = await fetch(`${base}?name=${encodeURIComponent(name)}`, {
    method: 'POST',
    headers: { ...auth, 'Content-Type': type || 'application/octet-stream' },
    body: buf,
  })
  if (up.status === 422) return `https://github.com/${GH_REPO}/releases/download/${tag}/${name}`
  if (!up.ok) return null
  return (await up.json()).browser_download_url || null
}

async function replicate(url) {
  const buf = await fetchBytes(url)
  const sha = await sha256Hex(buf)
  const type = url.match(/\.webp/) ? 'image/webp' : 'image/jpeg'
  const name = `${sha.slice(0, 16)}.${type === 'image/webp' ? 'webp' : 'jpg'}`
  const [c, ik, ib, gh] = await Promise.allSettled([
    uploadCloudinary(buf, type),
    uploadImageKit(buf, type, name),
    uploadImgbb(buf),
    uploadGh(buf, sha, type),
  ])
  const pick = (r) => (r.status === 'fulfilled' && r.value ? r.value : undefined)
  return {
    id: sha.slice(0, 24),
    urls: { cloudinary: pick(c), imagekit: pick(ik), imgbb: pick(ib), ghRelease: pick(gh) },
    bytes: buf.length,
    sha256: sha,
    createdAt: Date.now(),
  }
}

// -------------------- driver --------------------
async function main() {
  const { initializeApp, applicationDefault } = await import('firebase-admin/app')
  const { getFirestore } = await import('firebase-admin/firestore')

  initializeApp({ credential: applicationDefault() })
  const db = getFirestore()

  const usersSnap = await db.collection('users').get()
  let migrated = 0
  let skipped = 0
  for (const userDoc of usersSnap.docs) {
    if (uidFilter && userDoc.id !== uidFilter) continue
    const entries = await db.collection(`users/${userDoc.id}/entries`).get()
    for (const ent of entries.docs) {
      const data = ent.data()
      const legacyUrls = (data.photoUrls || []).filter(
        (u) => typeof u === 'string' && u.startsWith('https://firebasestorage.googleapis.com'),
      )
      if (!legacyUrls.length || (data.photos && data.photos.length >= legacyUrls.length)) {
        skipped += 1
        continue
      }
      console.log(`[migrate] ${userDoc.id}/${ent.id} → ${legacyUrls.length} photos`)
      if (DRY_RUN) {
        migrated += 1
        continue
      }
      const photos = []
      for (const url of legacyUrls) {
        try {
          const rec = await replicate(url)
          photos.push(rec)
        } catch (e) {
          console.warn(`  ! failed ${url}: ${e.message}`)
        }
      }
      if (photos.length) {
        await ent.ref.set({ photos, migratedAt: Date.now() }, { merge: true })
        migrated += 1
      }
    }
  }
  console.log(`[migrate] done — migrated=${migrated} skipped=${skipped} dry=${DRY_RUN}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
