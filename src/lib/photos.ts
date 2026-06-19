/**
 * Photo storage — uploads to Firebase Storage at
 * /journal/users/{uid}/photos/{entryId}/{n}.{ext}
 *
 * Storage is lazily initialised here (not in @chirag127/oriz-ui) so the rest
 * of the family does not pay the bundle cost.
 */
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'
import { app } from './firebase'

let _storage: ReturnType<typeof getStorage> | null = null
function storage() {
  if (!_storage) _storage = getStorage(app)
  return _storage
}

export async function uploadPhoto(uid: string, entryId: string, file: File): Promise<string> {
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '')
  const name = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext || 'jpg'}`
  const path = `journal/users/${uid}/photos/${entryId}/${name}`
  const r = ref(storage(), path)
  await uploadBytes(r, file, { contentType: file.type || 'image/jpeg' })
  return await getDownloadURL(r)
}

export async function deletePhoto(url: string) {
  try {
    const r = ref(storage(), url)
    await deleteObject(r)
  } catch {
    // already gone or wrong domain — ignore
  }
}
