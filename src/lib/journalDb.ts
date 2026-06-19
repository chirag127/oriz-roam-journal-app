/**
 * Firestore data access for the journal.
 *
 * All paths are owner-rooted: users/{uid}/...
 *
 * The Firebase singleton (auth + db) is set up by `~/lib/firebase.ts`,
 * which calls `initFirebase()` from `@chirag127/oriz-ui`. That helper only
 * exposes auth + db, so we lazily import storage from firebase/storage
 * at the point of use (photos).
 */
import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from './firebase'
import type { Entry, Goal, StreakCounter, Tag, Template, UserProfile } from './types'
import { BUILTIN_TEMPLATES } from './templates'

const isoDate = (d = new Date()) => d.toISOString().slice(0, 10)
export const todayIso = () => isoDate()

const userPath = (uid: string) => `users/${uid}`

// ---------- Profile ----------
export async function getProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(db, userPath(uid)))
  return snap.exists() ? (snap.data() as UserProfile) : null
}

export async function upsertProfile(uid: string, profile: Partial<UserProfile>) {
  await setDoc(
    doc(db, userPath(uid)),
    { ...profile, updatedAt: Date.now() },
    { merge: true },
  )
}

// ---------- Entries ----------
export async function listEntries(
  uid: string,
  opts: { limit?: number; journalType?: string; tag?: string; favorite?: boolean; pinned?: boolean } = {},
): Promise<Entry[]> {
  const ref = collection(db, `${userPath(uid)}/entries`)
  // Keep filters simple to avoid composite index requirements at MVP.
  let q = query(ref, orderBy('entryDate', 'desc'), limit(opts.limit ?? 200))
  if (opts.favorite) q = query(ref, where('favorite', '==', true), orderBy('entryDate', 'desc'), limit(opts.limit ?? 200))
  else if (opts.pinned) q = query(ref, where('pinned', '==', true), orderBy('updatedAt', 'desc'), limit(opts.limit ?? 200))
  else if (opts.journalType) q = query(ref, where('journalType', '==', opts.journalType), orderBy('entryDate', 'desc'), limit(opts.limit ?? 200))
  const snap = await getDocs(q)
  let rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Entry, 'id'>) }))
  if (opts.tag) rows = rows.filter((e) => e.tags?.includes(opts.tag!))
  return rows
}

export function watchEntries(
  uid: string,
  cb: (entries: Entry[]) => void,
  opts: { limit?: number } = {},
): Unsubscribe {
  const ref = collection(db, `${userPath(uid)}/entries`)
  const q = query(ref, orderBy('entryDate', 'desc'), limit(opts.limit ?? 50))
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Entry, 'id'>) })))
  })
}

export async function getEntry(uid: string, id: string): Promise<Entry | null> {
  const snap = await getDoc(doc(db, `${userPath(uid)}/entries/${id}`))
  return snap.exists() ? ({ id: snap.id, ...(snap.data() as Omit<Entry, 'id'>) }) : null
}

export async function saveEntry(uid: string, entry: Entry) {
  const ref = doc(db, `${userPath(uid)}/entries/${entry.id}`)
  const { id: _id, ...data } = entry
  await setDoc(ref, { ...data, updatedAt: Date.now() }, { merge: true })
  // Tag rollup (best-effort, not transactional).
  if (entry.tags?.length) {
    await Promise.all(entry.tags.map((t) => bumpTag(uid, t)))
  }
}

export async function deleteEntry(uid: string, id: string) {
  await deleteDoc(doc(db, `${userPath(uid)}/entries/${id}`))
}

// ---------- Tags ----------
export async function listTags(uid: string): Promise<Tag[]> {
  const ref = collection(db, `${userPath(uid)}/tags`)
  const snap = await getDocs(ref)
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Tag, 'id'>) }))
}

async function bumpTag(uid: string, name: string) {
  const slug = name.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-')
  if (!slug) return
  const ref = doc(db, `${userPath(uid)}/tags/${slug}`)
  const cur = await getDoc(ref)
  const count = (cur.exists() ? (cur.data().count as number) || 0 : 0) + 1
  await setDoc(
    ref,
    { name, count, createdAt: cur.exists() ? cur.data().createdAt : Date.now() },
    { merge: true },
  )
}

// ---------- Templates ----------
export async function listTemplates(uid: string): Promise<Template[]> {
  const ref = collection(db, `${userPath(uid)}/templates`)
  const snap = await getDocs(ref)
  const userRows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Template, 'id'>) }))
  const builtin = BUILTIN_TEMPLATES.map((t) => ({ ...t, createdAt: 0, updatedAt: 0 }))
  // Built-ins not overridden are presented inline.
  const overrideIds = new Set(userRows.map((r) => r.id))
  return [...builtin.filter((b) => !overrideIds.has(b.id)), ...userRows]
}

export async function saveTemplate(uid: string, t: Template) {
  const { id, ...data } = t
  await setDoc(doc(db, `${userPath(uid)}/templates/${id}`), { ...data, updatedAt: Date.now() }, { merge: true })
}

export async function deleteTemplate(uid: string, id: string) {
  await deleteDoc(doc(db, `${userPath(uid)}/templates/${id}`))
}

// ---------- Goals ----------
export async function listGoals(uid: string): Promise<Goal[]> {
  const ref = collection(db, `${userPath(uid)}/goals`)
  const snap = await getDocs(ref)
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Goal, 'id'>) }))
}

export async function saveGoal(uid: string, g: Goal) {
  const { id, ...data } = g
  await setDoc(doc(db, `${userPath(uid)}/goals/${id}`), { ...data, updatedAt: Date.now() }, { merge: true })
}

export async function deleteGoal(uid: string, id: string) {
  await deleteDoc(doc(db, `${userPath(uid)}/goals/${id}`))
}

// ---------- Streak counter ----------
export async function getStreak(uid: string): Promise<StreakCounter> {
  const snap = await getDoc(doc(db, `${userPath(uid)}/counters/streak`))
  if (!snap.exists()) return { current: 0, longest: 0, lastEntryDate: null, totalEntries: 0, totalWords: 0 }
  return snap.data() as StreakCounter
}

export async function recomputeStreak(uid: string): Promise<StreakCounter> {
  const ref = collection(db, `${userPath(uid)}/entries`)
  const snap = await getDocs(query(ref, orderBy('entryDate', 'desc'), limit(2000)))
  const dates = new Set<string>()
  let totalWords = 0
  snap.docs.forEach((d) => {
    const e = d.data() as Entry
    dates.add(e.entryDate)
    totalWords += e.wordCount || 0
  })
  const sorted = [...dates].sort().reverse()

  // current streak: contiguous days back from today (or yesterday)
  let current = 0
  const today = new Date()
  let cursor = new Date(today)
  if (!sorted.includes(isoDate(today))) cursor.setDate(cursor.getDate() - 1)
  while (sorted.includes(isoDate(cursor))) {
    current += 1
    cursor.setDate(cursor.getDate() - 1)
  }

  // longest streak
  let longest = 0
  let run = 0
  let prev: Date | null = null
  for (const d of [...sorted].reverse()) {
    const dt = new Date(d)
    if (prev && (dt.getTime() - prev.getTime()) === 86_400_000) run += 1
    else run = 1
    if (run > longest) longest = run
    prev = dt
  }

  const out: StreakCounter = {
    current,
    longest,
    lastEntryDate: sorted[0] ?? null,
    totalEntries: snap.size,
    totalWords,
  }
  await setDoc(doc(db, `${userPath(uid)}/counters/streak`), out, { merge: true })
  return out
}

// ---------- Helpers ----------
export function newEntryId() {
  // Sortable + collision-resistant enough for client IDs.
  return `e_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

export function newGoalId() { return `g_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}` }
export function newTemplateId() { return `t_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}` }

export function countWords(s: string) {
  return s.trim().split(/\s+/).filter(Boolean).length
}

// expose for environments that don't yet ship serverTimestamp consts
export { serverTimestamp }
