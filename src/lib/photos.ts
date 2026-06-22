/**
 * Photo storage — 4-host replicate-everywhere pipeline.
 *
 * Per `knowledge/runbooks/free-hosting-providers/image-cdn.md`, we compress
 * once on the client (canvas → WebP/JPEG, max 2048px long edge), then fan out
 * to four uncorrelated free hosts:
 *
 *   1. Cloudinary       (unsigned upload preset, returns secure_url)
 *   2. ImageKit         (server-signed via Pages Function /api/sign-imagekit)
 *   3. imgbb            (POST base64 to https://api.imgbb.com/1/upload)
 *   4. GitHub Releases  (POST asset to a monthly release, deduped by sha256)
 *
 * Persisted shape (per entry):
 *   photos: Array<{
 *     id, urls: { cloudinary?, imagekit?, imgbb?, ghRelease? },
 *     width?, height?, bytes?, sha256?, createdAt
 *   }>
 *
 * Read strategy: first-200-wins HEAD race. ImageKit preferred when present
 * (unlimited transforms + generous bandwidth), Cloudinary second, then imgbb,
 * then GitHub Releases as cold-storage rail.
 *
 * Backward compatibility: legacy entries persisted to Firebase Storage are
 * still readable via `readPhotoUrl` because the function accepts the legacy
 * `{ url: string }` shape too.
 */

// ---------------------------------------------------------------------------
//  Types
// ---------------------------------------------------------------------------

export interface PhotoUrls {
  cloudinary?: string
  imagekit?: string
  imgbb?: string
  ghRelease?: string
}

export interface Photo {
  id: string
  urls: PhotoUrls
  width?: number
  height?: number
  bytes?: number
  sha256?: string
  createdAt: number
}

/** Legacy single-URL shape from the Firebase-Storage era. */
export type LegacyPhoto = { url: string }

// ---------------------------------------------------------------------------
//  Env helpers
// ---------------------------------------------------------------------------

function env(key: string): string | undefined {
  // Vite / Astro client-time
  const v = (import.meta as { env?: Record<string, string | undefined> }).env?.[key]
  if (v) return v
  // Node build-time fallback (used by migration script + Pages Function)
  if (typeof process !== 'undefined' && process.env && process.env[key]) return process.env[key]
  return undefined
}

// ---------------------------------------------------------------------------
//  Optimisation — canvas resize + WebP encode w/ JPEG fallback
// ---------------------------------------------------------------------------

const MAX_EDGE = 2048
const WEBP_QUALITY = 0.82
const JPEG_QUALITY = 0.85

export async function optimizeImage(file: File): Promise<Blob> {
  // Decode to a bitmap.
  const bitmap = await createImageBitmap(file)
  const { width: w0, height: h0 } = bitmap
  const scale = Math.min(1, MAX_EDGE / Math.max(w0, h0))
  const w = Math.round(w0 * scale)
  const h = Math.round(h0 * scale)

  // Draw to OffscreenCanvas if available, else fall back to a DOM canvas.
  type Canvas = OffscreenCanvas | HTMLCanvasElement
  let canvas: Canvas
  if (typeof OffscreenCanvas !== 'undefined') {
    canvas = new OffscreenCanvas(w, h)
  } else {
    canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
  }
  const ctx = (canvas as HTMLCanvasElement).getContext('2d') as CanvasRenderingContext2D
  ctx.drawImage(bitmap, 0, 0, w, h)
  bitmap.close?.()

  // Prefer WebP. JPEG is the universal fallback.
  const toBlob = async (type: string, quality: number): Promise<Blob | null> => {
    if ('convertToBlob' in canvas) {
      try {
        return await (canvas as OffscreenCanvas).convertToBlob({ type, quality })
      } catch {
        return null
      }
    }
    return await new Promise((resolve) => {
      ;(canvas as HTMLCanvasElement).toBlob((b) => resolve(b), type, quality)
    })
  }
  const webp = await toBlob('image/webp', WEBP_QUALITY)
  if (webp && webp.size > 0 && webp.type === 'image/webp') return webp
  const jpeg = await toBlob('image/jpeg', JPEG_QUALITY)
  if (jpeg && jpeg.size > 0) return jpeg
  // Last-ditch: return the original file.
  return file
}

// ---------------------------------------------------------------------------
//  Hashing — sha256 of bytes (used for GH-Releases dedup + Photo.sha256)
// ---------------------------------------------------------------------------

async function sha256Hex(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer()
  const hash = await crypto.subtle.digest('SHA-256', buf)
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

// ---------------------------------------------------------------------------
//  Per-host upload functions — each returns the public URL, or null on fail.
// ---------------------------------------------------------------------------

export async function uploadToCloudinary(blob: Blob): Promise<string | null> {
  const name = env('PUBLIC_CLOUDINARY_CLOUD_NAME')
  const preset = env('PUBLIC_CLOUDINARY_UPLOAD_PRESET')
  if (!name || !preset) return null
  try {
    const fd = new FormData()
    fd.append('file', blob)
    fd.append('upload_preset', preset)
    const r = await fetch(`https://api.cloudinary.com/v1_1/${name}/image/upload`, {
      method: 'POST',
      body: fd,
    })
    if (!r.ok) return null
    const j = (await r.json()) as { secure_url?: string }
    return j.secure_url ?? null
  } catch (e) {
    console.warn('[photos] cloudinary upload failed', e)
    return null
  }
}

export async function uploadToImageKit(blob: Blob, fileName: string): Promise<string | null> {
  const publicKey = env('PUBLIC_IMAGEKIT_PUBLIC_KEY')
  const endpoint = env('PUBLIC_IMAGEKIT_URL_ENDPOINT')
  if (!publicKey || !endpoint) return null
  try {
    // 1. Get a signature from our Pages Function (server holds the private key).
    const sigRes = await fetch('/api/sign-imagekit', { method: 'POST' })
    if (!sigRes.ok) return null
    const sig = (await sigRes.json()) as {
      signature: string
      expire: number
      token: string
    }
    // 2. Upload directly to ImageKit with the short-lived signature.
    const fd = new FormData()
    fd.append('file', blob, fileName)
    fd.append('fileName', fileName)
    fd.append('publicKey', publicKey)
    fd.append('signature', sig.signature)
    fd.append('expire', String(sig.expire))
    fd.append('token', sig.token)
    const r = await fetch('https://upload.imagekit.io/api/v1/files/upload', {
      method: 'POST',
      body: fd,
    })
    if (!r.ok) return null
    const j = (await r.json()) as { url?: string }
    return j.url ?? null
  } catch (e) {
    console.warn('[photos] imagekit upload failed', e)
    return null
  }
}

export async function uploadToImgbb(blob: Blob): Promise<string | null> {
  const key = env('PUBLIC_IMGBB_API_KEY') ?? env('IMGBB_KEY')
  if (!key) return null
  try {
    // imgbb takes base64 in a form field.
    const b64 = await blobToBase64(blob)
    const fd = new FormData()
    fd.append('image', b64)
    const r = await fetch(`https://api.imgbb.com/1/upload?key=${encodeURIComponent(key)}`, {
      method: 'POST',
      body: fd,
    })
    if (!r.ok) return null
    const j = (await r.json()) as { data?: { url?: string } }
    return j.data?.url ?? null
  } catch (e) {
    console.warn('[photos] imgbb upload failed', e)
    return null
  }
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buf = new Uint8Array(await blob.arrayBuffer())
  // chunked binary→string to avoid call-stack blow-up
  let bin = ''
  const chunk = 0x8000
  for (let i = 0; i < buf.length; i += chunk) {
    bin += String.fromCharCode.apply(null, Array.from(buf.subarray(i, i + chunk)))
  }
  return btoa(bin)
}

export async function uploadToGhReleases(blob: Blob, sha256: string): Promise<string | null> {
  const repo = env('PUBLIC_GH_RELEASES_REPO') ?? env('GH_RELEASES_REPO')
  const token = env('GH_RELEASES_TOKEN')
  if (!repo || !token) return null
  try {
    // One release per month (per the runbook quirk: never one-release-per-image).
    const now = new Date()
    const tag = `images-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const assetName = `${sha256.slice(0, 16)}.bin`

    // Get or create the release.
    const getRes = await fetch(`https://api.github.com/repos/${repo}/releases/tags/${tag}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
    })
    let release: { id: number; upload_url: string } | null = null
    if (getRes.ok) {
      release = (await getRes.json()) as { id: number; upload_url: string }
    } else if (getRes.status === 404) {
      const createRes = await fetch(`https://api.github.com/repos/${repo}/releases`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tag_name: tag, name: tag, body: 'Auto-created by oriz-journal.' }),
      })
      if (!createRes.ok) return null
      release = (await createRes.json()) as { id: number; upload_url: string }
    } else {
      return null
    }

    // Upload the asset. upload_url is templated: ".../assets{?name,label}".
    const uploadBase = release.upload_url.replace('{?name,label}', '')
    const uploadUrl = `${uploadBase}?name=${encodeURIComponent(assetName)}`
    const upRes = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': blob.type || 'application/octet-stream',
      },
      body: blob,
    })
    if (!upRes.ok) {
      // 422 = asset already exists (sha-deduped by name) — that's a successful
      // dedup, recover the existing URL.
      if (upRes.status === 422) {
        return `https://github.com/${repo}/releases/download/${tag}/${assetName}`
      }
      return null
    }
    const j = (await upRes.json()) as { browser_download_url?: string }
    return j.browser_download_url ?? null
  } catch (e) {
    console.warn('[photos] gh-releases upload failed', e)
    return null
  }
}

// ---------------------------------------------------------------------------
//  Orchestrator — fan-out upload to all 4 hosts in parallel.
// ---------------------------------------------------------------------------

/**
 * Upload a photo to all four hosts. Requires at least two successful uploads
 * (so a single host failure never strands a photo behind one rail). Returns
 * a Photo record with whichever URLs landed.
 *
 * The legacy signature `uploadPhoto(uid, entryId, file): Promise<string>` is
 * preserved for TipTap's drop handler — call `uploadPhotoForEditor()` to get
 * `{ primaryUrl, photo }` together.
 */
export async function uploadPhoto(_uid: string, _entryId: string, file: File): Promise<string> {
  const out = await uploadPhotoForEditor(file)
  return out.primaryUrl
}

/**
 * Upload a photo and return both the primary display URL (for TipTap's
 * `<img src>`) and the full Photo record (to persist on the Entry).
 */
export async function uploadPhotoForEditor(
  file: File,
): Promise<{ primaryUrl: string; photo: Photo }> {
  const blob = await optimizeImage(file)
  const sha = await sha256Hex(blob)
  const ext = blob.type === 'image/webp' ? 'webp' : 'jpg'
  const fileName = `${sha.slice(0, 16)}.${ext}`

  const [ck, ik, ib, gh] = await Promise.allSettled([
    uploadToCloudinary(blob),
    uploadToImageKit(blob, fileName),
    uploadToImgbb(blob),
    uploadToGhReleases(blob, sha),
  ])
  const pick = (r: PromiseSettledResult<string | null>) =>
    r.status === 'fulfilled' && r.value ? r.value : undefined
  const urls: PhotoUrls = {
    cloudinary: pick(ck),
    imagekit: pick(ik),
    imgbb: pick(ib),
    ghRelease: pick(gh),
  }
  const okCount = Object.values(urls).filter(Boolean).length
  if (okCount < 2) {
    throw new Error(
      `photo upload failed — only ${okCount}/4 hosts succeeded (need >=2). Check env keys.`,
    )
  }

  // Primary URL preference: ImageKit > Cloudinary > imgbb > GH Releases.
  const primaryUrl = (urls.imagekit ?? urls.cloudinary ?? urls.imgbb ?? urls.ghRelease) as string

  const photo: Photo = {
    id: sha.slice(0, 24),
    urls,
    bytes: blob.size,
    sha256: sha,
    createdAt: Date.now(),
  }
  return { primaryUrl, photo }
}

// ---------------------------------------------------------------------------
//  Read — first-200-wins HEAD race.
// ---------------------------------------------------------------------------

/**
 * Return the first URL that responds 200 to a HEAD request, preferring
 * ImageKit > Cloudinary > imgbb > GH Releases. Accepts both the new Photo
 * shape and the legacy single-URL shape.
 */
export async function readPhotoUrl(photo: Photo | LegacyPhoto | string): Promise<string> {
  if (typeof photo === 'string') return photo
  if ('url' in photo && typeof photo.url === 'string') return photo.url
  // After the guards above, only the Photo shape remains.
  const p = photo as Photo
  const candidates = [
    p.urls.imagekit,
    p.urls.cloudinary,
    p.urls.imgbb,
    p.urls.ghRelease,
  ].filter(Boolean) as string[]
  if (!candidates.length) throw new Error('photo has no URLs')

  // Race HEAD requests; first 200 wins. If none respond, return the first
  // candidate so the <img> tag at least has something to try.
  return await new Promise<string>((resolve) => {
    let settled = false
    let remaining = candidates.length
    for (const url of candidates) {
      fetch(url, { method: 'HEAD' })
        .then((r) => {
          if (settled) return
          if (r.ok) {
            settled = true
            resolve(url)
          } else if (--remaining === 0) {
            settled = true
            resolve(candidates[0])
          }
        })
        .catch(() => {
          if (settled) return
          if (--remaining === 0) {
            settled = true
            resolve(candidates[0])
          }
        })
    }
  })
}

// ---------------------------------------------------------------------------
//  Delete — best-effort across all hosts; never throws.
// ---------------------------------------------------------------------------

export async function deletePhoto(photo: Photo | LegacyPhoto | string): Promise<void> {
  // Best-effort only. imgbb has no signed delete API at all. Cloudinary
  // unsigned upload presets can't be deleted from the browser without an
  // admin signature. ImageKit + GH-Releases deletes need server creds. We
  // don't fight that here — the storage hosts are cheap, and orphaned blobs
  // age out via host-side quotas. This function exists so callers can
  // signal intent for future server-side reaping.
  void photo
}
