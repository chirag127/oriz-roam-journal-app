/**
 * StatsView — counts, streaks, mood trend, top tags, journal-type distribution.
 * Uses recharts for the line + bar charts.
 */
import { useEffect, useMemo, useState } from 'react'
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, BarChart, Bar, PieChart, Pie, Cell, Legend } from 'recharts'
import { listEntries, getStreak, recomputeStreak } from '~/lib/journalDb'
import type { Entry, StreakCounter } from '~/lib/types'
import { MOODS, JOURNAL_TYPES } from '~/lib/types'

interface Props { uid: string }

const MOOD_VALUE: Record<string, number> = { great: 5, good: 4, neutral: 3, low: 2, bad: 1 }

export default function StatsView({ uid }: Props) {
  const [entries, setEntries] = useState<Entry[]>([])
  const [streak, setStreak] = useState<StreakCounter | null>(null)
  const [range, setRange] = useState<30 | 90 | 365>(30)

  useEffect(() => {
    let cancelled = false
    Promise.all([listEntries(uid, { limit: 1000 }), getStreak(uid)]).then(([rows, s]) => {
      if (cancelled) return
      setEntries(rows); setStreak(s)
      // background recompute
      recomputeStreak(uid).then((s2) => !cancelled && setStreak(s2)).catch(() => {})
    })
    return () => { cancelled = true }
  }, [uid])

  const moodTrend = useMemo(() => {
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - range)
    const daily: Record<string, { sum: number; n: number }> = {}
    for (const e of entries) {
      if (!e.mood) continue
      if (new Date(e.entryDate) < cutoff) continue
      const v = MOOD_VALUE[e.mood] || 3
      daily[e.entryDate] ??= { sum: 0, n: 0 }
      daily[e.entryDate].sum += v
      daily[e.entryDate].n += 1
    }
    return Object.entries(daily)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, { sum, n }]) => ({ date, mood: Number((sum / n).toFixed(2)) }))
  }, [entries, range])

  const topTags = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const e of entries) for (const t of e.tags || []) counts[t] = (counts[t] || 0) + 1
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([tag, count]) => ({ tag, count }))
  }, [entries])

  const typeDist = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const e of entries) counts[e.journalType] = (counts[e.journalType] || 0) + 1
    return JOURNAL_TYPES.map((t) => ({ name: t.label, value: counts[t.id] || 0, emoji: t.emoji })).filter((r) => r.value > 0)
  }, [entries])

  const PIE_COLORS = ['#f59e0b', '#10b981', '#0ea5e9', '#8b5cf6', '#f43f5e', '#84cc16', '#a78bfa', '#22d3ee', '#fb923c', '#94a3b8']

  return (
    <div className="sv">
      <div className="sv-cards">
        <Card label="Current streak" value={streak?.current ?? 0} suffix="days" />
        <Card label="Longest streak" value={streak?.longest ?? 0} suffix="days" />
        <Card label="Total entries" value={streak?.totalEntries ?? entries.length} />
        <Card label="Total words" value={streak?.totalWords ?? entries.reduce((s, e) => s + (e.wordCount || 0), 0)} />
      </div>

      <section className="sv-block">
        <div className="sv-block-h">
          <h2>Mood trend</h2>
          <div className="sv-range">
            {[30, 90, 365].map((r) => (
              <button key={r} type="button" className={range === r ? 'on' : ''} onClick={() => setRange(r as 30 | 90 | 365)}>{r}d</button>
            ))}
          </div>
        </div>
        <div className="sv-chart">
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={moodTrend} margin={{ left: 4, right: 8, top: 8, bottom: 0 }}>
              <XAxis dataKey="date" hide />
              <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} fontSize={11} stroke="var(--color-fg-muted)" />
              <Tooltip contentStyle={{ background: 'var(--color-bg-soft)', border: '1px solid var(--color-border)', fontSize: 12 }} />
              <Line type="monotone" dataKey="mood" stroke="var(--color-accent)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="sv-block">
        <h2>Top tags</h2>
        {topTags.length === 0 ? <p style={{ color: 'var(--color-fg-muted)' }}>No tags yet.</p> : (
          <div className="sv-chart">
            <ResponsiveContainer width="100%" height={Math.max(160, topTags.length * 22)}>
              <BarChart data={topTags} layout="vertical" margin={{ left: 8, right: 8 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="tag" width={120} fontSize={11} stroke="var(--color-fg-muted)" />
                <Tooltip contentStyle={{ background: 'var(--color-bg-soft)', border: '1px solid var(--color-border)', fontSize: 12 }} />
                <Bar dataKey="count" fill="var(--color-accent)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <section className="sv-block">
        <h2>Journal-type distribution</h2>
        {typeDist.length === 0 ? <p style={{ color: 'var(--color-fg-muted)' }}>No entries yet.</p> : (
          <div className="sv-chart">
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={typeDist} dataKey="value" nameKey="name" outerRadius={80} label>
                  {typeDist.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <style>{`
        .sv { display: flex; flex-direction: column; gap: 1.5rem; }
        .sv-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 0.625rem; }
        .sv-block { padding: 1rem 1.125rem; background: var(--color-bg-soft); border: 1px solid var(--color-border); border-radius: var(--radius-card); }
        .sv-block-h { display: flex; align-items: baseline; gap: 1rem; }
        .sv-block h2 { font-family: var(--font-serif); font-size: 1.0625rem; margin: 0 0 0.5rem; font-weight: 600; }
        .sv-range { margin-left: auto; display: inline-flex; gap: 0.25rem; }
        .sv-range button { padding: 0.25rem 0.5rem; background: transparent; border: 1px solid var(--color-border); border-radius: 6px; color: var(--color-fg-muted); cursor: pointer; font-size: 0.75rem; }
        .sv-range button.on { background: var(--color-accent); color: var(--color-accent-fg); border-color: var(--color-accent); }
        .sv-chart { width: 100%; }
      `}</style>
    </div>
  )
}

function Card({ label, value, suffix }: { label: string; value: number; suffix?: string }) {
  return (
    <div className="stat-card">
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value.toLocaleString()} {suffix && <small>{suffix}</small>}</span>
      <style>{`
        .stat-card { padding: 1rem; background: var(--color-bg-soft); border: 1px solid var(--color-border); border-radius: var(--radius-card); display: flex; flex-direction: column; gap: 0.25rem; }
        .stat-label { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--color-fg-muted); }
        .stat-value { font-family: var(--font-serif); font-size: 1.625rem; font-weight: 600; line-height: 1; }
        .stat-value small { font-size: 0.8125rem; color: var(--color-fg-muted); margin-left: 0.25rem; font-family: var(--font-sans, inherit); font-weight: 400; }
      `}</style>
    </div>
  )
}
