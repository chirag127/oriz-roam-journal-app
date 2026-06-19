/**
 * EntryList — generic listing surface used by /entries, /favorites, /pinned,
 * /tags/[tag]. Subscribes to entries (or fetches once depending on filter)
 * and renders EntryCard rows + a "New entry" CTA at the top.
 */
import { useEffect, useMemo, useState } from 'react'
import { listEntries } from '~/lib/journalDb'
import EntryCard from './EntryCard'
import type { Entry, JournalType, Mood } from '~/lib/types'
import { JOURNAL_TYPES, MOODS } from '~/lib/types'

interface Props {
  uid: string
  filter?: { favorite?: boolean; pinned?: boolean; tag?: string; journalType?: JournalType }
  emptyHint?: string
  showFilters?: boolean
}

export default function EntryList({ uid, filter, emptyHint, showFilters }: Props) {
  const [all, setAll] = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)
  const [moodFilter, setMoodFilter] = useState<Mood | ''>('')
  const [typeFilter, setTypeFilter] = useState<JournalType | ''>('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    listEntries(uid, { ...filter, limit: 500 }).then((rows) => {
      if (!cancelled) { setAll(rows); setLoading(false) }
    })
    return () => { cancelled = true }
  }, [uid, JSON.stringify(filter)]) // eslint-disable-line

  const filtered = useMemo(() => {
    return all.filter((e) =>
      (!moodFilter || e.mood === moodFilter) &&
      (!typeFilter || e.journalType === typeFilter),
    )
  }, [all, moodFilter, typeFilter])

  if (loading) return <p style={{ padding: '2rem', color: 'var(--color-fg-muted)' }}>Loading entries…</p>

  return (
    <div className="el">
      {showFilters && (
        <div className="el-filters">
          <select value={moodFilter} onChange={(e) => setMoodFilter(e.target.value as Mood | '')}>
            <option value="">All moods</option>
            {MOODS.map((m) => <option key={m.id} value={m.id}>{m.emoji} {m.label}</option>)}
          </select>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as JournalType | '')}>
            <option value="">All types</option>
            {JOURNAL_TYPES.map((t) => <option key={t.id} value={t.id}>{t.emoji} {t.label}</option>)}
          </select>
          <span className="el-count">{filtered.length} {filtered.length === 1 ? 'entry' : 'entries'}</span>
        </div>
      )}
      {filtered.length === 0 ? (
        <div className="el-empty">
          <p>{emptyHint ?? 'No entries yet.'}</p>
          <a href="/entries/new" className="el-cta">+ New entry</a>
        </div>
      ) : (
        <div className="el-grid">
          {filtered.map((e) => <EntryCard key={e.id} entry={e} />)}
        </div>
      )}
      <style>{`
        .el { display: flex; flex-direction: column; gap: 1rem; }
        .el-filters { display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; }
        .el-filters select { height: 36px; padding-inline: 0.625rem; background: var(--color-bg-soft); border: 1px solid var(--color-border); border-radius: var(--radius-button); color: var(--color-fg); font: inherit; font-size: 0.8125rem; }
        .el-count { margin-left: auto; color: var(--color-fg-muted); font-size: 0.8125rem; }
        .el-empty { padding: 2.5rem 1rem; text-align: center; background: var(--color-bg-soft); border: 1px dashed var(--color-border); border-radius: var(--radius-card); color: var(--color-fg-muted); }
        .el-empty p { margin: 0 0 0.875rem; }
        .el-cta { display: inline-flex; align-items: center; height: 38px; padding-inline: 1rem; border-radius: var(--radius-button); background: var(--color-accent); color: var(--color-accent-fg); text-decoration: none; font-weight: 500; }
        .el-grid { display: grid; gap: 0.625rem; grid-template-columns: 1fr; }
        @media (min-width: 768px) { .el-grid { grid-template-columns: repeat(2, 1fr); } }
      `}</style>
    </div>
  )
}
