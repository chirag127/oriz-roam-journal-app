/**
 * Journal data types — the contract between Firestore and the React app.
 * All entries live under /journal/users/{uid}/* per AGENTS.md site-scoped data model.
 *
 * NOTE: while this site lives in the *journal* app, the Firestore root collection
 * for write/read is `users/{uid}/...` (Firebase auth uid maps directly). The
 * top-level `journal/` namespace is reserved for cross-site queries (not used
 * in MVP).
 */

export type Mood = 'great' | 'good' | 'neutral' | 'low' | 'bad'

export const MOODS: { id: Mood; label: string; emoji: string; color: string }[] = [
  { id: 'great', label: 'Great', emoji: '😄', color: '#10b981' },
  { id: 'good', label: 'Good', emoji: '🙂', color: '#84cc16' },
  { id: 'neutral', label: 'Neutral', emoji: '😐', color: '#a3a3a3' },
  { id: 'low', label: 'Low', emoji: '🙁', color: '#f59e0b' },
  { id: 'bad', label: 'Bad', emoji: '😢', color: '#ef4444' },
]

export type JournalType =
  | 'daily'
  | 'gratitude'
  | 'learning'
  | 'reading'
  | 'travel'
  | 'work'
  | 'fitness'
  | 'dream'
  | 'research'
  | 'reflection'
  | 'custom'

export const JOURNAL_TYPES: { id: JournalType; label: string; emoji: string }[] = [
  { id: 'daily', label: 'Daily', emoji: '📖' },
  { id: 'gratitude', label: 'Gratitude', emoji: '🙏' },
  { id: 'learning', label: 'Learning', emoji: '🎓' },
  { id: 'reading', label: 'Reading', emoji: '📚' },
  { id: 'travel', label: 'Travel', emoji: '✈️' },
  { id: 'work', label: 'Work', emoji: '💼' },
  { id: 'fitness', label: 'Fitness', emoji: '🏃' },
  { id: 'dream', label: 'Dream', emoji: '🌙' },
  { id: 'research', label: 'Research', emoji: '🔬' },
  { id: 'reflection', label: 'Reflection', emoji: '✨' },
  { id: 'custom', label: 'Custom', emoji: '📝' },
]

/**
 * 4-host photo tuple — see lib/photos.ts. Each entry stores one record per
 * uploaded image. The TipTap body still references images by URL in the HTML
 * (the "primary" URL: ImageKit > Cloudinary > imgbb > GH Releases); these
 * `photos[]` records carry the alternate URLs for read failover.
 */
export interface PhotoRecord {
  id: string
  urls: {
    cloudinary?: string
    imagekit?: string
    imgbb?: string
    ghRelease?: string
  }
  width?: number
  height?: number
  bytes?: number
  sha256?: string
  createdAt: number
}

export interface Entry {
  id: string
  title: string
  body: string // Markdown source (or ciphertext when E2EE on)
  bodyHtml: string // pre-rendered HTML (cleared when E2EE on)
  mood: Mood | null
  moodIntensity: number | null // 1-10
  tags: string[]
  journalType: JournalType
  entryDate: string // ISO date YYYY-MM-DD
  createdAt: number // ms epoch
  updatedAt: number
  favorite: boolean
  pinned: boolean
  isDraft: boolean
  wordCount: number
  /**
   * Flattened list of img-src URLs found in `bodyHtml`. Kept for backward
   * compatibility with legacy entries (Firebase-Storage era) and as a cheap
   * query handle. Authoritative metadata lives in `photos`.
   */
  photoUrls: string[]
  /** 4-host replica records. Empty for legacy entries — fall back to `photoUrls`. */
  photos?: PhotoRecord[]
  weather?: { temp: number; condition: string; locationCoarse: string } | null
  /**
   * Optional pin attached to the entry. Powers /map (travel mode, Pro-tier).
   * `place` and `country` come from nominatim reverse-geocoding; `lat`/`lon`
   * are from `navigator.geolocation` (decimal degrees, WGS84).
   */
  location?: { lat: number; lon: number; place?: string; country?: string }
  // E2EE
  encrypted?: boolean
  encryptedNonce?: string
}

export interface Template {
  id: string
  name: string
  description: string
  structure: string // markdown skeleton with prompts
  defaultJournalType: JournalType
  defaultMoodRequired: boolean
  isBuiltIn: boolean
  createdAt: number
  updatedAt: number
}

export interface Tag {
  id: string
  name: string
  count: number
  color?: string
  createdAt: number
}

export interface Goal {
  id: string
  title: string
  description?: string
  type: 'streak' | 'count' | 'words'
  target: number
  progress: number
  period: 'week' | 'month' | 'year' | 'custom'
  startDate: string // ISO
  endDate?: string
  completedAt?: number | null
  isArchived: boolean
  createdAt: number
  updatedAt: number
}

export interface StreakCounter {
  current: number
  longest: number
  lastEntryDate: string | null
  totalEntries: number
  totalWords: number
}

export interface UserProfile {
  email?: string
  displayName?: string
  photoURL?: string
  isAnonymous?: boolean
  defaultJournalType?: JournalType
  timezone?: string
  weatherEnabled?: boolean
  e2eeEnabled?: boolean
  createdAt?: number
  updatedAt?: number
}
