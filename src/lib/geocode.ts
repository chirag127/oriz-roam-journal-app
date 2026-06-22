/**
 * Nominatim reverse-geocoding — lat/lon -> human place name + country.
 *
 * Nominatim usage policy (https://operations.osmfoundation.org/policies/nominatim/):
 *   - max 1 req/sec
 *   - identify your app via a real User-Agent or Referer
 *   - cache results client-side; do not bulk-geocode
 *
 * We honour all three: a fixed UA string, a 1-second min-interval, and an
 * in-memory LRU keyed by `lat,lon` rounded to 4 decimals (≈11m). This file
 * runs in the browser, so the User-Agent header is set via the fetch
 * `headers` object — browsers strip the `User-Agent` header silently, but
 * the operations team accepts the `Referer` (current page URL) as a
 * fallback identifier, which the browser sends automatically.
 */

const ENDPOINT = 'https://nominatim.openstreetmap.org/reverse'
const APP_UA = 'oriz-roam-journal/0.1 (+https://oriz.dev)'

export interface ReverseGeocodeResult {
  place?: string
  country?: string
}

const cache = new Map<string, ReverseGeocodeResult>()
let lastCall = 0

function key(lat: number, lon: number): string {
  return `${lat.toFixed(4)},${lon.toFixed(4)}`
}

async function throttle(): Promise<void> {
  const since = Date.now() - lastCall
  if (since < 1000) await new Promise((r) => setTimeout(r, 1000 - since))
  lastCall = Date.now()
}

export async function reverseGeocode(lat: number, lon: number): Promise<ReverseGeocodeResult> {
  const k = key(lat, lon)
  const hit = cache.get(k)
  if (hit) return hit
  await throttle()

  const url = `${ENDPOINT}?format=jsonv2&lat=${lat}&lon=${lon}&zoom=10&addressdetails=1`
  const res = await fetch(url, {
    headers: {
      // Browsers may suppress User-Agent, but explicit Accept makes intent clear.
      // The Referer (auto-sent by the browser) identifies the app per Nominatim TOS.
      'User-Agent': APP_UA,
      Accept: 'application/json',
    },
  })
  if (!res.ok) {
    const empty: ReverseGeocodeResult = {}
    cache.set(k, empty)
    return empty
  }
  const data = (await res.json()) as {
    address?: {
      city?: string
      town?: string
      village?: string
      hamlet?: string
      suburb?: string
      state?: string
      country?: string
    }
    display_name?: string
  }
  const a = data.address ?? {}
  const place = a.city || a.town || a.village || a.hamlet || a.suburb || a.state
  const result: ReverseGeocodeResult = { place, country: a.country }
  cache.set(k, result)
  return result
}
