/**
 * Memories — "on this day" 1y, 2y, 3y, 5y ago.
 */
import { useEffect, useMemo, useState } from 'react'
import { listEntries } from '~/lib/journalDb'
import EntryCard from './EntryCard'
import type { Entry } from '~/lib/types'

interface Props { uid: string }

export default function MemoriesView({ uid }: Props) {
  const [entries, setEntries] = useState<Entry[]>([])

  useEffect(() => { listEntries(uid, { limit: 1000 }).then(setEntries) }, [uid])

  const groups = useMemo(() => {
    const today = new Date()
    const md = today.toISOString().slice(5, 10) // MM-DD
    const targets = [1, 2, 3, 5]
    return targets.map((y) => {
      const year = today.getFullYear() - y
      const targetIso = `${year}-${md}`
      const exact = entries.filter((e) => e.entryDate === targetIso)
      // Loose match — same MM-DD any year ago specified
      const sameYear = entries.filter((e) => e.entryDate.startsWith(`${year}-`) && e.entryDate.slice(5) === md)
      return { years: y, label: `${y} year${y === 1 ? '' : 's'} ago — ${targetIso}`, entries: exact.length ? exact : sameYear }
    }).filter((g) => g.entries.length > 0)
  }, [entries])

  if (groups.length === 0) {
    return (
      <div className="mem-empty">
        <p>No memories yet for today’s date. Keep writing — entries will surface here in 1, 2, 3, and 5 years.</p>
        <style>{`.mem-empty { padding: 2rem; text-align: center; color: var(--color-fg-muted); background: var(--color-bg-soft); border: 1px dashed var(--color-border); border-radius: var(--radius-card); }`}</style>
      </div>
    )
  }

  return (
    <div className="mem">
      {groups.map((g) => (
        <section key={g.years} className="mem-group">
          <h2>{g.label}</h2>
          <div className="mem-grid">
            {g.entries.map((e) => <EntryCard key={e.id} entry={e} />)}
          </div>
        </section>
      ))}
      <style>{`
        .mem { display: flex; flex-direction: column; gap: 1.5rem; }
        .mem-group h2 { font-family: var(--font-serif); font-size: 1.125rem; margin: 0 0 0.5rem; font-weight: 600; }
        .mem-grid { display: grid; gap: 0.625rem; grid-template-columns: 1fr; }
        @media (min-width: 768px) { .mem-grid { grid-template-columns: repeat(2, 1fr); } }
      `}</style>
    </div>
  )
}
