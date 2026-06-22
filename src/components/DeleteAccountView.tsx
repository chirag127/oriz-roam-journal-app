/**
 * Account-deletion view at /settings/account. Writes a tombstone profile,
 * deletes all entries + tags + templates + goals + counters, then signs out.
 *
 * Photo blobs on Cloudinary / ImageKit / imgbb / GH Releases are NOT deleted
 * here — those hosts either lack a browser-accessible delete API (imgbb) or
 * require server-side admin creds (Cloudinary/ImageKit/GitHub). Orphaned
 * blobs age out via the hosts' own quota machinery. This is documented in
 * `knowledge/decisions/architecture/journal-photo-pipeline.md`.
 */

import { signOut } from 'firebase/auth'
import { collection, deleteDoc, doc, getDocs, setDoc } from 'firebase/firestore'
import { useState } from 'react'
import { auth, db } from '~/lib/firebase'
import { deletePhoto } from '~/lib/photos'
import type { PhotoRecord } from '~/lib/types'

interface Props {
  uid: string
}

export default function DeleteAccountView({ uid }: Props) {
  const [phrase, setPhrase] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const proceed = async () => {
    if (phrase !== 'DELETE MY JOURNAL') {
      setErr('Please type the phrase exactly.')
      return
    }
    setBusy(true)
    setErr(null)
    try {
      // 1) walk entries → best-effort delete photos (4-host + legacy URLs), then docs
      const entriesSnap = await getDocs(collection(db, `users/${uid}/entries`))
      for (const d of entriesSnap.docs) {
        const data = d.data() as { photoUrls?: string[]; photos?: PhotoRecord[] }
        for (const url of data.photoUrls || []) await deletePhoto(url).catch(() => {})
        for (const p of data.photos || []) await deletePhoto(p).catch(() => {})
        await deleteDoc(d.ref)
      }
      // 2) wipe templates, tags, goals, counters
      for (const sub of ['templates', 'tags', 'goals', 'counters']) {
        const snap = await getDocs(collection(db, `users/${uid}/${sub}`))
        for (const d of snap.docs) await deleteDoc(d.ref)
      }
      // 3) tombstone profile
      await setDoc(
        doc(db, `users/${uid}`),
        { displayName: '', email: '', updatedAt: Date.now() },
        { merge: true },
      )
      await deleteDoc(doc(db, `users/${uid}`))
      await signOut(auth)
      setDone(true)
    } catch (e) {
      console.error(e)
      setErr('Deletion failed — ' + (e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return (
      <div className="da-card">
        <h2>Done.</h2>
        <p>
          All your journal data has been deleted from this account. Your sign-in identity at
          auth.oriz.in still exists — visit <a href="/account/">/account/</a> to delete the account
          itself.
        </p>
      </div>
    )
  }

  return (
    <div className="da">
      <div className="da-card">
        <h2>Delete account data</h2>
        <p>
          This permanently deletes every journal entry, tag, template, goal, and counter on your
          account. <strong>Photo blobs replicated to Cloudinary, ImageKit, imgbb, and GitHub
          Releases are NOT deleted</strong> — those hosts lack browser-accessible delete APIs;
          orphaned images age out via host-side quotas. Your auth identity at{' '}
          <code>auth.oriz.in</code> is not deleted by this action either — that is a separate step
          at <a href="/account/">/account/</a>.
        </p>
        <p>
          To confirm, type <code>DELETE MY JOURNAL</code> below.
        </p>
        <input
          type="text"
          value={phrase}
          onChange={(e) => setPhrase(e.target.value)}
          placeholder="DELETE MY JOURNAL"
        />
        <div className="da-actions">
          <button
            type="button"
            disabled={busy || phrase !== 'DELETE MY JOURNAL'}
            onClick={proceed}
            className="da-go"
          >
            {busy ? 'Deleting…' : 'Delete everything'}
          </button>
          <a href="/settings" className="da-cancel">
            Cancel
          </a>
        </div>
        {err && <p className="da-err">{err}</p>}
      </div>
      <style>{`
        .da-card { padding: 1.25rem; background: var(--color-bg-soft); border: 1px solid #ef4444; border-radius: var(--radius-card); display: flex; flex-direction: column; gap: 0.625rem; }
        .da-card h2 { font-family: var(--font-serif); font-size: 1.25rem; font-weight: 600; margin: 0; color: #ef4444; }
        .da-card p { margin: 0; color: var(--color-fg-muted); line-height: 1.55; }
        .da-card input { padding: 0.5rem 0.625rem; background: var(--color-bg); border: 1px solid var(--color-border); border-radius: var(--radius-button); color: var(--color-fg); font: inherit; }
        .da-actions { display: flex; gap: 0.5rem; }
        .da-go { padding: 0.5rem 0.875rem; background: #ef4444; color: #fff; border: 1px solid #ef4444; border-radius: var(--radius-button); cursor: pointer; }
        .da-go:disabled { opacity: 0.5; cursor: not-allowed; }
        .da-cancel { display: inline-flex; align-items: center; padding: 0.5rem 0.875rem; background: transparent; color: var(--color-fg); border: 1px solid var(--color-border); border-radius: var(--radius-button); text-decoration: none; }
        .da-err { color: #ef4444; }
      `}</style>
    </div>
  )
}
