/**
 * SettingsView — single React island for all of /settings except export/import
 * which have their own routes.
 */
import { useEffect, useState } from 'react'
import { getProfile, upsertProfile } from '~/lib/journalDb'
import { JOURNAL_TYPES, type JournalType, type UserProfile } from '~/lib/types'

interface Props { uid: string }

export default function SettingsView({ uid }: Props) {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [savedAt, setSavedAt] = useState<number | null>(null)

  useEffect(() => { getProfile(uid).then((p) => setProfile(p ?? {})) }, [uid])

  const update = async (patch: Partial<UserProfile>) => {
    const next = { ...(profile ?? {}), ...patch }
    setProfile(next)
    await upsertProfile(uid, patch)
    setSavedAt(Date.now())
  }

  if (!profile) return <p style={{ padding: '1.5rem', color: 'var(--color-fg-muted)' }}>Loading settings…</p>

  return (
    <div className="set">
      <section className="set-block">
        <h2>Profile</h2>
        <label className="set-row">
          <span>Display name</span>
          <input type="text" value={profile.displayName ?? ''} onChange={(e) => update({ displayName: e.target.value })} />
        </label>
        <label className="set-row">
          <span>Default template</span>
          <select value={profile.defaultJournalType ?? 'daily'} onChange={(e) => update({ defaultJournalType: e.target.value as JournalType })}>
            {JOURNAL_TYPES.map((t) => <option key={t.id} value={t.id}>{t.emoji} {t.label}</option>)}
          </select>
        </label>
        <label className="set-row">
          <span>Timezone</span>
          <input type="text" value={profile.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone} onChange={(e) => update({ timezone: e.target.value })} />
        </label>
      </section>

      <section className="set-block">
        <h2>Privacy</h2>
        <label className="set-row set-row-toggle">
          <input type="checkbox" checked={!!profile.weatherEnabled} onChange={(e) => update({ weatherEnabled: e.target.checked })} />
          <span>
            <strong>Stamp weather + coarse location</strong>
            <small>Uses your browser geolocation prompt + Open-Meteo. No third-party tracking.</small>
          </span>
        </label>
        <label className="set-row set-row-toggle">
          <input type="checkbox" checked={!!profile.e2eeEnabled} onChange={(e) => update({ e2eeEnabled: e.target.checked })} />
          <span>
            <strong>Encrypt entry bodies (E2EE) — experimental</strong>
            <small>Derives a key from your passphrase using libsodium. Only the entry body is encrypted; title/tags/mood/date stay plain. Search still works after decryption.</small>
          </span>
        </label>
      </section>

      <section className="set-block">
        <h2>Data</h2>
        <div className="set-actions">
          <a href="/settings/export" className="set-btn">Export…</a>
          <a href="/settings/import" className="set-btn">Import…</a>
          <a href="/settings/account" className="set-btn set-btn-danger">Delete account</a>
        </div>
      </section>

      {savedAt && <p className="set-saved">Saved {new Date(savedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>}

      <style>{`
        .set { display: flex; flex-direction: column; gap: 1.25rem; }
        .set-block { padding: 1rem 1.125rem; background: var(--color-bg-soft); border: 1px solid var(--color-border); border-radius: var(--radius-card); display: flex; flex-direction: column; gap: 0.625rem; }
        .set-block h2 { font-family: var(--font-serif); font-size: 1.0625rem; margin: 0 0 0.25rem; font-weight: 600; }
        .set-row { display: flex; gap: 1rem; align-items: center; flex-wrap: wrap; padding-block: 0.375rem; }
        .set-row > span:first-child { min-width: 160px; color: var(--color-fg-muted); font-size: 0.875rem; }
        .set-row input[type="text"], .set-row select {
          flex: 1; min-width: 200px; height: 36px; padding-inline: 0.625rem;
          background: var(--color-bg); border: 1px solid var(--color-border);
          border-radius: var(--radius-button); color: var(--color-fg); font: inherit; font-size: 0.875rem;
        }
        .set-row-toggle { align-items: flex-start; }
        .set-row-toggle input { margin-top: 0.25rem; }
        .set-row-toggle small { display: block; color: var(--color-fg-muted); font-size: 0.8125rem; margin-top: 0.125rem; line-height: 1.4; }
        .set-actions { display: flex; gap: 0.5rem; flex-wrap: wrap; }
        .set-btn { display: inline-flex; align-items: center; height: 36px; padding-inline: 0.875rem; background: var(--color-bg); border: 1px solid var(--color-border); border-radius: var(--radius-button); color: var(--color-fg); text-decoration: none; font-size: 0.8125rem; }
        .set-btn-danger { color: #ef4444; border-color: #ef4444; }
        .set-saved { font-size: 0.75rem; color: var(--color-fg-muted); }
      `}</style>
    </div>
  )
}
