/**
 * EntryLocationPin — small toolbar-adjacent button that:
 *   1. asks for geolocation permission
 *   2. reverse-geocodes (best-effort) via Nominatim
 *   3. attaches the result to the entry via onChange
 *
 * Renders a compact pill once a location is set; "📍 Add location" otherwise.
 * Errors are surfaced inline (small italic graphite text); we never throw —
 * geolocation is best-effort by design.
 */
import { useState } from 'react'
import { reverseGeocode } from '~/lib/geocode'
import type { Entry } from '~/lib/types'

interface Props {
  location?: Entry['location']
  onChange: (next: Entry['location'] | undefined) => void
}

export default function EntryLocationPin({ location, onChange }: Props) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const pick = () => {
    if (!('geolocation' in navigator)) {
      setErr('geolocation unavailable in this browser')
      return
    }
    setErr(null)
    setBusy(true)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude
        const lon = pos.coords.longitude
        try {
          const rg = await reverseGeocode(lat, lon)
          onChange({ lat, lon, place: rg.place, country: rg.country })
        } catch {
          onChange({ lat, lon })
        } finally {
          setBusy(false)
        }
      },
      (e) => {
        setBusy(false)
        setErr(e.code === 1 ? 'permission denied' : 'could not get location')
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 },
    )
  }

  const clear = () => onChange(undefined)

  return (
    <span className="elp">
      {location ? (
        <span className="elp-pill">
          <span aria-hidden="true">📍</span>
          <span className="elp-place">
            {location.place ?? `${location.lat.toFixed(3)}, ${location.lon.toFixed(3)}`}
            {location.country ? `, ${location.country}` : ''}
          </span>
          <button
            type="button"
            className="elp-clear"
            aria-label="Remove location"
            onClick={clear}
          >
            ×
          </button>
        </span>
      ) : (
        <button type="button" className="elp-btn" onClick={pick} disabled={busy}>
          {busy ? 'locating…' : '📍 Add location'}
        </button>
      )}
      {err && <span className="elp-err">{err}</span>}
      <style>{`
        .elp { display: inline-flex; align-items: center; gap: 0.5rem; font-family: var(--font-sans); font-size: 13px; }
        .elp-btn {
          background: transparent;
          border: 1px solid color-mix(in oklab, var(--ink, #1a1a22) 18%, transparent);
          color: var(--graphite);
          padding: 4px 10px;
          font: inherit;
          cursor: pointer;
          border-radius: 2px;
        }
        .elp-btn:hover:not(:disabled) { border-color: var(--seal-red); color: var(--seal-red); }
        .elp-btn:disabled { opacity: 0.5; cursor: progress; }
        .elp-pill {
          display: inline-flex;
          align-items: center;
          gap: 0.375rem;
          padding: 3px 8px 3px 8px;
          border: 1px solid color-mix(in oklab, var(--seal-red) 50%, transparent);
          background: color-mix(in oklab, var(--seal-red) 8%, transparent);
          color: var(--graphite);
          border-radius: 2px;
        }
        .elp-place { font-family: var(--font-display); font-style: italic; }
        .elp-clear {
          border: 0;
          background: transparent;
          color: var(--graphite);
          font: inherit;
          cursor: pointer;
          padding: 0 2px;
          line-height: 1;
          opacity: 0.55;
        }
        .elp-clear:hover { color: var(--seal-red); opacity: 1; }
        .elp-err { font-style: italic; color: var(--graphite); opacity: 0.7; }
      `}</style>
    </span>
  )
}
