/**
 * EntryMap — Leaflet map of every entry that carries a location pin.
 *
 * Leaflet is dynamic-imported so the ~40KB JS + 15KB CSS only ship on /map.
 * We mount it client:only so SSR never touches `window`.
 *
 * Tiles: OpenStreetMap raster tiles. The default OSM attribution string is
 * mandatory under their TOS — it is rendered by Leaflet's tile layer when
 * we pass `attribution`, and the surrounding CSS keeps it visible (no
 * `display: none` on `.leaflet-control-attribution`).
 *
 * Each pin opens a popup with the entry date, optional title, and a link
 * to the read view. Pins cluster naturally at the tile level — for the
 * MVP we don't bring in leaflet.markercluster (one more dep) since most
 * users will have well under 1k pins.
 */
import { useEffect, useRef, useState } from 'react'
import { listEntries } from '~/lib/journalDb'
import type { Entry } from '~/lib/types'

interface Props {
  uid: string
}

interface PinEntry {
  id: string
  title: string
  entryDate: string
  location: NonNullable<Entry['location']>
}

export default function EntryMap({ uid }: Props) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [pins, setPins] = useState<PinEntry[] | null>(null)
  const [err, setErr] = useState<string | null>(null)

  // Load entries with a location.
  useEffect(() => {
    let cancelled = false
    listEntries(uid, { limit: 1000 })
      .then((entries) => {
        if (cancelled) return
        const located = entries
          .filter((e): e is Entry & { location: NonNullable<Entry['location']> } => !!e.location)
          .map((e) => ({
            id: e.id,
            title: e.title,
            entryDate: e.entryDate,
            location: e.location,
          }))
        setPins(located)
      })
      .catch((e) => {
        if (!cancelled) setErr(String(e?.message ?? e))
      })
    return () => {
      cancelled = true
    }
  }, [uid])

  // Lazy-load Leaflet + render once we have a container + pins.
  useEffect(() => {
    if (!ref.current || !pins) return
    let map: { remove: () => void } | null = null
    let cancelled = false

    ;(async () => {
      const L = await import('leaflet')
      // Inject the CSS once; Leaflet's marker sprites need it.
      if (!document.querySelector('link[data-leaflet-css]')) {
        const link = document.createElement('link')
        link.rel = 'stylesheet'
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
        link.setAttribute('data-leaflet-css', '1')
        document.head.appendChild(link)
      }

      if (cancelled || !ref.current) return

      // Fix default marker icons (Leaflet's icon URLs assume webpack image-loader).
      const iconBase = 'https://unpkg.com/leaflet@1.9.4/dist/images/'
      // @ts-expect-error — Leaflet's runtime mutation pattern, not in the d.ts.
      delete L.Icon.Default.prototype._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: `${iconBase}marker-icon-2x.png`,
        iconUrl: `${iconBase}marker-icon.png`,
        shadowUrl: `${iconBase}marker-shadow.png`,
      })

      const center: [number, number] = pins.length
        ? [pins[0].location.lat, pins[0].location.lon]
        : [20, 0]
      const m = L.map(ref.current).setView(center, pins.length ? 4 : 2)
      map = m
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(m)

      const bounds: [number, number][] = []
      for (const p of pins) {
        const marker = L.marker([p.location.lat, p.location.lon]).addTo(m)
        const label = p.title || '(untitled)'
        const place = p.location.place
          ? `${p.location.place}${p.location.country ? ', ' + p.location.country : ''}`
          : ''
        marker.bindPopup(
          `<div style="font-family: var(--font-display, serif); min-width: 140px;">
            <div style="font-size: 11px; opacity: 0.65;">${p.entryDate}</div>
            <div style="font-weight: 600; margin: 2px 0;">${escapeHtml(label)}</div>
            ${place ? `<div style="font-size: 12px; font-style: italic; opacity: 0.75;">${escapeHtml(place)}</div>` : ''}
            <a href="/entries/${encodeURIComponent(p.id)}" style="font-size: 12px;">read &rarr;</a>
          </div>`,
        )
        bounds.push([p.location.lat, p.location.lon])
      }
      if (bounds.length > 1) m.fitBounds(bounds, { padding: [40, 40] })
    })().catch((e) => {
      if (!cancelled) setErr(String(e?.message ?? e))
    })

    return () => {
      cancelled = true
      map?.remove()
    }
  }, [pins])

  if (err) return <p className="em-err">Map failed to load: {err}</p>
  if (!pins) return <p className="em-loading">loading map…</p>

  return (
    <div className="em-wrap">
      {pins.length === 0 && (
        <p className="em-empty">
          No located entries yet. Open any entry and tap <em>“Add location”</em> to drop a pin.
        </p>
      )}
      <div ref={ref} className="em-map" />
      <style>{`
        .em-wrap { display: flex; flex-direction: column; gap: 1rem; }
        .em-map {
          height: clamp(420px, 65vh, 720px);
          width: 100%;
          border: 1px solid color-mix(in oklab, var(--ink, #1a1a22) 18%, transparent);
          background: var(--page-cream);
        }
        .em-empty, .em-loading, .em-err {
          font-family: var(--font-display);
          font-style: italic;
          color: var(--graphite);
        }
        /* OSM TOS: attribution must stay visible. */
        :global(.leaflet-control-attribution) {
          font-family: var(--font-sans);
          font-size: 11px !important;
          background: rgba(255, 255, 255, 0.85) !important;
        }
      `}</style>
    </div>
  )
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
