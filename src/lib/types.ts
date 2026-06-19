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
  photoUrls: string[]
  weather?: { temp: number; condition: string; locationCoarse: string } | null
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
