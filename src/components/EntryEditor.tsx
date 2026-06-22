/**
 * EntryEditor — v2.
 *
 * Full-bleed `--page-cream` page floating on `--dusk` frame. 720px column,
 * 64px top/bottom padding. NO toolbar at rest. Word count + lock-status
 * fade to 20% opacity after 8s of stillness; cursor movement restores them.
 *
 * Header chrome dissolves on first keystroke OR after 8s of stillness
 * (whichever first); the seal persists. Cursor-to-top-64px summons header
 * chrome back at 60% opacity.
 *
 * THE SEAL drives off the dirty/saving states:
 *   - 'sealed'  at mount (entry is current on disk)
 *   - 'typing'  on first dirty change (hollow ring)
 *   - 'sealing' while persist() is in flight (600ms pulse)
 *   - 'sealed'  again once saved
 *   - 'closing' on unmount via beforeunload (quarter-turn — wax pressing shut)
 *
 * No mood, no tags, no journal-type select, no weather chip in this editor —
 * the brief explicitly cuts the metadata-row entry surface to focus on the
 * writing. Mood/tags/type live in `/settings/entry` (out of scope here) or
 * the read view; we keep them on the Entry record so existing data survives,
 * but the editor surface is just date heading + body.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { fingerprintSync } from '~/lib/fingerprint'
import { getEntry, newEntryId, saveEntry, todayIso } from '~/lib/journalDb'
import { mdToHtml } from '~/lib/markdown'
import { BUILTIN_TEMPLATES } from '~/lib/templates'
import type { Entry, JournalType } from '~/lib/types'
import { setSeal } from './Seal'
import TipTapEditor from './TipTapEditor'

interface Props {
  uid: string
  entryId?: string
  templateId?: string
  defaultJournalType?: JournalType
}

const AUTOSAVE_MS = 4500
const STILLNESS_MS = 8000

export default function EntryEditor({
  uid,
  entryId: paramEntryId,
  templateId,
  defaultJournalType,
}: Props) {
  const [loading, setLoading] = useState(true)
  const [entry, setEntry] = useState<Entry | null>(null)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [savingState, setSavingState] = useState<'idle' | 'dirty' | 'saving' | 'saved' | 'error'>(
    'idle',
  )
  const [chromeFaded, setChromeFaded] = useState(false)
  const [statusFaded, setStatusFaded] = useState(false)
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
        const journalType: JournalType = (tpl?.defaultJournalType ??
          defaultJournalType ??
          'daily') as JournalType
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
          photos: [],
          weather: null,
        }
      }
      if (!cancelled) {
        setEntry(initial)
        latestRef.current = initial
        setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, paramEntryId, templateId])

  const persist = useCallback(async () => {
    if (!latestRef.current) return
    setSavingState('saving')
    setSeal('sealing')
    try {
      await saveEntry(uid, { ...latestRef.current, isDraft: false })
      dirtyRef.current = false
      setSavedAt(Date.now())
      setSavingState('saved')
      setSeal('sealed')
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

  // Save on unload + close-the-seal animation.
  useEffect(() => {
    const onLeave = () => {
      setSeal('closing')
      if (dirtyRef.current && latestRef.current) saveEntry(uid, latestRef.current).catch(() => {})
    }
    window.addEventListener('beforeunload', onLeave)
    window.addEventListener('pagehide', onLeave)
    return () => {
      window.removeEventListener('beforeunload', onLeave)
      window.removeEventListener('pagehide', onLeave)
    }
  }, [uid])

  // Stillness detection — fade chrome + status to 20% after STILLNESS_MS, restore on activity.
  useEffect(() => {
    let stillnessTimer: number | undefined
    const reset = () => {
      setStatusFaded(false)
      window.clearTimeout(stillnessTimer)
      stillnessTimer = window.setTimeout(() => {
        setStatusFaded(true)
        setChromeFaded(true)
      }, STILLNESS_MS)
    }
    reset()
    const onAny = () => reset()
    window.addEventListener('keydown', onAny)
    window.addEventListener('mousemove', onAny)
    window.addEventListener('touchstart', onAny)
    return () => {
      window.clearTimeout(stillnessTimer)
      window.removeEventListener('keydown', onAny)
      window.removeEventListener('mousemove', onAny)
      window.removeEventListener('touchstart', onAny)
    }
  }, [])

  // Cursor-to-top-64px summons chrome back at 60% opacity.
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (e.clientY <= 64) setChromeFaded(false)
    }
    window.addEventListener('mousemove', onMove)
    return () => window.removeEventListener('mousemove', onMove)
  }, [])

  if (loading || !entry) {
    return <div className="ee-loading chrome">Loading editor…</div>
  }

  const update = (patch: Partial<Entry>) => {
    setEntry((prev) => {
      if (!prev) return prev
      const next = { ...prev, ...patch, updatedAt: Date.now() }
      latestRef.current = next
      const wasDirty = dirtyRef.current
      dirtyRef.current = true
      setSavingState('dirty')
      if (!wasDirty) setSeal('typing')
      return next
    })
  }

  const fp = fingerprintSync(entry.body || entry.title || entry.id)
  const dateLong = new Date(entry.entryDate + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })

  return (
    <div className="ee">
      {/* Editor chrome — present at 100% on route enter; dissolves to 0% on
          first keystroke OR 8s stillness; cursor-to-top-64px summons it back
          at 60%. The seal lives outside this fade. */}
      <div className={`ee-chrome ${chromeFaded ? 'ee-chrome-faded' : ''}`}>
        <div className="spine ee-chrome-row">
          <a href="/dashboard" className="ee-back chrome">
            &larr; dashboard
          </a>
          <span className="ee-chrome-spacer" aria-hidden="true"></span>
          <a href={`/entries/${entry.id}`} className="ee-read chrome">
            read view
          </a>
        </div>
      </div>

      <article className="ee-page page-cream">
        <header className="ee-head">
          <input
            className="ee-date"
            type="date"
            value={entry.entryDate}
            onChange={(e) => update({ entryDate: e.target.value })}
            aria-label="Entry date"
          />
          <h1 className="ee-date-display">{dateLong}</h1>
          <input
            className="ee-title"
            placeholder="title (optional)"
            value={entry.title}
            onChange={(e) => update({ title: e.target.value })}
          />
          <span className="ee-fp tabular" data-oriz-fingerprint aria-hidden="true">
            {fp}
          </span>
        </header>

        <TipTapEditor
          uid={uid}
          entryId={stagedEntryId}
          initialHtml={entry.bodyHtml || mdToHtml(entry.body || '')}
          initialPhotos={entry.photos || []}
          placeholder="Begin."
          onChange={({ html, markdown, wordCount, photoUrls, photos }) =>
            update({ bodyHtml: html, body: markdown, wordCount, photoUrls, photos })
          }
        />

        <footer className={`ee-foot ${statusFaded ? 'ee-foot-faded' : ''}`}>
          <span className="ee-words tabular">{entry.wordCount || 0} words</span>
          <span className="ee-lock chrome">
            {savingState === 'saving' && 'sealing…'}
            {savingState === 'saved' &&
              savedAt &&
              `sealed · ${new Date(savedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
            {savingState === 'idle' && 'sealed'}
            {savingState === 'dirty' && 'unsaved'}
            {savingState === 'error' && 'save failed'}
          </span>
        </footer>
      </article>

      <style>{`
        .ee {
          --ee-fade-ms: 600ms;
          background: var(--dusk);
          min-height: 100vh;
        }
        .ee-loading {
          padding: 4rem 2rem;
          text-align: center;
        }
        .ee-chrome {
          padding: 16px 0 0;
          opacity: 1;
          transition: opacity var(--ee-fade-ms) ease-out;
        }
        .ee-chrome-faded { opacity: 0.0; }
        .ee-chrome:hover,
        .ee-chrome:focus-within {
          opacity: 0.6;
        }
        .ee-chrome-row {
          display: flex;
          align-items: center;
          height: 32px;
        }
        .ee-back, .ee-read {
          font-family: var(--font-sans);
          font-size: 13px;
          color: var(--graphite);
          text-decoration: none;
        }
        .ee-back:hover, .ee-read:hover { color: var(--seal-red); }
        .ee-chrome-spacer { flex: 1; }

        .ee-page {
          margin: 24px auto 0;
          max-width: 720px;
          padding: clamp(2rem, 6vw, 4rem) clamp(1.5rem, 5vw, 3rem);
          position: relative;
        }
        .ee-head {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          column-gap: 1rem;
          row-gap: 0.25rem;
          align-items: baseline;
          margin-bottom: 1.75rem;
        }
        .ee-date {
          grid-column: 1;
          font-family: var(--font-sans);
          font-size: 13px;
          color: var(--graphite);
          background: transparent;
          border: 0;
          outline: none;
          padding: 0;
          width: max-content;
          color-scheme: light;
        }
        .ee-date::-webkit-calendar-picker-indicator { opacity: 0.4; cursor: pointer; }
        .ee-date-display {
          grid-column: 1;
          font-family: var(--font-display);
          font-size: clamp(1.5rem, 4vw, 2rem);
          font-weight: 600;
          letter-spacing: -0.01em;
          line-height: 1.1;
          color: var(--ink, #1a1a22);
          margin: 0;
        }
        .ee-title {
          grid-column: 1;
          font-family: var(--font-display);
          font-size: clamp(1.125rem, 3vw, 1.375rem);
          font-style: italic;
          color: var(--graphite);
          background: transparent;
          border: 0;
          outline: none;
          padding: 0;
          width: 100%;
        }
        .ee-title::placeholder { color: var(--graphite); opacity: 0.55; }
        .ee-fp {
          grid-column: 2;
          grid-row: 1 / span 3;
          align-self: start;
          font-family: var(--font-sans);
          font-size: 11px;
          color: var(--graphite);
          letter-spacing: 0.04em;
          margin-top: 6px;
        }

        .ee-foot {
          margin-top: 2rem;
          padding-top: 0.75rem;
          border-top: 1px solid color-mix(in oklab, var(--ink, #1a1a22) 12%, transparent);
          display: flex;
          gap: 1rem;
          justify-content: flex-end;
          font-family: var(--font-sans);
          font-size: 13px;
          color: var(--graphite);
          opacity: 1;
          transition: opacity var(--ee-fade-ms) ease-out;
        }
        .ee-foot-faded { opacity: 0.2; }
        .ee-foot:hover { opacity: 1; }
        .ee-words { font-feature-settings: 'tnum' 1, 'zero' 1, 'calt' 0; }
        .ee-lock { color: var(--graphite); }
      `}</style>
    </div>
  )
}
