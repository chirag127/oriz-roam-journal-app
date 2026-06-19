/**
 * E2EE helpers via libsodium.
 *
 * MVP scope: derive a symmetric key from a user-chosen passphrase (PBKDF2 via
 * crypto_pwhash) and use crypto_secretbox to encrypt/decrypt the entry body.
 * The key is held in memory only — when the user reloads, they re-enter the
 * passphrase. The salt is per-user, stored on the profile.
 *
 * CAVEAT: this is an MVP stub. It encrypts only `body` (not title, tags, mood,
 * date). It does not protect against a malicious server. Documented in README.
 */
import sodium from 'libsodium-wrappers'

let _ready: Promise<void> | null = null
function ready() {
  if (!_ready) _ready = sodium.ready
  return _ready
}

export async function deriveKey(passphrase: string, saltBase64: string): Promise<Uint8Array> {
  await ready()
  const salt = sodium.from_base64(saltBase64, sodium.base64_variants.ORIGINAL)
  return sodium.crypto_pwhash(
    sodium.crypto_secretbox_KEYBYTES,
    passphrase,
    salt,
    sodium.crypto_pwhash_OPSLIMIT_INTERACTIVE,
    sodium.crypto_pwhash_MEMLIMIT_INTERACTIVE,
    sodium.crypto_pwhash_ALG_DEFAULT,
  )
}

export async function newSalt(): Promise<string> {
  await ready()
  const salt = sodium.randombytes_buf(sodium.crypto_pwhash_SALTBYTES)
  return sodium.to_base64(salt, sodium.base64_variants.ORIGINAL)
}

export async function encrypt(plaintext: string, key: Uint8Array): Promise<{ ciphertext: string; nonce: string }> {
  await ready()
  const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES)
  const ct = sodium.crypto_secretbox_easy(sodium.from_string(plaintext), nonce, key)
  return {
    ciphertext: sodium.to_base64(ct, sodium.base64_variants.ORIGINAL),
    nonce: sodium.to_base64(nonce, sodium.base64_variants.ORIGINAL),
  }
}

export async function decrypt(ciphertextB64: string, nonceB64: string, key: Uint8Array): Promise<string> {
  await ready()
  const ct = sodium.from_base64(ciphertextB64, sodium.base64_variants.ORIGINAL)
  const n = sodium.from_base64(nonceB64, sodium.base64_variants.ORIGINAL)
  const plain = sodium.crypto_secretbox_open_easy(ct, n, key)
  return sodium.to_string(plain)
}

// In-memory key cache — reset on reload, cleared on logout.
let _key: Uint8Array | null = null
export function setSessionKey(k: Uint8Array | null) { _key = k }
export function getSessionKey() { return _key }
