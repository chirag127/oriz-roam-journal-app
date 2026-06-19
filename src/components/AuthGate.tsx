/**
 * AuthGate — guards a React subtree. If not signed in, renders an
 * inline prompt linking to /account/. Optionally signs the user in
 * anonymously so they can try the app immediately.
 */
import { useState } from 'react'
import { signInAnonymously } from 'firebase/auth'
import { auth } from '~/lib/firebase'
import { useAuthUser } from '~/lib/useAuthUser'

interface Props {
  children: (uid: string, isAnonymous: boolean) => React.ReactNode
  allowAnonymous?: boolean
}

export default function AuthGate({ children, allowAnonymous = true }: Props) {
  const { user, loading } = useAuthUser()
  const [busy, setBusy] = useState(false)

  if (loading) return <p className="auth-gate-loading">Loading…</p>

  if (!user) {
    return (
      <div className="auth-gate">
        <div className="auth-gate-card">
          <h2>Sign in to continue</h2>
          <p>Your journal entries are tied to your account so they follow you across every <code>*.oriz.in</code> site.</p>
          <div className="auth-gate-actions">
            <a href="/account/" className="btn-primary">Open sign-in</a>
            {allowAnonymous && (
              <button
                type="button"
                className="btn-ghost"
                disabled={busy}
                onClick={async () => {
                  setBusy(true)
                  try { await signInAnonymously(auth) } finally { setBusy(false) }
                }}
              >
                {busy ? 'Starting…' : 'Try without signing up'}
              </button>
            )}
          </div>
          {allowAnonymous && (
            <p className="auth-gate-fine">
              Anonymous sessions stay on this device. Sign in later from <a href="/account/">Account</a> to link them.
            </p>
          )}
        </div>
        <style>{`
          .auth-gate { padding: 3rem 1rem; display: grid; place-items: center; }
          .auth-gate-card { max-width: 460px; padding: 2rem; background: var(--color-bg-soft); border: 1px solid var(--color-border); border-radius: var(--radius-card); }
          .auth-gate-card h2 { margin: 0 0 0.5rem; font-family: var(--font-serif); font-size: 1.375rem; font-weight: 600; }
          .auth-gate-card p { color: var(--color-fg-muted); margin: 0 0 1rem; line-height: 1.6; }
          .auth-gate-actions { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 0.75rem; }
          .btn-primary, .btn-ghost {
            display: inline-flex; align-items: center; height: 40px; padding-inline: 1rem;
            border-radius: var(--radius-button); font-size: 0.875rem; font-weight: 500;
            text-decoration: none; cursor: pointer; border: 1px solid var(--color-border);
          }
          .btn-primary { background: var(--color-accent); color: var(--color-accent-fg); border-color: var(--color-accent); }
          .btn-ghost { background: transparent; color: var(--color-fg); }
          .auth-gate-fine { font-size: 0.75rem; color: var(--color-fg-muted); margin: 0; }
          .auth-gate-loading { padding: 3rem; text-align: center; color: var(--color-fg-muted); }
        `}</style>
      </div>
    )
  }

  return <>{children(user.uid, user.isAnonymous)}</>
}
