/**
 * DashboardView — landing for /dashboard. Shows: today's entry CTA (or
 * the existing today entry), streak gauge, recent entries.
 */
import { useEffect, useState } from 'react'
import { listEntries, getStreak, recomputeStreak, todayIso } from '~/lib/journalDb'
import EntryCard from './EntryCard'
import type { Entry, StreakCounter } from '~/lib/types'

interface Props { uid: string; isAnonymous: boolean }

export default function DashboardView({ uid, isAnonymous }: Props) {
  const [entries, setEntries] = useState<Entry[]>([])
  const [streak, setStreak] = useState<StreakCounter | null>(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([listEntries(uid, { limit: 10 }), getStreak(uid)]).then(([rows, s]) => {
      if (cancelled) return
      setEntries(rows); setStreak(s)
      recomputeStreak(uid).then((s2) => !cancelled && setStreak(s2)).catch(() => {})
    })
    return () => { cancelled = true }
  }, [uid])

  const today = todayIso()
  const todayEntry = entries.find((e) => e.entryDate === today)

  return (
    <div className="db">
      {isAnonymous && (
        <div className="db-anon">
          You are signed in anonymously. <a href="/account/">Link an account</a> from /account to sync your entries across devices.
        </div>
      )}

      <section className="db-today">
        <h2>{today}</h2>
        {todayEntry ? (
          <>
            <p>You already wrote today.</p>
            <div className="db-today-actions">
              <a href={`/entries/${todayEntry.id}`} className="db-btn">Read</a>
              <a href={`/entries/${todayEntry.id}/edit`} className="db-btn db-btn-primary">Continue editing</a>
            </div>
          </>
        ) : (
          <>
            <p>No entry yet for today.</p>
            <div className="db-today-actions">
              <a href="/entries/new" className="db-btn db-btn-primary">+ New entry</a>
              <a href="/templates" className="db-btn">Pick a template</a>
            </div>
          </>
        )}
      </section>

      <section className="db-streak">
        <Stat label="Streak" value={streak?.current ?? 0} suffix="days" />
        <Stat label="Longest" value={streak?.longest ?? 0} suffix="days" />
        <Stat label="Total" value={streak?.totalEntries ?? entries.length} suffix="entries" />
        <Stat label="Words" value={streak?.totalWords ?? 0} />
      </section>

      <section className="db-recent">
        <div className="db-h">
          <h2>Recent</h2>
          <a href="/entries">See all →</a>
        </div>
        {entries.length === 0 ? (
          <p className="db-empty">Welcome. Start with a <a href="/entries/new">first entry</a> or <a href="/templates">browse the templates</a>.</p>
        ) : (
          <div className="db-grid">{entries.slice(0, 6).map((e) => <EntryCard key={e.id} entry={e} />)}</div>
        )}
      </section>

      <style>{`
        .db { display: flex; flex-direction: column; gap: 1.25rem; }
        .db-anon { padding: 0.625rem 0.875rem; background: color-mix(in oklab, var(--color-accent) 15%, transparent); border: 1px solid color-mix(in oklab, var(--color-accent) 40%, transparent); border-radius: var(--radius-button); font-size: 0.875rem; color: var(--color-fg); }
        .db-today { padding: 1.25rem; background: var(--color-bg-soft); border: 1px solid var(--color-border); border-radius: var(--radius-card); }
        .db-today h2 { margin: 0 0 0.375rem; font-family: var(--font-serif); font-size: 1.5rem; font-weight: 600; }
        .db-today p { margin: 0 0 0.875rem; color: var(--color-fg-muted); }
        .db-today-actions { display: flex; gap: 0.5rem; flex-wrap: wrap; }
        .db-btn { display: inline-flex; align-items: center; height: 38px; padding-inline: 1rem; background: var(--color-bg); border: 1px solid var(--color-border); border-radius: var(--radius-button); color: var(--color-fg); text-decoration: none; font-size: 0.875rem; font-weight: 500; }
        .db-btn-primary { background: var(--color-accent); color: var(--color-accent-fg); border-color: var(--color-accent); }
        .db-streak { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 0.5rem; }
        .db-recent .db-h { display: flex; align-items: baseline; gap: 1rem; margin-bottom: 0.625rem; }
        .db-recent .db-h h2 { font-family: var(--font-serif); font-size: 1.0625rem; margin: 0; font-weight: 600; }
        .db-recent .db-h a { margin-left: auto; color: var(--color-fg-muted); text-decoration: none; font-size: 0.8125rem; }
        .db-empty { color: var(--color-fg-muted); padding: 1.5rem; text-align: center; background: var(--color-bg-soft); border: 1px dashed var(--color-border); border-radius: var(--radius-card); }
        .db-grid { display: grid; gap: 0.625rem; grid-template-columns: 1fr; }
        @media (min-width: 768px) { .db-grid { grid-template-columns: repeat(2, 1fr); } }
      `}</style>
    </div>
  )
}

function Stat({ label, value, suffix }: { label: string; value: number; suffix?: string }) {
  return (
    <div className="stat">
      <span>{label}</span>
      <strong>{value.toLocaleString()}{suffix && <small> {suffix}</small>}</strong>
      <style>{`
        .stat { padding: 0.875rem 1rem; background: var(--color-bg-soft); border: 1px solid var(--color-border); border-radius: var(--radius-card); display: flex; flex-direction: column; gap: 0.125rem; }
        .stat span { font-size: 0.6875rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--color-fg-muted); }
        .stat strong { font-family: var(--font-serif); font-size: 1.5rem; font-weight: 600; line-height: 1; }
        .stat small { font-size: 0.75rem; color: var(--color-fg-muted); font-weight: 400; }
      `}</style>
    </div>
  )
}
