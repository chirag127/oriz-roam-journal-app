/**
 * GoalsView — list + create journal goals (write-daily-30, gratitude-10, etc).
 */
import { useEffect, useMemo, useState } from 'react'
import { listGoals, saveGoal, deleteGoal, listEntries, newGoalId } from '~/lib/journalDb'
import type { Entry, Goal } from '~/lib/types'

interface Props { uid: string }

export default function GoalsView({ uid }: Props) {
  const [goals, setGoals] = useState<Goal[]>([])
  const [entries, setEntries] = useState<Entry[]>([])
  const [creating, setCreating] = useState(false)
  const [draft, setDraft] = useState<Partial<Goal>>({})

  const reload = async () => setGoals(await listGoals(uid))

  useEffect(() => { reload(); listEntries(uid, { limit: 1000 }).then(setEntries) }, [uid]) // eslint-disable-line

  const computed = useMemo(() => {
    return goals.map((g) => {
      const start = new Date(g.startDate).getTime()
      const end = g.endDate ? new Date(g.endDate).getTime() : Date.now()
      const inRange = entries.filter((e) => {
        const t = new Date(e.entryDate).getTime()
        return t >= start && t <= end
      })
      let progress = 0
      if (g.type === 'count') progress = inRange.length
      else if (g.type === 'words') progress = inRange.reduce((s, e) => s + (e.wordCount || 0), 0)
      else if (g.type === 'streak') {
        const dates = new Set(inRange.map((e) => e.entryDate))
        let run = 0; let best = 0
        const cursor = new Date(g.startDate)
        while (cursor.getTime() <= end) {
          if (dates.has(cursor.toISOString().slice(0, 10))) run += 1
          else run = 0
          if (run > best) best = run
          cursor.setDate(cursor.getDate() + 1)
        }
        progress = best
      }
      return { ...g, progress }
    })
  }, [goals, entries])

  const create = async () => {
    if (!draft.title || !draft.target) return
    const g: Goal = {
      id: newGoalId(),
      title: draft.title!,
      description: draft.description,
      type: (draft.type as Goal['type']) || 'count',
      target: Number(draft.target),
      progress: 0,
      period: (draft.period as Goal['period']) || 'month',
      startDate: draft.startDate || new Date().toISOString().slice(0, 10),
      endDate: draft.endDate,
      isArchived: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    await saveGoal(uid, g)
    setCreating(false); setDraft({}); await reload()
  }

  return (
    <div className="gv">
      <div className="gv-bar">
        <button type="button" className="gv-cta" onClick={() => setCreating(true)}>+ New goal</button>
      </div>
      {creating && (
        <div className="gv-card gv-form">
          <input placeholder="Title (e.g. Write daily for 30 days)" value={draft.title || ''} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
          <textarea placeholder="Description (optional)" value={draft.description || ''} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
          <div className="gv-form-row">
            <select value={draft.type || 'count'} onChange={(e) => setDraft({ ...draft, type: e.target.value as Goal['type'] })}>
              <option value="count">Entry count</option>
              <option value="streak">Streak</option>
              <option value="words">Words written</option>
            </select>
            <input type="number" min={1} placeholder="Target" value={draft.target || ''} onChange={(e) => setDraft({ ...draft, target: Number(e.target.value) })} />
            <select value={draft.period || 'month'} onChange={(e) => setDraft({ ...draft, period: e.target.value as Goal['period'] })}>
              <option value="week">This week</option>
              <option value="month">This month</option>
              <option value="year">This year</option>
              <option value="custom">Custom</option>
            </select>
          </div>
          <div className="gv-form-row">
            <input type="date" value={draft.startDate || ''} onChange={(e) => setDraft({ ...draft, startDate: e.target.value })} />
            <input type="date" value={draft.endDate || ''} onChange={(e) => setDraft({ ...draft, endDate: e.target.value })} />
          </div>
          <div className="gv-form-actions">
            <button type="button" onClick={create} className="gv-save">Save goal</button>
            <button type="button" onClick={() => { setCreating(false); setDraft({}) }} className="gv-cancel">Cancel</button>
          </div>
        </div>
      )}
      {computed.length === 0 && !creating && (
        <p className="gv-empty">No goals yet. Set one to start tracking your journaling habit.</p>
      )}
      {computed.map((g) => {
        const pct = Math.min(100, Math.round((g.progress / g.target) * 100))
        return (
          <div key={g.id} className="gv-card">
            <div className="gv-head">
              <strong>{g.title}</strong>
              <button type="button" className="gv-del" onClick={async () => { await deleteGoal(uid, g.id); await reload() }} aria-label="Delete goal">×</button>
            </div>
            {g.description && <p className="gv-desc">{g.description}</p>}
            <div className="gv-progress"><div className="gv-progress-bar" style={{ width: `${pct}%` }} /></div>
            <div className="gv-meta">
              <span>{g.progress} / {g.target} {g.type === 'words' ? 'words' : g.type === 'streak' ? 'days streak' : 'entries'}</span>
              <span>{g.period}</span>
              <span>{g.startDate}{g.endDate ? ` → ${g.endDate}` : ''}</span>
            </div>
          </div>
        )
      })}
      <style>{`
        .gv { display: flex; flex-direction: column; gap: 0.75rem; }
        .gv-bar { display: flex; }
        .gv-cta { padding: 0.5rem 0.875rem; border-radius: var(--radius-button); background: var(--color-accent); color: var(--color-accent-fg); border: 1px solid var(--color-accent); font-weight: 500; cursor: pointer; }
        .gv-card { padding: 1rem; background: var(--color-bg-soft); border: 1px solid var(--color-border); border-radius: var(--radius-card); display: flex; flex-direction: column; gap: 0.5rem; }
        .gv-head { display: flex; align-items: center; gap: 0.5rem; }
        .gv-del { margin-left: auto; background: none; border: 0; color: var(--color-fg-muted); cursor: pointer; font-size: 1.25rem; line-height: 1; }
        .gv-desc { margin: 0; color: var(--color-fg-muted); font-size: 0.875rem; }
        .gv-progress { height: 6px; background: var(--color-bg-muted); border-radius: 9999px; overflow: hidden; }
        .gv-progress-bar { height: 100%; background: var(--color-accent); transition: width 200ms; }
        .gv-meta { display: flex; gap: 1rem; flex-wrap: wrap; font-size: 0.75rem; color: var(--color-fg-muted); }
        .gv-form input, .gv-form select, .gv-form textarea {
          background: var(--color-bg); border: 1px solid var(--color-border); border-radius: var(--radius-button);
          color: var(--color-fg); padding: 0.5rem 0.625rem; font: inherit; font-size: 0.875rem;
        }
        .gv-form textarea { min-height: 60px; resize: vertical; }
        .gv-form-row { display: flex; flex-wrap: wrap; gap: 0.5rem; }
        .gv-form-row > * { flex: 1; min-width: 140px; }
        .gv-form-actions { display: flex; gap: 0.5rem; }
        .gv-save { padding: 0.5rem 0.875rem; border-radius: var(--radius-button); background: var(--color-accent); color: var(--color-accent-fg); border: 1px solid var(--color-accent); cursor: pointer; }
        .gv-cancel { padding: 0.5rem 0.875rem; border-radius: var(--radius-button); background: transparent; color: var(--color-fg); border: 1px solid var(--color-border); cursor: pointer; }
        .gv-empty { color: var(--color-fg-muted); padding: 2rem; text-align: center; background: var(--color-bg-soft); border: 1px dashed var(--color-border); border-radius: var(--radius-card); }
      `}</style>
    </div>
  )
}
