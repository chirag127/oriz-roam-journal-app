/**
 * SearchView — Fuse.js full-text over the user's entries with mood/tag/date filters.
 * Mounted at /search. Also opened by ⌘K from anywhere via SearchOverlay.
 */
import { useEffect, useMemo, useState } from 'react'
import Fuse from 'fuse.js'
import { listEntries } from '~/lib/journalDb'
import EntryCard from './EntryCard'
import type { Entry, Mood } from '~/lib/types'
import { MOODS } from '~/lib/types'

interface Props { uid: string; initialQuery?: string }

export default function SearchView({ uid, initialQuery = '' }: Props) {
  const [entries, setEntries] = useState<Entry[]>([])
  const [q, setQ] = useState(initialQuery)
  const [mood, setMood] = useState<Mood | ''>('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [tag, setTag] = useState('')

  useEffect(() => { listEntries(uid, { limit: 1000 }).then(setEntries) }, [uid])

  const fuse = useMemo(() => new Fuse(entries, {
    keys: ['title', 'body', 'tags'],
    includeScore: true,
    threshold: 0.4,
    ignoreLocation: true,
  }), [entries])

  const results = useMemo(() => {
    let pool: Entry[] = q.trim() ? fuse.search(q.trim()).map((r) => r.item) : entries
    if (mood) pool = pool.filter((e) => e.mood === mood)
    if (tag) pool = pool.filter((e) => e.tags?.includes(tag.replace(/^#/, '').toLowerCase()))
    if (from) pool = pool.filter((e) => e.entryDate >= from)
    if (to) pool = pool.filter((e) => e.entryDate <= to)
    return pool.slice(0, 200)
  }, [q, mood, tag, from, to, entries, fuse])

  return (
    <div className="sv">
      <input
        autoFocus type="search" value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search your journal…" className="sv-q"
      />
      <div className="sv-filters">
        <select value={mood} onChange={(e) => setMood(e.target.value as Mood | '')}>
          <option value="">Any mood</option>
          {MOODS.map((m) => <option key={m.id} value={m.id}>{m.emoji} {m.label}</option>)}
        </select>
        <input type="text" placeholder="#tag" value={tag} onChange={(e) => setTag(e.target.value)} />
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From" />
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="To" />
        <span className="sv-count">{results.length} result{results.length === 1 ? '' : 's'}</span>
      </div>
      <div className="sv-grid">
        {results.map((e) => <EntryCard key={e.id} entry={e} />)}
      </div>
      <style>{`
        .sv { display: flex; flex-direction: column; gap: 0.75rem; }
        .sv-q { width: 100%; height: 48px; padding-inline: 1rem; background: var(--color-bg-soft); border: 1px solid var(--color-border); border-radius: var(--radius-card); color: var(--color-fg); font: inherit; font-size: 1rem; }
        .sv-q:focus { outline: 2px solid var(--color-accent); outline-offset: 1px; }
        .sv-filters { display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: center; }
        .sv-filters select, .sv-filters input { height: 36px; padding-inline: 0.625rem; background: var(--color-bg-soft); border: 1px solid var(--color-border); border-radius: var(--radius-button); color: var(--color-fg); font: inherit; font-size: 0.8125rem; }
        .sv-count { margin-left: auto; color: var(--color-fg-muted); font-size: 0.8125rem; }
        .sv-grid { display: grid; gap: 0.625rem; grid-template-columns: 1fr; }
        @media (min-width: 768px) { .sv-grid { grid-template-columns: repeat(2, 1fr); } }
      `}</style>
    </div>
  )
}
