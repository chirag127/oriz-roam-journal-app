/**
 * EntryCard — shared list row for /entries, /favorites, /pinned, /tags/[tag].
 * Hyperlinked block with title, date, mood pill, tags, snippet, word count.
 */
import type { Entry } from '~/lib/types'
import { MOODS, JOURNAL_TYPES } from '~/lib/types'

interface Props {
  entry: Entry
  href?: string
}

export default function EntryCard({ entry, href }: Props) {
  const m = entry.mood ? MOODS.find((x) => x.id === entry.mood) : null
  const t = JOURNAL_TYPES.find((x) => x.id === entry.journalType)
  const snippet = (entry.body || '').replace(/[#*_>`-]/g, '').slice(0, 200)
  return (
    <a className="ec" href={href ?? `/entries/${entry.id}`}>
      <div className="ec-head">
        <span className="ec-jt" aria-hidden="true">{t?.emoji} {t?.label}</span>
        <time className="ec-date">{entry.entryDate}</time>
        {entry.pinned && <span className="ec-pin" title="Pinned">📌</span>}
        {entry.favorite && <span className="ec-fav" title="Favorite">❤️</span>}
      </div>
      <h3 className="ec-title">{entry.title || 'Untitled entry'}</h3>
      {snippet && <p className="ec-snippet">{snippet}</p>}
      <div className="ec-foot">
        {m && <span className="ec-mood" style={{ borderColor: m.color, color: m.color }}>{m.emoji} {m.label}</span>}
        {entry.tags?.slice(0, 4).map((tag) => <span key={tag} className="ec-tag">#{tag}</span>)}
        {entry.tags?.length > 4 && <span className="ec-tag">+{entry.tags.length - 4}</span>}
        <span className="ec-words">{entry.wordCount || 0} words</span>
      </div>
      <style>{`
        .ec { display: flex; flex-direction: column; gap: 0.375rem; padding: 1rem 1.125rem; background: var(--color-bg-soft); border: 1px solid var(--color-border); border-radius: var(--radius-card); color: var(--color-fg); text-decoration: none; transition: border-color 120ms; }
        .ec:hover { border-color: color-mix(in oklab, var(--color-accent) 60%, var(--color-border)); }
        .ec-head { display: flex; gap: 0.5rem; align-items: center; font-size: 0.75rem; color: var(--color-fg-muted); }
        .ec-jt { font-weight: 500; }
        .ec-date { margin-left: auto; font-variant-numeric: tabular-nums; }
        .ec-title { font-family: var(--font-serif); font-size: 1.125rem; font-weight: 600; margin: 0; line-height: 1.3; }
        .ec-snippet { font-size: 0.875rem; color: var(--color-fg-muted); margin: 0; line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .ec-foot { display: flex; flex-wrap: wrap; gap: 0.375rem; align-items: center; font-size: 0.75rem; color: var(--color-fg-muted); }
        .ec-mood { padding: 0.125rem 0.5rem; border: 1px solid; border-radius: 9999px; }
        .ec-tag { padding: 0.125rem 0.5rem; background: var(--color-bg-muted); border-radius: 9999px; }
        .ec-words { margin-left: auto; }
      `}</style>
    </a>
  )
}
