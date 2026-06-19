/**
 * EntryEditor — orchestrates TipTap + title + mood + tags + journal-type
 * + weather + autosave (every 4.5s while dirty).
 *
 * URL params drive what is loaded:
 *   /entries/new                          → blank entry, today's date
 *   /entries/new?template=tpl-daily       → seeded from a template
 *   /entries/[id]/edit                    → load + edit existing entry
 *
 * The Astro page renders a thin <client:only> wrapper that resolves the URL
 * and mounts this component with the right props.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import TipTapEditor from './TipTapEditor'
import MoodPicker from './MoodPicker'
import TagPicker from './TagPicker'
import { getEntry, saveEntry, newEntryId, todayIso } from '~/lib/journalDb'
import { mdToHtml } from '~/lib/markdown'
import { fetchWeather } from '~/lib/weather'
import { getProfile } from '~/lib/journalDb'
import { JOURNAL_TYPES, type Entry, type JournalType, type Mood } from '~/lib/types'
import { BUILTIN_TEMPLATES } from '~/lib/templates'

interface Props {
  uid: string
  entryId?: string // when editing
  templateId?: string // when seeding new
  defaultJournalType?: JournalType
}

const AUTOSAVE_MS = 4500

export default function EntryEditor({ uid, entryId: paramEntryId, templateId, defaultJournalType }: Props) {
  const [loading, setLoading] = useState(true)
  const [entry, setEntry] = useState<Entry | null>(null)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [savingState, setSavingState] = useState<'idle' | 'dirty' | 'saving' | 'saved' | 'error'>('idle')
  const dirtyRef = useRef(false)
  const latestRef = useRef<Entry | null>(null)
  const stagedEntryId = useMemo(() => paramEntryId || newEntryId(), [paramEntryId])

  // Load
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      let initial: Entry | null = null
      if (paramEntryId) initial = await getEntry(uid, paramEntryId)

      if (!initial) {
        const tpl = templateId ? BUILTIN_TEMPLATES.find((t) => t.id === templateId) : null
        const journalType: JournalType = (tpl?.defaultJournalType ?? defaultJournalType ?? 'daily') as JournalType
        initial = {
          id: stagedEntryId,
          title: '',
          body: tpl?.structure ?? '',
          bodyHtml: tpl ? mdToHtml(tpl.structure) : '',
          mood: null,
          moodIntensity: null,
          tags: [],
          journalType,
          entryDate: todayIso(),
          createdAt: Date.now(),
          updatedAt: Date.now(),
          favorite: false,
          pinned: false,
          isDraft: true,
          wordCount: 0,
          photoUrls: [],
          weather: null,
        }
      }
      if (!cancelled) {
        setEntry(initial)
        latestRef.current = initial
        setLoading(false)
      }
    })()
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, paramEntryId, templateId])

  const persist = useCallback(async () => {
    if (!latestRef.current) return
    setSavingState('saving')
    try {
      await saveEntry(uid, { ...latestRef.current, isDraft: false })
      dirtyRef.current = false
      setSavedAt(Date.now())
      setSavingState('saved')
    } catch (e) {
      console.error(e)
      setSavingState('error')
    }
  }, [uid])

  // Autosave loop
  useEffect(() => {
    const id = setInterval(() => {
      if (dirtyRef.current) persist()
    }, AUTOSAVE_MS)
    return () => clearInterval(id)
  }, [persist])

  // Save on unload
  useEffect(() => {
    const onLeave = () => { if (dirtyRef.current && latestRef.current) saveEntry(uid, latestRef.current).catch(() => {}) }
    window.addEventListener('beforeunload', onLeave)
    window.addEventListener('pagehide', onLeave)
    return () => { window.removeEventListener('beforeunload', onLeave); window.removeEventListener('pagehide', onLeave) }
  }, [uid])

  if (loading || !entry) {
    return <div style={{ padding: '2rem', color: 'var(--color-fg-muted)' }}>Loading editor…</div>
  }

  const update = (patch: Partial<Entry>) => {
    setEntry((prev) => {
      if (!prev) return prev
      const next = { ...prev, ...patch, updatedAt: Date.now() }
      latestRef.current = next
      dirtyRef.current = true
      setSavingState('dirty')
      return next
    })
  }

  const stampWeather = async () => {
    const profile = await getProfile(uid)
    if (!profile?.weatherEnabled) {
      const ok = window.confirm('Weather stamping is off in Settings. Enable it now and stamp this entry?')
      if (!ok) return
    }
    const w = await fetchWeather()
    if (w) update({ weather: w })
  }

  return (
    <div className="ee-shell">
      <div className="ee-meta">
        <input
          className="ee-title"
          placeholder="Title"
          value={entry.title}
          onChange={(e) => update({ title: e.target.value })}
        />
        <div className="ee-meta-row">
          <input
            type="date"
            className="ee-date"
            value={entry.entryDate}
            onChange={(e) => update({ entryDate: e.target.value })}
          />
          <select
            className="ee-jt"
            value={entry.journalType}
            onChange={(e) => update({ journalType: e.target.value as JournalType })}
          >
            {JOURNAL_TYPES.map((t) => (
              <option key={t.id} value={t.id}>{t.emoji} {t.label}</option>
            ))}
          </select>
          <button type="button" className="ee-btn" onClick={() => update({ favorite: !entry.favorite })}>
            {entry.favorite ? '❤️ Favorited' : '🤍 Favorite'}
          </button>
          <button type="button" className="ee-btn" onClick={() => update({ pinned: !entry.pinned })}>
            {entry.pinned ? '📌 Pinned' : '📌 Pin'}
          </button>
          <button type="button" className="ee-btn" onClick={stampWeather}>🌤 Weather</button>
          <button type="button" className="ee-btn ee-btn-primary" onClick={persist}>Save now</button>
          <span className={`ee-status ee-status-${savingState}`}>
            {savingState === 'idle' && 'Up to date'}
            {savingState === 'dirty' && '● Unsaved'}
            {savingState === 'saving' && 'Saving…'}
            {savingState === 'saved' && `Saved ${savedAt ? new Date(savedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}`}
            {savingState === 'error' && 'Save failed'}
          </span>
        </div>
      </div>

      <section className="ee-section">
        <h3>Mood</h3>
        <MoodPicker
          mood={entry.mood as Mood | null}
          intensity={entry.moodIntensity}
          onChange={(m, i) => update({ mood: m, moodIntensity: i })}
        />
      </section>

      <section className="ee-section">
        <h3>Tags</h3>
        <TagPicker tags={entry.tags} onChange={(tags) => update({ tags })} />
      </section>

      {entry.weather && (
        <section className="ee-section">
          <h3>Weather</h3>
          <p className="ee-weather">{entry.weather.temp}° · {entry.weather.condition} · {entry.weather.locationCoarse}</p>
        </section>
      )}

      <section className="ee-section">
        <h3>Entry</h3>
        <TipTapEditor
          uid={uid}
          entryId={stagedEntryId}
          initialHtml={entry.bodyHtml || mdToHtml(entry.body || '')}
          placeholder={'What is on your mind today?'}
          onChange={({ html, markdown, wordCount, photoUrls }) =>
            update({ bodyHtml: html, body: markdown, wordCount, photoUrls })
          }
        />
      </section>

      <style>{`
        .ee-shell { display: flex; flex-direction: column; gap: 1.5rem; padding-block: 1.5rem; }
        .ee-meta { display: flex; flex-direction: column; gap: 0.625rem; }
        .ee-title {
          width: 100%; font-family: var(--font-serif);
          font-size: clamp(1.625rem, 4vw, 2.25rem); font-weight: 600; letter-spacing: -0.01em;
          background: transparent; border: 0; outline: none; color: var(--color-fg);
        }
        .ee-title::placeholder { color: var(--color-fg-muted); }
        .ee-meta-row { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; }
        .ee-date, .ee-jt, .ee-btn {
          height: 36px; padding-inline: 0.75rem;
          background: var(--color-bg-soft);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-button);
          color: var(--color-fg); font: inherit; font-size: 0.8125rem;
          cursor: pointer;
        }
        .ee-btn-primary { background: var(--color-accent); color: var(--color-accent-fg); border-color: var(--color-accent); }
        .ee-status { font-size: 0.75rem; color: var(--color-fg-muted); margin-left: auto; }
        .ee-status-saving { color: var(--color-accent); }
        .ee-status-error { color: #ef4444; }
        .ee-section { display: flex; flex-direction: column; gap: 0.5rem; }
        .ee-section h3 { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--color-fg-muted); margin: 0; }
        .ee-weather { color: var(--color-fg-muted); margin: 0; }
      `}</style>
    </div>
  )
}
