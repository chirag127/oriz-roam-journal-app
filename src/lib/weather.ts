/**
 * Optional weather stamping — Open-Meteo public API (no key, no auth, free).
 * Geo via the browser geolocation API (coarse, requires user prompt).
 */

export interface WeatherStamp {
  temp: number
  condition: string
  locationCoarse: string
}

const WMO: Record<number, string> = {
  0: 'Clear', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
  45: 'Fog', 48: 'Rime fog', 51: 'Drizzle', 53: 'Drizzle', 55: 'Drizzle',
  61: 'Rain', 63: 'Rain', 65: 'Heavy rain', 66: 'Freezing rain', 67: 'Freezing rain',
  71: 'Snow', 73: 'Snow', 75: 'Heavy snow', 77: 'Snow grains',
  80: 'Showers', 81: 'Showers', 82: 'Heavy showers',
  85: 'Snow showers', 86: 'Snow showers',
  95: 'Thunderstorm', 96: 'Thunderstorm', 99: 'Thunderstorm',
}

export async function fetchWeather(): Promise<WeatherStamp | null> {
  if (!('geolocation' in navigator)) return null
  const pos = await new Promise<GeolocationPosition | null>((resolve) => {
    navigator.geolocation.getCurrentPosition(resolve, () => resolve(null), { timeout: 6000, maximumAge: 600_000 })
  })
  if (!pos) return null
  const { latitude, longitude } = pos.coords
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude.toFixed(2)}&longitude=${longitude.toFixed(2)}&current_weather=true`
  const r = await fetch(url)
  if (!r.ok) return null
  const j = await r.json() as { current_weather?: { temperature: number; weathercode: number } }
  if (!j.current_weather) return null
  return {
    temp: Math.round(j.current_weather.temperature),
    condition: WMO[j.current_weather.weathercode] ?? 'Unknown',
    locationCoarse: `${latitude.toFixed(1)}, ${longitude.toFixed(1)}`,
  }
}
