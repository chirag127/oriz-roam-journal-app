/**
 * CalendarView — month grid with mood-color heatmap. Click a day to jump to a
 * filtered entry list for that date. Keyboard nav: ← → ↑ ↓ J K to walk days.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { listEntries } from '~/lib/journalDb'
import type { Entry } from '~/lib/types'
import { MOODS } from '~/lib/types'

const MOODCOLOR = Object.fromEntries(MOODS.map((m) => [m.id, m.color]))

function startOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1) }
function isoDate(d: Date) { return d.toISOString().slice(0, 10) }

interface Props { uid: string }

export default function CalendarView({ uid }: Props) {
  const [cursor, setCursor] = useState<Date>(() => startOfMonth(new Date()))
  const [entries, setEntries] = useState<Entry[]>([])
  const [selected, setSelected] = useState<string>(isoDate(new Date()))
  const gridRef = useRef<HTMLDivElement>(null)

  useEffect(() => { listEntries(uid, { limit: 1000 }).then(setEntries) }, [uid])

  const byDate = useMemo(() => {
    const map: Record<string, Entry[]> = {}
    for (const e of entries) (map[e.entryDate] ??= []).push(e)
    return map
  }, [entries])

  const days = useMemo(() => {
    const first = startOfMonth(cursor)
    const last = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0)
    const padStart = first.getDay() // Sun=0
    const cells: (string | null)[] = []
    for (let i = 0; i < padStart; i++) cells.push(null)
    for (let d = 1; d <= last.getDate(); d++) cells.push(isoDate(new Date(cursor.getFullYear(), cursor.getMonth(), d)))
    while (cells.length % 7) cells.push(null)
    return cells
  }, [cursor])

  const monthLabel = cursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
  const todayIso = isoDate(new Date())
  const selectedEntries = byDate[selected] || []

  const move = (deltaDays: number) => {
    const d = new Date(selected)
    d.setDate(d.getDate() + deltaDays)
    setSelected(isoDate(d))
    // If we left the visible month, advance the cursor
    if (d.getMonth() !== cursor.getMonth() || d.getFullYear() !== cursor.getFullYear()) {
      setCursor(startOfMonth(d))
    }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === 'ArrowLeft' || e.key === 'h') { move(-1); e.preventDefault() }
      else if (e.key === 'ArrowRight' || e.key === 'l') { move(+1); e.preventDefault() }
      else if (e.key === 'ArrowUp' || e.key === 'k' || e.key === 'K') { move(-7); e.preventDefault() }
      else if (e.key === 'ArrowDown' || e.key === 'j' || e.key === 'J') { move(+7); e.preventDefault() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <div className="cal">
      <div className="cal-bar">
        <button type="button" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}>‹</button>
        <h2 className="cal-month">{monthLabel}</h2>
        <button type="button" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}>›</button>
        <button type="button" className="cal-today" onClick={() => { setCursor(startOfMonth(new Date())); setSelected(todayIso) }}>Today</button>
      </div>

      <div className="cal-headers">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => <div key={d}>{d}</div>)}
      </div>

      <div className="cal-grid" ref={gridRef} role="grid" aria-label="Calendar">
        {days.map((iso, i) => {
          if (!iso) return <div key={`p-${i}`} className="cal-pad" />
          const list = byDate[iso] || []
          const top = list.find((e) => e.mood)?.mood
          const color = top ? MOODCOLOR[top] : undefined
          const day = Number(iso.slice(8, 10))
          const isToday = iso === todayIso
          const isSel = iso === selected
          return (
            <button
              key={iso}
              type="button"
              role="gridcell"
              aria-selected={isSel}
              className={`cal-day ${isToday ? 'cal-day-today' : ''} ${isSel ? 'cal-day-sel' : ''}`}
              onClick={() => setSelected(iso)}
              style={color ? { background: `${color}33`, borderColor: color } : undefined}
            >
              <span className="cal-num">{day}</span>
              {list.length > 0 && <span className="cal-dot" aria-label={`${list.length} entries`}>{list.length}</span>}
            </button>
          )
        })}
      </div>

      <section className="cal-detail">
        <h3>{selected}</h3>
        {selectedEntries.length === 0 && (
          <p className="cal-empty">
            No entries on this day. <a href={`/entries/new?date=${selected}`}>+ Add one</a>
          </p>
        )}
        {selectedEntries.map((e) => (
          <a key={e.id} href={`/entries/${e.id}`} className="cal-entry">
            <strong>{e.title || 'Untitled'}</strong>
            <span>{e.mood ?? ''}</span>
          </a>
        ))}
      </section>

      <style>{`
        .cal { display: flex; flex-direction: column; gap: 0.875rem; }
        .cal-bar { display: flex; align-items: center; gap: 0.625rem; }
        .cal-bar button { background: var(--color-bg-soft); border: 1px solid var(--color-border); border-radius: var(--radius-button); padding: 0.375rem 0.625rem; color: var(--color-fg); cursor: pointer; }
        .cal-month { flex: 1; margin: 0; font-family: var(--font-serif); font-size: 1.25rem; font-weight: 600; }
        .cal-today { font-size: 0.8125rem; }
        .cal-headers { display: grid; grid-template-columns: repeat(7, 1fr); gap: 0.25rem; font-size: 0.6875rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--color-fg-muted); padding-bottom: 0.25rem; }
        .cal-headers > div { text-align: center; }
        .cal-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 0.25rem; }
        .cal-day, .cal-pad { aspect-ratio: 1 / 1; border-radius: var(--radius-button); }
        .cal-pad { background: transparent; }
        .cal-day { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.25rem; background: var(--color-bg-soft); border: 1px solid var(--color-border); cursor: pointer; color: var(--color-fg); position: relative; padding: 0.25rem; }
        .cal-day:hover { border-color: var(--color-accent); }
        .cal-day-today { outline: 2px solid var(--color-accent); outline-offset: -2px; }
        .cal-day-sel { box-shadow: inset 0 0 0 2px var(--color-accent); }
        .cal-num { font-size: 0.875rem; font-variant-numeric: tabular-nums; }
        .cal-dot { font-size: 0.6875rem; padding: 0 0.375rem; background: var(--color-bg); border-radius: 9999px; color: var(--color-fg-muted); }
        .cal-detail { padding: 0.875rem; background: var(--color-bg-soft); border: 1px solid var(--color-border); border-radius: var(--radius-card); display: flex; flex-direction: column; gap: 0.5rem; }
        .cal-detail h3 { margin: 0; font-family: var(--font-serif); font-size: 1rem; }
        .cal-empty { color: var(--color-fg-muted); margin: 0; }
        .cal-entry { display: flex; gap: 0.75rem; padding: 0.5rem 0.625rem; background: var(--color-bg); border: 1px solid var(--color-border); border-radius: var(--radius-button); color: var(--color-fg); text-decoration: none; }
      `}</style>
    </div>
  )
}
