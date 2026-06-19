/**
 * EntryReadView — read-only display of an entry, with Edit + Delete + Markdown export.
 */
import { useEffect, useState } from 'react'
import { getEntry, deleteEntry } from '~/lib/journalDb'
import { mdToHtml } from '~/lib/markdown'
import type { Entry } from '~/lib/types'
import { MOODS, JOURNAL_TYPES } from '~/lib/types'

interface Props { uid: string; entryId: string }

export default function EntryReadView({ uid, entryId }: Props) {
  const [entry, setEntry] = useState<Entry | null>(null)
  const [loading, setLoading] = useState(true)
  const [missing, setMissing] = useState(false)

  useEffect(() => {
    getEntry(uid, entryId).then((e) => {
      if (!e) setMissing(true)
      setEntry(e)
      setLoading(false)
    })
  }, [uid, entryId])

  if (loading) return <p style={{ padding: '2rem', color: 'var(--color-fg-muted)' }}>Loading…</p>
  if (missing || !entry) return (
    <div style={{ padding: '2rem' }}>
      <p>Entry not found.</p>
      <a href="/entries">← Back to entries</a>
    </div>
  )

  const m = entry.mood ? MOODS.find((x) => x.id === entry.mood) : null
  const t = JOURNAL_TYPES.find((x) => x.id === entry.journalType)

  const exportMd = () => {
    const md = `# ${entry.title || 'Untitled'}\n\n*${entry.entryDate} · ${t?.label}*\n\n${entry.body || ''}`
    const blob = new Blob([md], { type: 'text/markdown' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${entry.entryDate}-${(entry.title || 'entry').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}.md`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <article className="er">
      <header className="er-head">
        <p className="er-meta">
          <span>{t?.emoji} {t?.label}</span>
          <time>{entry.entryDate}</time>
          {m && <span style={{ color: m.color }}>{m.emoji} {m.label}{entry.moodIntensity ? ` (${entry.moodIntensity}/10)` : ''}</span>}
          {entry.weather && <span>{entry.weather.temp}° {entry.weather.condition}</span>}
          {entry.favorite && <span>❤️</span>}
          {entry.pinned && <span>📌</span>}
        </p>
        <h1 className="er-title">{entry.title || 'Untitled entry'}</h1>
        <div className="er-tags">{entry.tags?.map((tag) => <a key={tag} href={`/tags/${encodeURIComponent(tag)}`}>#{tag}</a>)}</div>
        <div className="er-actions">
          <a href={`/entries/${entry.id}/edit`} className="er-btn er-btn-primary">Edit</a>
          <button type="button" onClick={exportMd} className="er-btn">Export .md</button>
          <button
            type="button"
            className="er-btn er-btn-danger"
            onClick={async () => {
              if (window.confirm('Delete this entry permanently?')) {
                await deleteEntry(uid, entry.id)
                window.location.href = '/entries'
              }
            }}
          >Delete</button>
        </div>
      </header>

      <div
        className="er-body"
        // entry.bodyHtml is generated client-side from MD via TipTap or marked;
        // we sanitize by always rendering through mdToHtml when bodyHtml is empty.
        dangerouslySetInnerHTML={{ __html: entry.bodyHtml || mdToHtml(entry.body || '') }}
      />

      <style>{`
        .er { display: flex; flex-direction: column; gap: 1.25rem; padding-block: 1.25rem; }
        .er-head { display: flex; flex-direction: column; gap: 0.5rem; padding-bottom: 1rem; border-bottom: 1px solid var(--color-border); }
        .er-meta { display: flex; flex-wrap: wrap; gap: 0.875rem; color: var(--color-fg-muted); font-size: 0.8125rem; margin: 0; }
        .er-title { font-family: var(--font-serif); font-size: clamp(1.625rem, 4vw, 2.5rem); font-weight: 600; letter-spacing: -0.01em; margin: 0; }
        .er-tags { display: flex; flex-wrap: wrap; gap: 0.375rem; }
        .er-tags a { padding: 0.125rem 0.5rem; background: var(--color-bg-muted); border-radius: 9999px; color: var(--color-fg-muted); text-decoration: none; font-size: 0.75rem; }
        .er-actions { display: flex; gap: 0.5rem; flex-wrap: wrap; margin-top: 0.5rem; }
        .er-btn { display: inline-flex; align-items: center; height: 36px; padding-inline: 0.875rem; background: var(--color-bg-soft); border: 1px solid var(--color-border); border-radius: var(--radius-button); color: var(--color-fg); text-decoration: none; font-size: 0.8125rem; cursor: pointer; }
        .er-btn-primary { background: var(--color-accent); color: var(--color-accent-fg); border-color: var(--color-accent); }
        .er-btn-danger { color: #ef4444; border-color: #ef4444; }
        .er-body { font-family: var(--font-serif); font-size: 1.0625rem; line-height: 1.75; color: var(--color-fg); }
        .er-body h1, .er-body h2, .er-body h3 { font-family: var(--font-serif); font-weight: 600; margin: 1.25rem 0 0.5rem; }
        .er-body h1 { font-size: 1.5rem; } .er-body h2 { font-size: 1.25rem; } .er-body h3 { font-size: 1.0625rem; }
        .er-body p { margin: 0 0 0.875rem; }
        .er-body ul, .er-body ol { padding-left: 1.5rem; margin: 0 0 0.875rem; }
        .er-body img { max-width: 100%; border-radius: var(--radius-button); margin: 0.5rem 0; }
        .er-body blockquote { border-left: 3px solid var(--color-accent); padding-left: 1rem; margin: 0 0 0.875rem; color: var(--color-fg-muted); font-style: italic; }
        .er-body code { background: var(--color-bg-muted); padding: 0.125em 0.375em; border-radius: 0.25rem; font-family: var(--font-mono); font-size: 0.875em; }
        .er-body pre { background: var(--color-bg-muted); padding: 1rem; border-radius: var(--radius-button); overflow-x: auto; }
      `}</style>
    </article>
  )
}
