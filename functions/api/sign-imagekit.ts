/**
 * Cloudflare Pages Function — POST /api/sign-imagekit
 *
 * Returns a short-lived ImageKit upload signature so the browser can upload
 * directly to ImageKit without ever seeing the private key.
 *
 * Per https://docs.imagekit.io/api-reference/upload-file-api/client-side-file-upload
 *   signature = HMAC-SHA1(privateKey, token + expire)
 *   token     = random opaque string (we use crypto.randomUUID())
 *   expire    = unix seconds at which the signature expires (max +1h)
 *
 * Env vars (set via the Cloudflare Pages project → Settings → Environment):
 *   IMAGEKIT_PRIVATE_KEY  — required, server-only
 */

export const onRequestPost: PagesFunction<{ IMAGEKIT_PRIVATE_KEY?: string }> = async ({ env }) => {
  const privateKey = env.IMAGEKIT_PRIVATE_KEY
  if (!privateKey) {
    return new Response(JSON.stringify({ error: 'IMAGEKIT_PRIVATE_KEY not configured' }), {
      status: 503,
      headers: { 'content-type': 'application/json' },
    })
  }
  const token = crypto.randomUUID()
  const expire = Math.floor(Date.now() / 1000) + 600 // 10 minutes

  // HMAC-SHA1 via WebCrypto.
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(privateKey),
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign'],
  )
  const sigBuf = await crypto.subtle.sign('HMAC', key, enc.encode(token + expire))
  const signature = Array.from(new Uint8Array(sigBuf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')

  return new Response(JSON.stringify({ signature, expire, token }), {
    headers: {
      'content-type': 'application/json',
      'cache-control': 'no-store',
    },
  })
}

// Type stub when @cloudflare/workers-types isn't present (avoids tsc error in
// the journal app's regular tsconfig — the function file is only typechecked
// at Pages build time).
type PagesFunction<Env = unknown> = (ctx: {
  request: Request
  env: Env
  params: Record<string, string>
  waitUntil: (p: Promise<unknown>) => void
  next: (input?: Request | string, init?: RequestInit) => Promise<Response>
  data: Record<string, unknown>
}) => Response | Promise<Response>
