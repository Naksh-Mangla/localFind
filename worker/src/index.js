class AuthError extends Error {}

// Explicit origin allowlist (best practice over wildcard '*'):
// the production frontend, its Pages preview deployments, and local dev.
// Requests without an Origin header (curl, server-to-server) keep '*'
// since they are not subject to browser same-origin policy.
const ALLOWED_ORIGINS = [
  'https://localfind.pages.dev',
  'https://localfind-app.pages.dev',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5173',
  'http://127.0.0.1:5173'
]

// Production frontends + their Pages preview deployments (*.pages.dev).
const ALLOWED_HTTPS_ROOTS = ['localfind.pages.dev', 'localfind-app.pages.dev']

function isAllowedOrigin(origin) {
  if (!origin || typeof origin !== 'string') return false
  if (ALLOWED_ORIGINS.includes(origin)) return true
  try {
    const u = new URL(origin)
    return u.protocol === 'https:' && ALLOWED_HTTPS_ROOTS.some((root) => u.hostname === root || u.hostname.endsWith(`.${root}`))
  } catch {
    return false
  }
}

const corsHeaders = (request) => {
  const base = {
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, If-None-Match, X-Admin-Token, Cache-Control, Pragma',
    'Access-Control-Expose-Headers': 'ETag, Cache-Control',
    'Access-Control-Max-Age': '86400'
  }
  const origin = request?.headers?.get('Origin')
  // No request (inner handler responses): emit NO ACAO at all. The fetch()
  // wrapper always adds the correct per-request value afterwards, so a
  // wildcard here could never leak to a rejected origin via cache or reuse.
  if (origin === undefined || origin === null) {
    return request ? { ...base, 'Access-Control-Allow-Origin': '*' } : base
  }
  // No Origin header (curl, server-to-server): wildcard is safe — only
  // browsers enforce CORS, and they always send Origin on CORS requests.
  // Vary included so caches never mix this with an origin-specific entry.
  if (!origin) return { ...base, 'Access-Control-Allow-Origin': '*', 'Vary': 'Origin' }
  // Origin present: ALWAYS Vary, even on rejection — otherwise a shared
  // cache could serve one origin's CORS outcome to another.
  if (!isAllowedOrigin(origin)) return { ...base, 'Vary': 'Origin' } // browser blocks the read
  return { ...base, 'Access-Control-Allow-Origin': origin, 'Vary': 'Origin' }
}

// Applied centrally in fetch() to EVERY response (including errors and
// edge-cached hits), so no route can forget them.
const securityHeaders = () => ({
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=()'
})

const json = (data, status = 200, extraHeaders = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(), ...extraHeaders }
  })

// Bounded JSON body reader: rejects oversized payloads before they can
// exhaust the isolate's memory (DoS via giant JSON). Returns
// { body, tooLarge }. Handlers: 413 on tooLarge, 400 on null body.
async function readJsonBody(request, maxBytes = 512 * 1024) {
  try {
    const len = Number(request.headers.get('Content-Length'))
    if (Number.isFinite(len) && len > maxBytes) return { body: null, tooLarge: true }
    // Stream with an exact BYTE cap and early cancel: a huge chunked body
    // never fully lands in isolate memory. Bytes (not chars), so Hindi
    // text and emoji can't overshoot via multi-byte UTF-8.
    if (request.body) {
      const reader = request.body.getReader()
      const chunks = []
      let total = 0
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        total += value.byteLength
        if (total > maxBytes) {
          try { await reader.cancel() } catch {}
          return { body: null, tooLarge: true }
        }
        chunks.push(value)
      }
      const bytes = new Uint8Array(total)
      let off = 0
      for (const c of chunks) { bytes.set(c, off); off += c.byteLength }
      try {
        return { body: JSON.parse(new TextDecoder().decode(bytes)), tooLarge: false }
      } catch {
        return { body: null, tooLarge: false }
      }
    }
    const text = await request.text()
    if (new TextEncoder().encode(text).length > maxBytes) return { body: null, tooLarge: true }
    try {
      return { body: JSON.parse(text), tooLarge: false }
    } catch {
      return { body: null, tooLarge: false }
    }
  } catch {
    return { body: null, tooLarge: false }
  }
}

const BODY_TOO_LARGE = () => json({ error: 'Request body too large' }, 413)

// Per-user daily write quotas (anti-spam / anti-bot backstop). Generous
// limits no legitimate user will touch; scripts hit a wall fast.
// Scopes: shop_create 5, product_write 100, review_write 20, track 1000,
// upload 50 — per Firebase UID per UTC day.
async function checkWriteQuota(env, userId, scope, limit) {
  try {
    const today = new Date().toISOString().slice(0, 10)
    const row = await env.DB.prepare(
      `INSERT INTO write_quota (user_id, scope, day, count)
       VALUES (?, ?, ?, 1)
       ON CONFLICT(user_id, scope, day) DO UPDATE SET count = write_quota.count + 1
       RETURNING count`
    ).bind(userId, scope, today).first()
    return (Number(row?.count) || 1) <= limit
  } catch {
    // Pre-migration (no table): fail open for availability; the migration
    // applies the real protection.
    return true
  }
}

function quotaExceededResponse() {
  const now = new Date()
  const retryAfter = Math.max(60, Math.ceil((Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1) - now.getTime()) / 1000))
  return json({ error: 'Daily limit reached. Try again tomorrow.' }, 429, { 'Retry-After': String(retryAfter), 'Cache-Control': 'no-store' })
}

const b64UrlToBytes = (input) => {
  let pad = input.replace(/-/g, '+').replace(/_/g, '/')
  while (pad.length % 4) pad += '='
  const bin = atob(pad)
  return Uint8Array.from(bin, (c) => c.charCodeAt(0))
}

const decodePayload = (payloadB64) =>
  JSON.parse(new TextDecoder().decode(b64UrlToBytes(payloadB64)))

// In-isolate JWKS cache: avoids hitting Google's JWKS endpoint on every request.
// Firebase rotates keys rarely (~24h+), so a 1h TTL is safe and keeps auth latency low.
let jwksCache = { keys: null, fetchedAt: 0 }
const JWKS_TTL_MS = 60 * 60 * 1000

async function getFirebaseJwks() {
  const now = Date.now()
  if (jwksCache.keys && now - jwksCache.fetchedAt < JWKS_TTL_MS) {
    return jwksCache.keys
  }
  const jwksUrl = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'
  const res = await fetch(jwksUrl)
  if (!res.ok) throw new Error('Failed to fetch Firebase JWKS keys')
  const data = await res.json()
  const keys = data.keys || []
  if (!keys.length) throw new Error('Empty JWKS response')
  jwksCache = { keys, fetchedAt: now }
  return keys
}

async function verifyFirebaseIdToken(authHeader, env) {
  if (!authHeader?.startsWith('Bearer ')) throw new AuthError('Missing bearer token')
  const token = authHeader.slice(7)
  const [headerB64, payloadB64, signatureB64] = token.split('.')
  if (!headerB64 || !payloadB64 || !signatureB64) throw new AuthError('Malformed token')

  let header, payload
  try {
    header = decodePayload(headerB64)
    payload = decodePayload(payloadB64)
  } catch {
    throw new AuthError('Malformed token encoding')
  }

  // Only accept the algorithm Firebase actually signs with (prevents alg-confusion attacks)
  if (header.alg !== 'RS256') throw new AuthError('Unsupported token algorithm')

  const projectId = env.FIREBASE_PROJECT_ID || 'localfind-2012'

  // Required claims: exp, iat, aud, iss, sub — a missing claim must fail closed
  if (!payload.exp || typeof payload.exp !== 'number' || payload.exp * 1000 < Date.now()) {
    throw new AuthError('Token expired or missing expiry')
  }
  if (!payload.iat || typeof payload.iat !== 'number') throw new AuthError('Missing issued-at claim')
  if (!payload.aud || payload.aud !== projectId) throw new AuthError('Invalid audience')
  if (!payload.iss || payload.iss !== `https://securetoken.google.com/${projectId}`) {
    throw new AuthError('Invalid issuer')
  }
  if (!payload.sub || typeof payload.sub !== 'string') throw new AuthError('Missing subject claim')

  const keys = await getFirebaseJwks()
  const jwk = keys.find((k) => k.kid === header.kid)
  if (!jwk) throw new AuthError('Unknown signing key')

  const cryptoKey = await crypto.subtle.importKey(
    'jwk',
    {
      kty: jwk.kty,
      n: jwk.n,
      e: jwk.e,
      alg: 'RS256',
      ext: true
    },
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify']
  )

  const valid = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    b64UrlToBytes(signatureB64),
    new TextEncoder().encode(`${headerB64}.${payloadB64}`)
  )

  if (!valid) throw new AuthError('Invalid token signature')

  // Bot-spam gate: this app signs in with Google popup only. Anonymous
  // tokens (mass-minted by scripts via the public Auth REST endpoint) get
  // no write access. Checked AFTER signature verification — never trust
  // claims from an unverified token.
  const provider = payload.firebase?.sign_in_provider
  if (provider === 'anonymous') throw new AuthError('Anonymous sessions cannot write')
  return payload
}

// ---------- Firebase App Check (bot / script abuse gate) ----------
//
// Optional hardening layer: proves the request came from YOUR app (reCAPTCHA
// attestation), not a script with a stolen public API key. OFF by default
// (zero behavior change). To activate:
//   1. Firebase console → App Check → register the web app (reCAPTCHA v3 key).
//   2. Frontend: initialize App Check + attach token as X-Firebase-AppCheck.
//   3. wrangler secret put APPCHECK_ENFORCE = 1 (value must be exactly "1").
// Until then every check below is a no-op.
let appCheckJwksCache = { keys: null, fetchedAt: 0 }

async function getAppCheckJwks() {
  const now = Date.now()
  if (appCheckJwksCache.keys && now - appCheckJwksCache.fetchedAt < JWKS_TTL_MS) {
    return appCheckJwksCache.keys
  }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 8000)
  try {
    const res = await fetch('https://firebaseappcheck.googleapis.com/v1/jwks', { signal: controller.signal })
    if (!res.ok) throw new Error('Failed to fetch App Check JWKS')
    const data = await res.json()
    const keys = data.keys || []
    if (!keys.length) throw new Error('Empty App Check JWKS response')
    appCheckJwksCache = { keys, fetchedAt: now }
    return keys
  } finally {
    clearTimeout(timer)
  }
}

async function verifyAppCheckToken(token, env) {
  const parts = typeof token === 'string' ? token.split('.') : []
  if (parts.length !== 3) throw new AuthError('Invalid App Check token')
  const [headerB64, payloadB64, signatureB64] = parts
  let header, payload
  try {
    header = decodePayload(headerB64)
    payload = decodePayload(payloadB64)
  } catch {
    throw new AuthError('Malformed App Check token')
  }
  if (header.alg !== 'RS256' || (header.typ && header.typ !== 'JWT')) throw new AuthError('Unsupported App Check token')
  if (!payload.exp || typeof payload.exp !== 'number' || payload.exp * 1000 < Date.now()) {
    throw new AuthError('Expired App Check token')
  }
  if (payload.iss !== 'https://firebaseappcheck.googleapis.com/') throw new AuthError('Invalid App Check issuer')
  // Audience is the Firebase project (string or ["projects/<number>", ...] form).
  const projectId = env.FIREBASE_PROJECT_ID || 'localfind-2012'
  const aud = payload.aud
  const audOk = typeof aud === 'string'
    ? (aud === projectId || aud.startsWith('projects/'))
    : Array.isArray(aud) && aud.some((a) => a === projectId || (typeof a === 'string' && a.startsWith('projects/')))
  if (!audOk) throw new AuthError('Invalid App Check audience')

  const keys = await getAppCheckJwks()
  const jwk = keys.find((k) => !header.kid || k.kid === header.kid)
  if (!jwk) throw new AuthError('Unknown App Check signing key')
  const cryptoKey = await crypto.subtle.importKey(
    'jwk',
    { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: 'RS256', ext: true },
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify']
  )
  const valid = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    b64UrlToBytes(signatureB64),
    new TextEncoder().encode(`${headerB64}.${payloadB64}`)
  )
  if (!valid) throw new AuthError('Invalid App Check signature')
  return payload
}

// No-op unless APPCHECK_ENFORCE === '1'. Applied to state-changing API
// calls only (reads stay open); admin login is exempt so a misconfigured
// flag can never lock out password recovery.
async function enforceAppCheck(request, env, url) {
  if (env.APPCHECK_ENFORCE !== '1') return
  const method = request.method.toUpperCase()
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return
  if (url.pathname === '/api/admin/login') return
  const token = request.headers.get('X-Firebase-AppCheck')
  if (!token) throw new AuthError('App Check attestation required')
  await verifyAppCheckToken(token, env)
}

// ---------- Input sanitization helpers ----------

const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/

// Closed category vocabulary (mirrors BuyerDiscover CATEGORIES + merchant
// form). Free-text categories let junk/duplicate spellings fragment feeds,
// filters, and analytics — reject anything outside the list.
const ALLOWED_CATEGORIES = ['General', 'Handmade', 'Groceries', 'Fashion', 'Electronics', 'Sale']

function sanitizeCategory(value) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim().slice(0, 40)
  if (!trimmed) return null
  const hit = ALLOWED_CATEGORIES.find((c) => c.toLowerCase() === trimmed.toLowerCase())
  return hit || null
}

const cleanText = (value, maxLen) => {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed.slice(0, maxLen) : null
}

// Allow only http(s) links (blocks javascript:/data:/vbscript: injection stored in DB)
function sanitizeHttpUrl(value, maxLen = 2048) {
  if (!value || typeof value !== 'string') return null
  const trimmed = value.trim().slice(0, maxLen)
  if (!trimmed) return null
  try {
    const url = new URL(trimmed)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null
  } catch {
    return null
  }
}

// Product photos may be remote links OR inline compressed data URLs generated by the app.
// Accept http(s) and data:image/* (base64) only, with a size ceiling to prevent DB bloat.
const MAX_IMAGE_DATA_URL_CHARS = 500_000 // ~365 KB binary

function sanitizeImageUrl(value) {
  if (!value || typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  if (trimmed.startsWith('data:image/')) {
    // Reject oversized payloads instead of truncating (truncation corrupts base64)
    if (trimmed.length > MAX_IMAGE_DATA_URL_CHARS) return null
    if (/^data:image\/(?:png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(trimmed)) {
      return trimmed
    }
    return null
  }
  return sanitizeHttpUrl(trimmed)
}

function sanitizeTime(value, fallback) {
  if (typeof value === 'string' && TIME_REGEX.test(value)) return value
  return fallback
}

function sanitizeDiscount(value) {
  const num = Number(value)
  if (!Number.isFinite(num)) return 0
  return Math.min(90, Math.max(0, Math.round(num)))
}

function sanitizeFlashEndsAt(value) {
  if (!value || typeof value !== 'string') return null
  const ms = Date.parse(value)
  if (!Number.isFinite(ms)) return null
  return new Date(ms).toISOString()
}

function sanitizeRating(value) {
  const num = Number(value)
  if (!Number.isFinite(num)) return null
  const rounded = Math.round(num)
  if (rounded < 1 || rounded > 5) return null
  return rounded
}

// ---------- Timed-ban helpers ----------
// Bans NEVER delete anything — banned shops/items are only hidden from public
// reads and blocked from writes. An expired ban auto-restores everywhere with
// no cron job: every check below treats past banned_until as unbanned.
function isEffectivelyBanned(shop) {
  if (!shop || !shop.is_banned) return false
  if (!shop.banned_until) return true // indefinite ban
  const ms = Date.parse(shop.banned_until)
  return !Number.isFinite(ms) || ms > Date.now()
}

function banForbiddenResponse(shop) {
  const until = shop?.banned_until && Number.isFinite(Date.parse(shop.banned_until))
    ? ` (until ${new Date(shop.banned_until).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })})`
    : ''
  return json({
    error: `Your shop has been banned by admin. Reason: ${shop?.ban_reason || 'Violation of community policies'}${until}`
  }, 403)
}

// SQL fragment matching only effectively-banned shops (table alias configurable)
const EFFECTIVELY_BANNED_SQL = (alias) =>
  `(${alias}.is_banned = 1 AND (${alias}.banned_until IS NULL OR ${alias}.banned_until > strftime('%Y-%m-%dT%H:%M:%fZ', 'now')))`

// ---------- Shop badge & milestone system (mirrors src/utils/shopBadges.js) ----------
// Levels 1-4 are automatic from five-star review counts. Level 5 (Hero) is a pure
// admin override: the flag alone grants it, no review threshold. Server is truth.
function calculateBadgeLevel(fiveStarCount, isHeroShop) {
  if (isHeroShop) return 5
  const count = Number(fiveStarCount) || 0
  if (count >= 200) return 4
  if (count >= 50) return 3
  if (count >= 5) return 2
  return 1
}

// Recount five-star reviews for a shop, persist badge_level if it changed.
// Returns { fiveStarCount, prevLevel, level, unlocked } or null if shop missing.
async function refreshShopBadge(env, shopId) {
  const row = await env.DB.prepare(
    `SELECT
       (SELECT COUNT(*) FROM reviews WHERE shop_id = ? AND rating = 5) AS five,
       badge_level AS lvl,
       is_hero_shop AS hero
     FROM shops WHERE id = ?`
  ).bind(shopId, shopId).first()
  if (!row) return null
  const prev = Number(row.lvl) || 1
  const next = calculateBadgeLevel(Number(row.five) || 0, Boolean(row.hero))
  if (next !== prev) {
    await env.DB.prepare('UPDATE shops SET badge_level = ? WHERE id = ?').bind(next, shopId).run()
  }
  return { fiveStarCount: Number(row.five) || 0, prevLevel: prev, level: next, unlocked: next > prev }
}

// ---------- Subscription tier system ----------
// Tier limits: product count, flash deals per month, image upload type, badge cap.
// Server is the source of truth — frontend mirrors these for UX but never bypasses.
const TIER_LIMITS = {
  free:    { maxProducts: 10, maxFlashDealsPerMonth: 0,  maxBadgeLevel: 2, allowImageUpload: false, allowR2Upload: false, label: 'Free' },
  starter: { maxProducts: 50, maxFlashDealsPerMonth: 5,  maxBadgeLevel: 3, allowImageUpload: true,  allowR2Upload: false, label: 'Starter' },
  pro:     { maxProducts: Infinity, maxFlashDealsPerMonth: Infinity, maxBadgeLevel: 4, allowImageUpload: true, allowR2Upload: true, label: 'Pro' },
  hero:    { maxProducts: Infinity, maxFlashDealsPerMonth: Infinity, maxBadgeLevel: 5, allowImageUpload: true, allowR2Upload: true, label: 'Hero' }
}

// Kill-switch: tier LIMITS enforce only once a real payment/upgrade flow exists.
// Until then every merchant keeps full free access (pre-subscription behavior:
// unlimited products, flash deals and phone-photo uploads). Columns/counters
// stay in place so launch is a one-line flip.
const SUBSCRIPTION_ENFORCEMENT_ENABLED = false

// Resolve effective tier: if subscription has expired, treat as 'free'.
function getEffectiveTier(shop) {
  if (!shop) return 'free'
  const tier = shop.subscription_tier || 'free'
  if (tier === 'free') return 'free'
  // Check expiration
  if (shop.subscription_expires_at) {
    const expiresMs = Date.parse(shop.subscription_expires_at)
    if (Number.isFinite(expiresMs) && expiresMs < Date.now()) return 'free'
  }
  return tier
}

function getTierLimits(tier) {
  return TIER_LIMITS[tier] || TIER_LIMITS.free
}

// Check if flash deal monthly counter needs resetting (new calendar month)
function shouldResetFlashCounter(resetAtISO) {
  if (!resetAtISO) return true
  const resetDate = new Date(resetAtISO)
  const now = new Date()
  return resetDate.getUTCFullYear() !== now.getUTCFullYear() || resetDate.getUTCMonth() !== now.getUTCMonth()
}


// ---------- Request handlers ----------

async function handleCreateShop(request, env, user) {
  if (!(await checkWriteQuota(env, user.sub, 'shop_create', 5))) return quotaExceededResponse()
  const { body, tooLarge } = await readJsonBody(request, 1024 * 1024)
  if (tooLarge) return BODY_TOO_LARGE()
  if (!body) return json({ error: 'Invalid JSON body' }, 400)

  // Check if existing shop for this owner is banned (expiry-aware: expired bans auto-restore)
  const existingShop = await env.DB.prepare('SELECT id, is_banned, banned_until, ban_reason FROM shops WHERE owner_id = ?').bind(user.sub).first()
  if (isEffectivelyBanned(existingShop)) {
    return banForbiddenResponse(existingShop)
  }

  const shop_name = cleanText(body.shop_name, 80)
  const whatsapp_number = typeof body.whatsapp_number === 'string' ? body.whatsapp_number.replace(/[^0-9]/g, '') : ''
  const lat = Number(body.lat)
  const lng = Number(body.lng)

  if (!shop_name || !whatsapp_number) return json({ error: 'shop_name and whatsapp_number are required' }, 400)
  if (whatsapp_number.length !== 10) return json({ error: 'whatsapp_number must be exactly 10 digits' }, 400)
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    return json({ error: 'lat must be a number between -90 and 90' }, 400)
  }
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
    return json({ error: 'lng must be a number between -180 and 180' }, 400)
  }

  // Owner email from the verified Firebase token (for admin contact list).
  // Phone-auth users have no email — stored as NULL, never blocks saving.
  const ownerEmail = typeof user.email === 'string' && user.email.includes('@')
    ? user.email.trim().slice(0, 120)
    : null

  // Atomic upsert with RETURNING id: eliminates redundant follow-up SELECT round-trip
  const id = crypto.randomUUID()
  const row = await env.DB.prepare(
    `INSERT INTO shops (id, owner_id, owner_email, shop_name, owner_name, description, opening_time, closing_time, whatsapp_number, lat, lng, address_text)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(owner_id) DO UPDATE SET
       owner_email = COALESCE(excluded.owner_email, shops.owner_email),
       shop_name   = excluded.shop_name,
       owner_name  = excluded.owner_name,
       description = excluded.description,
       opening_time = excluded.opening_time,
       closing_time = excluded.closing_time,
       whatsapp_number = excluded.whatsapp_number,
       lat = excluded.lat,
       lng = excluded.lng,
       address_text = excluded.address_text
     RETURNING id`
  ).bind(
    id,
    user.sub,
    ownerEmail,
    shop_name,
    cleanText(body.owner_name, 80),
    cleanText(body.description, 500),
    sanitizeTime(body.opening_time, '09:00'),
    sanitizeTime(body.closing_time, '21:00'),
    whatsapp_number,
    lat,
    lng,
    cleanText(body.address_text, 300)
  ).first()

  if (!row?.id) return json({ error: 'Failed to save shop' }, 500)
  const updated = row.id !== id
  return json({ id: row.id, ...(updated ? { updated: true } : { created: true }) })
}

async function handleGetMyShop(env, user) {
  // Badge columns ride along via SELECT *; five-star count added for the contract.
  // Falls back gracefully on DBs where the reviews table is not yet migrated.
  try {
    const shop = await env.DB.prepare(
      `SELECT *,
         (SELECT COUNT(*) FROM reviews r WHERE r.shop_id = shops.id AND r.rating = 5) AS five_star_reviews_count
       FROM shops WHERE owner_id = ?`
    ).bind(user.sub).first()
    return json({ shop: shop || null })
  } catch (err) {
    if (String(err.message || '').includes('no such table')) {
      const shop = await env.DB.prepare('SELECT * FROM shops WHERE owner_id = ?').bind(user.sub).first()
      return json({ shop: shop ? { ...shop, five_star_reviews_count: 0 } : null })
    }
    throw err
  }
}

async function handleCreateProduct(request, env, user) {
  if (!(await checkWriteQuota(env, user.sub, 'product_write', 100))) return quotaExceededResponse()
  const { body, tooLarge } = await readJsonBody(request, 1024 * 1024)
  if (tooLarge) return BODY_TOO_LARGE()
  if (!body) return json({ error: 'Invalid JSON body' }, 400)

  const shop_id = cleanText(body.shop_id, 64)
  const name = cleanText(body.name, 120)
  const category = sanitizeCategory(body.category)
  const price = Number(body.price)

  if (!shop_id || !name || !category) return json({ error: 'shop_id, name and valid category are required' }, 400)
  if (!Number.isFinite(price) || price < 0 || price > 10_000_000) {
    return json({ error: 'price must be a valid positive number' }, 400)
  }

  // Fast ownership and ban check via unique index
  const shop = await env.DB.prepare('SELECT id, is_banned, banned_until, ban_reason, subscription_tier, subscription_expires_at, flash_deals_used_this_month, flash_deals_reset_at FROM shops WHERE id = ? AND owner_id = ?').bind(shop_id, user.sub).first()
  if (!shop) return json({ error: 'Forbidden: shop not found or belongs to another user' }, 403)
  if (isEffectivelyBanned(shop)) {
    return banForbiddenResponse(shop)
  }

  // ---------- Subscription tier enforcement ----------
  const tier = getEffectiveTier(shop)
  const limits = getTierLimits(tier)

  // 1. Check product count limit
  const productCount = await env.DB.prepare('SELECT COUNT(*) AS cnt FROM products WHERE shop_id = ?').bind(shop_id).first()
  if (SUBSCRIPTION_ENFORCEMENT_ENABLED && (productCount?.cnt || 0) >= limits.maxProducts) {
    return json({
      error: `Product limit reached for your ${limits.label} plan (${limits.maxProducts} products). Upgrade to add more.`,
      tier_limit: true,
      current_tier: tier,
      max_products: limits.maxProducts
    }, 403)
  }

  const isFlashDeal = body.is_flash_deal ? 1 : 0

  // 2. Check flash deal allowance
  if (isFlashDeal && SUBSCRIPTION_ENFORCEMENT_ENABLED) {
    if (limits.maxFlashDealsPerMonth === 0) {
      return json({
        error: 'Flash Deals are not available on the Free plan. Upgrade to Starter (₹149/month) to activate deals.',
        tier_limit: true,
        current_tier: tier,
        upgrade_needed: 'starter'
      }, 403)
    }
    // Reset monthly counter if new month
    let flashUsed = Number(shop.flash_deals_used_this_month) || 0
    if (shouldResetFlashCounter(shop.flash_deals_reset_at)) {
      flashUsed = 0
      await env.DB.prepare("UPDATE shops SET flash_deals_used_this_month = 0, flash_deals_reset_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?").bind(shop_id).run()
    }
    if (Number.isFinite(limits.maxFlashDealsPerMonth) && flashUsed >= limits.maxFlashDealsPerMonth) {
      return json({
        error: `Monthly flash deal limit reached (${limits.maxFlashDealsPerMonth} per month on ${limits.label} plan). Upgrade to Pro for unlimited deals.`,
        tier_limit: true,
        current_tier: tier,
        flash_deals_used: flashUsed,
        max_flash_deals: limits.maxFlashDealsPerMonth
      }, 403)
    }
  }

  // 3. Check image upload permission (base64 data URLs)
  const imageUrl = sanitizeImageUrl(body.image_url)
  if (SUBSCRIPTION_ENFORCEMENT_ENABLED && imageUrl && imageUrl.startsWith('data:image/') && !limits.allowImageUpload) {
    return json({
      error: 'Image upload is not available on the Free plan. Upgrade to Starter (₹149/month) or paste an external image URL instead.',
      tier_limit: true,
      current_tier: tier,
      upgrade_needed: 'starter'
    }, 403)
  }

  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  const res = await env.DB.prepare(
    `INSERT INTO products (id, shop_id, name, price, category, image_url, is_affiliate_fallback, affiliate_link, is_flash_deal, flash_deal_discount, flash_deal_ends_at, version, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
     RETURNING id`
  ).bind(
    id,
    shop_id,
    name,
    price,
    category,
    imageUrl,
    body.is_affiliate_fallback ? 1 : 0,
    sanitizeHttpUrl(body.affiliate_link),
    isFlashDeal,
    isFlashDeal ? sanitizeDiscount(body.flash_deal_discount) : 0,
    isFlashDeal ? sanitizeFlashEndsAt(body.flash_deal_ends_at) : null,
    now
  ).first()

  if (!res?.id) return json({ error: 'Insert failed' }, 500)

  // Increment flash deal counter if this was a flash deal
  if (isFlashDeal && SUBSCRIPTION_ENFORCEMENT_ENABLED) {
    await env.DB.prepare('UPDATE shops SET flash_deals_used_this_month = flash_deals_used_this_month + 1 WHERE id = ?').bind(shop_id).run()
  }

  return json({ id: res.id }, 201)
}

async function handleUpdateProduct(request, env, user) {
  if (!(await checkWriteQuota(env, user.sub, 'product_write', 100))) return quotaExceededResponse()
  const { body, tooLarge } = await readJsonBody(request, 1024 * 1024)
  if (tooLarge) return BODY_TOO_LARGE()
  if (!body) return json({ error: 'Invalid JSON body' }, 400)

  // Ban check for shopkeeper (expired bans auto-restore)
  const shopCheck = await env.DB.prepare('SELECT id, is_banned, banned_until, ban_reason, subscription_tier, subscription_expires_at, flash_deals_used_this_month, flash_deals_reset_at FROM shops WHERE owner_id = ?').bind(user.sub).first()
  if (isEffectivelyBanned(shopCheck)) {
    return banForbiddenResponse(shopCheck)
  }

  const id = cleanText(body.id, 64)
  const name = cleanText(body.name, 120)
  const category = sanitizeCategory(body.category)
  const price = Number(body.price)

  if (!id || !name || !category) return json({ error: 'id, name and valid category are required' }, 400)
  if (!Number.isFinite(price) || price < 0 || price > 10_000_000) {
    return json({ error: 'price must be a valid positive number' }, 400)
  }

  const isFlashDeal = body.is_flash_deal ? 1 : 0

  // ---------- Subscription tier enforcement for updates ----------
  const tier = getEffectiveTier(shopCheck)
  const limits = getTierLimits(tier)

  // Check if the product is being NEWLY promoted to a flash deal
  if (isFlashDeal && SUBSCRIPTION_ENFORCEMENT_ENABLED) {
    // Check if product was already a flash deal (avoid double-counting)
    const existing = await env.DB.prepare('SELECT is_flash_deal FROM products WHERE id = ? AND shop_id = ?').bind(id, shopCheck.id).first()
    const wasAlreadyFlash = existing && existing.is_flash_deal

    if (!wasAlreadyFlash) {
      if (limits.maxFlashDealsPerMonth === 0) {
        return json({
          error: 'Flash Deals are not available on the Free plan. Upgrade to Starter (₹149/month) to activate deals.',
          tier_limit: true,
          current_tier: tier,
          upgrade_needed: 'starter'
        }, 403)
      }
      let flashUsed = Number(shopCheck.flash_deals_used_this_month) || 0
      if (shouldResetFlashCounter(shopCheck.flash_deals_reset_at)) {
        flashUsed = 0
        await env.DB.prepare("UPDATE shops SET flash_deals_used_this_month = 0, flash_deals_reset_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?").bind(shopCheck.id).run()
      }
      if (Number.isFinite(limits.maxFlashDealsPerMonth) && flashUsed >= limits.maxFlashDealsPerMonth) {
        return json({
          error: `Monthly flash deal limit reached (${limits.maxFlashDealsPerMonth} per month on ${limits.label} plan). Upgrade to Pro for unlimited deals.`,
          tier_limit: true,
          current_tier: tier,
          flash_deals_used: flashUsed,
          max_flash_deals: limits.maxFlashDealsPerMonth
        }, 403)
      }
    }
  }

  // Check image upload permission
  const imageUrl = sanitizeImageUrl(body.image_url)
  if (SUBSCRIPTION_ENFORCEMENT_ENABLED && imageUrl && imageUrl.startsWith('data:image/') && !limits.allowImageUpload) {
    return json({
      error: 'Image upload is not available on the Free plan. Upgrade to Starter (₹149/month) or paste an external image URL instead.',
      tier_limit: true,
      current_tier: tier,
      upgrade_needed: 'starter'
    }, 403)
  }

  // Atomic single-trip update with subquery ownership authorization
  const updatedRow = await env.DB.prepare(
    `UPDATE products
     SET name = ?, price = ?, category = ?, image_url = ?, is_affiliate_fallback = ?, affiliate_link = ?,
         is_flash_deal = ?, flash_deal_discount = ?, flash_deal_ends_at = ?,
         version = COALESCE(version, 1) + 1,
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
     WHERE id = ? AND shop_id IN (SELECT id FROM shops WHERE owner_id = ?)
     RETURNING id`
  ).bind(
    name,
    price,
    category,
    imageUrl,
    body.is_affiliate_fallback ? 1 : 0,
    sanitizeHttpUrl(body.affiliate_link),
    isFlashDeal,
    isFlashDeal ? sanitizeDiscount(body.flash_deal_discount) : 0,
    isFlashDeal ? sanitizeFlashEndsAt(body.flash_deal_ends_at) : null,
    id,
    user.sub
  ).first()

  if (!updatedRow) {
    const exists = await env.DB.prepare('SELECT id FROM products WHERE id = ?').bind(id).first()
    if (!exists) return json({ error: 'Product not found' }, 404)
    return json({ error: 'Forbidden: product belongs to another shopkeeper' }, 403)
  }

  // Increment flash deal counter if this was a NEW flash deal activation
  if (isFlashDeal && SUBSCRIPTION_ENFORCEMENT_ENABLED) {
    const existingProduct = await env.DB.prepare('SELECT is_flash_deal FROM products WHERE id = ?').bind(id).first()
    // The update already happened, so check the old value via the fact that we reach here
    await env.DB.prepare('UPDATE shops SET flash_deals_used_this_month = flash_deals_used_this_month + 1 WHERE id = ? AND id IN (SELECT id FROM shops WHERE owner_id = ?)').bind(shopCheck.id, user.sub).run()
  }

  return json({ success: true })
}

async function handleDeleteProduct(request, env, user, url) {
  // Ban check for shopkeeper (expired bans auto-restore)
  const bannedCheck = await env.DB.prepare('SELECT id, is_banned, banned_until, ban_reason FROM shops WHERE owner_id = ?').bind(user.sub).first()
  if (isEffectivelyBanned(bannedCheck)) {
    return banForbiddenResponse(bannedCheck)
  }

  const id = url.searchParams.get('id')
  if (!id || id.length > 64) return json({ error: 'Product id parameter is required' }, 400)

  // Atomic single-trip delete with subquery ownership authorization
  const deletedRow = await env.DB.prepare(
    `DELETE FROM products
     WHERE id = ? AND shop_id IN (SELECT id FROM shops WHERE owner_id = ?)
     RETURNING id`
  ).bind(id, user.sub).first()

  if (!deletedRow) {
    const exists = await env.DB.prepare('SELECT id FROM products WHERE id = ?').bind(id).first()
    if (!exists) return json({ error: 'Product not found' }, 404)
    return json({ error: 'Forbidden: product belongs to another shopkeeper' }, 403)
  }

  return json({ success: true })
}

async function handleSaveReview(request, env, user) {
  if (!(await checkWriteQuota(env, user.sub, 'review_write', 20))) return quotaExceededResponse()
  const { body, tooLarge } = await readJsonBody(request)
  if (tooLarge) return BODY_TOO_LARGE()
  if (!body) return json({ error: 'Invalid JSON body' }, 400)

  const shop_id = cleanText(body.shop_id, 64)
  const rating = sanitizeRating(body.rating)
  const comment = cleanText(body.comment, 500)
  const user_name = cleanText(body.user_name || user.name || 'Neighborhood Buyer', 80)

  if (!shop_id) return json({ error: 'shop_id is required' }, 400)
  if (!rating) return json({ error: 'rating must be an integer between 1 and 5' }, 400)

  // Verify shop exists
  const shop = await env.DB.prepare('SELECT id, owner_id FROM shops WHERE id = ?').bind(shop_id).first()
  if (!shop) return json({ error: 'Shop not found' }, 404)

  // Anti-fraud: Shop owners cannot review their own shop
  if (shop.owner_id === user.sub) {
    return json({ error: 'Shop owners cannot review their own shop' }, 403)
  }

  const id = crypto.randomUUID()
  const row = await env.DB.prepare(
    `INSERT INTO reviews (id, shop_id, user_id, user_name, rating, comment, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(user_id, shop_id) DO UPDATE SET
       user_name = excluded.user_name,
       rating = excluded.rating,
       comment = excluded.comment,
       updated_at = datetime('now')
     RETURNING id, rating, comment, updated_at`
  ).bind(id, shop_id, user.sub, user_name, rating, comment || null).first()

  // Recalculate the shop's badge level (auto levels 1-4; may unlock a milestone)
  const badge = await refreshShopBadge(env, shop_id).catch((badgeErr) => { console.warn('Badge refresh failed:', badgeErr?.message); return null })

  return json({ success: true, review: row, badge })
}

async function handleGetShopReviews(env, url) {
  const shopId = url.searchParams.get('shop_id')
  if (!shopId) return json({ error: 'shop_id is required' }, 400)

  const cleanShopId = cleanText(shopId, 64)

  const { results: reviews } = await env.DB.prepare(
    `SELECT id, shop_id, user_id, user_name, rating, comment, created_at, updated_at
     FROM reviews
     WHERE shop_id = ?
     ORDER BY updated_at DESC
     LIMIT 50`
  ).bind(cleanShopId).all()

  const stats = await env.DB.prepare(
    `SELECT COUNT(*) AS total_reviews,
            ROUND(AVG(rating), 1) AS avg_rating,
            SUM(CASE WHEN rating = 5 THEN 1 ELSE 0 END) AS stars_5,
            SUM(CASE WHEN rating = 4 THEN 1 ELSE 0 END) AS stars_4,
            SUM(CASE WHEN rating = 3 THEN 1 ELSE 0 END) AS stars_3,
            SUM(CASE WHEN rating = 2 THEN 1 ELSE 0 END) AS stars_2,
            SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END) AS stars_1
     FROM reviews
     WHERE shop_id = ?`
  ).bind(cleanShopId).first()

  return json({
    reviews: reviews || [],
    stats: {
      total_reviews: stats?.total_reviews || 0,
      avg_rating: stats?.avg_rating || null,
      breakdown: {
        5: stats?.stars_5 || 0,
        4: stats?.stars_4 || 0,
        3: stats?.stars_3 || 0,
        2: stats?.stars_2 || 0,
        1: stats?.stars_1 || 0
      }
    }
  })
}

async function handleDeleteReview(request, env, user, url) {
  const shopId = url.searchParams.get('shop_id')
  if (!shopId) return json({ error: 'shop_id is required' }, 400)

  const cleanShopId = cleanText(shopId, 64)
  await env.DB.prepare('DELETE FROM reviews WHERE shop_id = ? AND user_id = ?').bind(cleanShopId, user.sub).run()

  // Recalculate in case the removal drops the shop below a badge threshold
  const badge = await refreshShopBadge(env, cleanShopId).catch((badgeErr) => { console.warn('Badge refresh failed:', badgeErr?.message); return null })

  return json({ success: true, badge })
}

async function handleListShops(env) {
  // Expired bans auto-restore: banned_until in the past counts as unbanned.
  // Badge fields included per the frontend contract (no owner_email here: public endpoint, no PII).
  try {
    const { results } = await env.DB.prepare(
      `SELECT id, owner_id, shop_name, owner_name, description, opening_time, closing_time, whatsapp_number, lat, lng, address_text, created_at,
         badge_level, is_hero_shop,
         (SELECT COUNT(*) FROM reviews r WHERE r.shop_id = shops.id AND r.rating = 5) AS five_star_reviews_count,
         (SELECT ROUND(AVG(r.rating), 1) FROM reviews r WHERE r.shop_id = shops.id) AS avg_rating,
         (SELECT COUNT(r.id) FROM reviews r WHERE r.shop_id = shops.id) AS review_count
       FROM shops
       WHERE (is_banned = 0 OR (banned_until IS NOT NULL AND banned_until <= strftime('%Y-%m-%dT%H:%M:%fZ', 'now')))
       ORDER BY created_at DESC LIMIT 200`
    ).all()
    return json({ shops: results || [] })
  } catch (err) {
    // Pre-migration DBs lack badge/review tables: legacy shape, feed must not 500
    const msg = String(err.message || '')
    if (msg.includes('no such table') || msg.includes('no such column')) {
      const { results } = await env.DB.prepare(
        `SELECT id, owner_id, shop_name, owner_name, description, opening_time, closing_time, whatsapp_number, lat, lng, address_text, created_at,
           1 AS badge_level, 0 AS is_hero_shop, 0 AS five_star_reviews_count,
           NULL AS avg_rating, 0 AS review_count
         FROM shops
         WHERE (is_banned = 0 OR (banned_until IS NOT NULL AND banned_until <= strftime('%Y-%m-%dT%H:%M:%fZ', 'now')))
         ORDER BY created_at DESC LIMIT 200`
      ).all()
      return json({ shops: results || [] })
    }
    throw err
  }
}

async function handleListProducts(env, url, request, ctx) {
  const shopId = url ? url.searchParams.get('shop_id') : null
  const category = url ? url.searchParams.get('category') : null
  const flashOnly = url ? (url.searchParams.get('flash_deals_only') === '1' || url.searchParams.get('flash_deals_only') === 'true') : false
  const since = url ? url.searchParams.get('since') : null
  const limitParam = url ? Number(url.searchParams.get('limit')) : NaN
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(500, limitParam) : 250

  const conditions = []
  const bindings = []

  if (shopId) {
    conditions.push('p.shop_id = ?')
    bindings.push(cleanText(shopId, 64))
  }
  if (category && category !== 'All') {
    conditions.push('p.category = ?')
    bindings.push(cleanText(category, 40))
  }
  if (flashOnly) {
    conditions.push("p.is_flash_deal = 1 AND (p.flash_deal_ends_at IS NULL OR p.flash_deal_ends_at > datetime('now'))")
  }
  if (since) {
    const sanitizedSince = sanitizeFlashEndsAt(since)
    if (sanitizedSince) {
      conditions.push('(p.updated_at > ? OR p.created_at > ?)')
      bindings.push(sanitizedSince, sanitizedSince)
    }
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  const query = `
    SELECT p.id, p.shop_id, p.name, p.price, p.category, p.image_url,
           p.is_affiliate_fallback, p.affiliate_link, p.is_flash_deal, p.flash_deal_discount, p.flash_deal_ends_at,
           p.version, p.updated_at, p.created_at,
           s.shop_name, s.owner_name, s.description, s.opening_time, s.closing_time, s.whatsapp_number, s.lat, s.lng, s.address_text,
           s.owner_id AS owner_id,
           s.badge_level AS badge_level,
           s.is_hero_shop AS is_hero_shop,
           (SELECT COUNT(r.id) FROM reviews r WHERE r.shop_id = p.shop_id AND r.rating = 5) AS five_star_reviews_count,
           (SELECT ROUND(AVG(r.rating), 1) FROM reviews r WHERE r.shop_id = p.shop_id) AS avg_rating,
           (SELECT COUNT(r.id) FROM reviews r WHERE r.shop_id = p.shop_id) AS review_count
     FROM products p
     JOIN shops s ON s.id = p.shop_id AND (s.is_banned = 0 OR (s.banned_until IS NOT NULL AND s.banned_until <= strftime('%Y-%m-%dT%H:%M:%fZ', 'now')))
     ${whereClause}
     ORDER BY p.created_at DESC
     LIMIT ?`
  bindings.push(limit)

  let results
  try {
    const stmt = env.DB.prepare(query)
    const res = await stmt.bind(...bindings).all()
    results = res.results || []
  } catch (err) {
    // Fallback if reviews/badge columns not yet migrated (first deploy) - don't break product feed
    const msg = String(err.message || '')
    if (msg.includes('no such table: reviews') || msg.includes('no such column')) {
      const fallbackQuery = `
        SELECT p.id, p.shop_id, p.name, p.price, p.category, p.image_url,
               p.is_affiliate_fallback, p.affiliate_link, p.is_flash_deal, p.flash_deal_discount, p.flash_deal_ends_at,
               p.version, p.updated_at, p.created_at,
               s.shop_name, s.owner_name, s.description, s.opening_time, s.closing_time, s.whatsapp_number, s.lat, s.lng, s.address_text,
               s.owner_id AS owner_id,
               1 AS badge_level,
               0 AS is_hero_shop,
               0 AS five_star_reviews_count,
               NULL AS avg_rating, 0 AS review_count
         FROM products p
         JOIN shops s ON s.id = p.shop_id AND (s.is_banned = 0 OR (s.banned_until IS NOT NULL AND s.banned_until <= strftime('%Y-%m-%dT%H:%M:%fZ', 'now')))
         ${whereClause}
         ORDER BY p.created_at DESC
         LIMIT ?`
      const stmt2 = env.DB.prepare(fallbackQuery)
      const res2 = await stmt2.bind(...bindings).all()
      results = res2.results || []
    } else {
      throw err
    }
  }

  // Determine if this is a global query eligible for Cloudflare Edge RAM & CDN caching
  const isGlobalPublicQuery = !shopId && !since && (!category || category === 'All') && !flashOnly
  const cacheControl = isGlobalPublicQuery
    ? 'public, max-age=45, s-maxage=90, stale-while-revalidate=180'
    : 'no-cache, no-store, must-revalidate'

  // Generate deterministic ETag from count + max(updated_at/created_at) across ALL rows.
  // Using results[0] is wrong: list is ORDER BY created_at, so editing a non-newest
  // product leaves results[0] unchanged and clients get a false 304.
  let latestRecord = 'empty'
  if (results.length > 0) {
    latestRecord = results.reduce((max, r) => {
      const ts = r.updated_at || r.created_at || '0'
      return ts > max ? ts : max
    }, results[0].updated_at || results[0].created_at || '0')
  }
  const etag = `W/"${results.length}-${latestRecord}"`

  // Zero-Bandwidth ETag check: Return 304 Not Modified if client catalog is already up to date
  const clientEtag = request?.headers?.get('If-None-Match')
  if (clientEtag && clientEtag === etag) {
    return new Response(null, {
      status: 304,
      headers: {
        'ETag': etag,
        'Cache-Control': cacheControl,
        ...corsHeaders()
      }
    })
  }

  const response = new Response(JSON.stringify({ products: results, app_version: '2.4.0' }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': cacheControl,
      'ETag': etag,
      ...corsHeaders()
    }
  })

  // Store in Cloudflare native edge RAM cache for subsequent hits
  if (isGlobalPublicQuery && typeof caches !== 'undefined' && caches.default && ctx?.waitUntil && request) {
    try {
      const cacheKey = new Request(url.origin + url.pathname + url.search, request)
      ctx.waitUntil(caches.default.put(cacheKey, response.clone()))
    } catch (e) {
      console.warn('Edge cache write error:', e)
    }
  }

  return response
}

// ---------- Upload handling ----------

const MAX_FILE_SIZE = 5 * 1024 * 1024

// Detect true file type from magic bytes instead of trusting the client-declared MIME type.
function sniffImageMime(bytes) {
  const b = bytes
  const startsWith = (...vals) => vals.every((v, i) => b[i] === v)
  const ascii = (offset, len) => String.fromCharCode(...b.slice(offset, offset + len))

  if (startsWith(0xff, 0xd8, 0xff)) return 'image/jpeg'
  if (startsWith(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return 'image/png'
  if (ascii(0, 6) === 'GIF87a' || ascii(0, 6) === 'GIF89a') return 'image/gif'
  if (ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WEBP') return 'image/webp'
  if (ascii(4, 4) === 'ftyp') {
    const brand = ascii(8, 4).toLowerCase()
    if (['heic', 'heix', 'hevc', 'heim', 'heis', 'hevm', 'hevs', 'mif1', 'msf1'].includes(brand)) {
      return 'image/heic'
    }
  }
  return null
}

async function handleUploadImage(request, env, user) {
  if (!(await checkWriteQuota(env, user.sub, 'upload', 50))) return quotaExceededResponse()
  if (!env.IMAGES_BUCKET) {
    return json({ error: 'R2 bucket binding "IMAGES_BUCKET" not configured on worker.' }, 500)
  }

  // Ban check for shopkeeper (expired bans auto-restore)
  const bannedCheck = await env.DB.prepare('SELECT id, is_banned, banned_until, ban_reason, subscription_tier, subscription_expires_at FROM shops WHERE owner_id = ?').bind(user.sub).first()
  if (isEffectivelyBanned(bannedCheck)) {
    return banForbiddenResponse(bannedCheck)
  }

  // R2 upload requires Pro tier or above
  const tier = getEffectiveTier(bannedCheck)
  const limits = getTierLimits(tier)
  if (!limits.allowR2Upload) {
    return json({
      error: `R2 image upload requires Pro plan (₹299/month) or higher. Your current plan: ${limits.label}. Use compressed image upload or paste an image URL instead.`,
      tier_limit: true,
      current_tier: tier,
      upgrade_needed: 'pro'
    }, 403)
  }

  const formData = await request.formData().catch(() => null)
  if (!formData) return json({ error: 'Invalid form data' }, 400)

  const file = formData.get('file')
  if (!file || typeof file === 'string') return json({ error: 'No file uploaded' }, 400)

  // Security Check 1: Max upload size limit (5 MB), enforced even if client lies about size
  // by capping how many bytes we ever read into memory.
  const cappedFile = file.slice(0, MAX_FILE_SIZE + 1)
  const bytes = new Uint8Array(await cappedFile.arrayBuffer())
  if (bytes.byteLength > MAX_FILE_SIZE) {
    return json({ error: 'File too large. Maximum allowed size is 5MB.' }, 400)
  }

  // Security Check 2: Magic-byte content sniffing — never trust the declared MIME type.
  const mimeType = sniffImageMime(bytes.slice(0, 16))
  if (!mimeType) {
    return json({ error: 'Invalid file format. Only JPEG, PNG, WEBP, GIF, and HEIC images are allowed.' }, 400)
  }

  const EXT_MAP = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'image/heic': 'heic'
  }
  const ext = EXT_MAP[mimeType]
  const key = `products/${user.sub}/${crypto.randomUUID()}.${ext}`

  await env.IMAGES_BUCKET.put(key, bytes, {
    httpMetadata: {
      contentType: mimeType
    }
  })

  const publicBase = env.R2_PUBLIC_URL || 'https://pub-r2.dev'
  const url = `${publicBase}/${key}`

  return json({ url, key }, 201)
}

// ---------- Admin authorization & Password Hashing ----------
//
// SECURITY: no secrets live in source. Set them with:
//   echo -n "<64+ random hex chars>" | npx wrangler secret put ADMIN_SECRET
//   echo -n "<first admin password>" | npx wrangler secret put ADMIN_INITIAL_PASSWORD
// ADMIN_INITIAL_PASSWORD works only until the first password hash exists
// (first-setup bootstrap), then becomes useless. Missing secrets fail closed.

// HS256 needs a long secret: require >= 32 chars, fail closed otherwise.
function getAdminSecret(env) {
  const s = env.ADMIN_SECRET
  return (typeof s === 'string' && s.length >= 32) ? s : null
}

// Constant-time string compare (prevents timing side-channels on
// password hashes and bootstrap secrets).
function timingSafeEqualStr(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false
  const enc = new TextEncoder()
  const ab = enc.encode(a)
  const bb = enc.encode(b)
  if (ab.length !== bb.length) return false
  let diff = 0
  for (let i = 0; i < ab.length; i++) diff |= ab[i] ^ bb[i]
  return diff === 0
}

function randomSaltHex(bytes = 16) {
  return Array.from(crypto.getRandomValues(new Uint8Array(bytes))).map(b => b.toString(16).padStart(2, '0')).join('')
}

// Legacy verifier: single-round SHA-256(salt:password). Weak by modern
// standards — kept only to verify old rows, then auto-upgraded to PBKDF2.
async function hashAdminPassword(password, salt) {
  const enc = new TextEncoder()
  const data = enc.encode(`${salt}:${password}`)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('')
}

// Modern KDF: PBKDF2-SHA256, 100k iterations. Stored format:
//   pbkdf2$<iterations>$<saltHex>$<hashHex>
const PBKDF2_ITERATIONS = 100000

async function hashAdminPasswordPBKDF2(password, saltHex, iterations = PBKDF2_ITERATIONS) {
  const enc = new TextEncoder()
  const saltBytes = Uint8Array.from(saltHex.match(/../g).map(h => parseInt(h, 16)))
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: saltBytes, iterations, hash: 'SHA-256' },
    keyMaterial,
    256
  )
  return Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2, '0')).join('')
}

function newPBKDF2Hash(password) {
  const saltHex = randomSaltHex()
  return hashAdminPasswordPBKDF2(password, saltHex).then(hashHex => ({
    hash: `pbkdf2$${PBKDF2_ITERATIONS}$${saltHex}$${hashHex}`,
    salt: saltHex
  }))
}

function isPBKDF2Hash(stored) {
  return typeof stored === 'string' && stored.startsWith('pbkdf2$')
}

async function verifyPBKDF2Hash(password, stored) {
  try {
    const [, iterStr, saltHex, expectedHex] = stored.split('$')
    const iterations = Number(iterStr)
    if (!Number.isFinite(iterations) || iterations < 10000 || !saltHex || !expectedHex) return false
    const computedHex = await hashAdminPasswordPBKDF2(password, saltHex, iterations)
    return timingSafeEqualStr(computedHex, expectedHex)
  } catch {
    return false
  }
}

async function signAdminToken(payload, secret) {
  const enc = new TextEncoder()
  const headerB64 = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
  const payloadB64 = btoa(JSON.stringify(payload)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
  const data = `${headerB64}.${payloadB64}`
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data))
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
  return `${data}.${sigB64}`
}

async function verifyAdminToken(token, secret) {
  if (!token || typeof token !== 'string') return null
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [headerB64, payloadB64, sigB64] = parts
  const data = `${headerB64}.${payloadB64}`
  const enc = new TextEncoder()
  try {
    const key = await crypto.subtle.importKey(
      'raw',
      enc.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    )
    let pad = sigB64.replace(/-/g, '+').replace(/_/g, '/')
    while (pad.length % 4) pad += '='
    const sigBytes = Uint8Array.from(atob(pad), c => c.charCodeAt(0))
    const valid = await crypto.subtle.verify('HMAC', key, sigBytes, enc.encode(data))
    if (!valid) return null
    let padPayload = payloadB64.replace(/-/g, '+').replace(/_/g, '/')
    while (padPayload.length % 4) padPayload += '='
    const payload = JSON.parse(atob(padPayload))
    if (payload.exp && payload.exp < Date.now()) return null
    return payload
  } catch {
    return null
  }
}

async function requireAdmin(request, env) {
  const adminHeader = request.headers.get('X-Admin-Token')
  const authHeader = request.headers.get('Authorization')

  // 1. Check custom X-Admin-Token (skipped entirely when no secret is set)
  const adminSecret = getAdminSecret(env)
  if (adminHeader && adminSecret) {
    const payload = await verifyAdminToken(adminHeader, adminSecret)
    if (payload?.sub) {
      const admin = await env.DB.prepare('SELECT uid, email, role FROM admin_users WHERE uid = ?').bind(payload.sub).first()
      if (admin) return { sub: admin.uid, email: admin.email, adminRole: admin.role, authType: 'admin_token' }
    }
  }

  // 2. Check Authorization Bearer header (could be Admin JWT or Firebase Token)
  if (authHeader?.startsWith('Bearer ')) {
    const rawToken = authHeader.slice(7)
    const adminPayload = adminSecret ? await verifyAdminToken(rawToken, adminSecret) : null
    if (adminPayload?.sub) {
      const admin = await env.DB.prepare('SELECT uid, email, role FROM admin_users WHERE uid = ?').bind(adminPayload.sub).first()
      if (admin) return { sub: admin.uid, email: admin.email, adminRole: admin.role, authType: 'admin_token' }
    }

    try {
      const user = await verifyFirebaseIdToken(authHeader, env)
      const admin = await env.DB.prepare('SELECT uid, email, role FROM admin_users WHERE uid = ?').bind(user.sub).first()
      if (admin) return { ...user, email: admin.email || user.email, adminRole: admin.role, authType: 'firebase' }
    } catch {}
  }

  throw new AuthError('Admin access required')
}

async function logAdminAction(env, adminUid, action, targetType, targetId, details) {
  await env.DB.prepare(
    'INSERT INTO admin_audit_log (id, admin_uid, action, target_type, target_id, details) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(crypto.randomUUID(), adminUid, action, targetType, targetId, details ? JSON.stringify(details) : null).run()
}

// ---------- Admin API handlers ----------

// Brute-force protection: 5 failed logins per email lock the address for
// 15 minutes. Unknown emails are tracked too, so lockouts never reveal
// whether an address is a real admin account (anti-enumeration).
const LOGIN_MAX_ATTEMPTS = 5
const LOGIN_LOCK_MS = 15 * 60 * 1000

async function checkLoginAllowed(env, emailKey) {
  try {
    const row = await env.DB.prepare(
      'SELECT attempts, locked_until FROM admin_login_attempts WHERE email_key = ?'
    ).bind(emailKey).first()
    if (row?.locked_until) {
      const untilMs = Date.parse(row.locked_until)
      if (Number.isFinite(untilMs) && untilMs > Date.now()) {
        return { allowed: false, retryAfterSec: Math.ceil((untilMs - Date.now()) / 1000) }
      }
      // Lazy TTL: lock expired — remove the row so random-email spam
      // can't bloat the table with dead entries.
      await env.DB.prepare('DELETE FROM admin_login_attempts WHERE email_key = ?').bind(emailKey).run().catch(() => {})
    }
    return { allowed: true }
  } catch {
    // Pre-migration DBs have no attempts table yet: allow (availability),
    // the migration applies the real protection.
    return { allowed: true }
  }
}

async function recordLoginFailure(env, emailKey) {
  // Single-statement atomic increment: concurrent bursts can't read-then-
  // write the same counter and lose attempts. Thresholds mirror
  // LOGIN_MAX_ATTEMPTS (5) / LOGIN_LOCK_MS (15 min) above — keep in sync.
  try {
    await env.DB.prepare(
      `INSERT INTO admin_login_attempts (email_key, attempts, locked_until, updated_at)
       VALUES (?, 1, NULL, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
       ON CONFLICT(email_key) DO UPDATE SET
         attempts = admin_login_attempts.attempts + 1,
         locked_until = CASE
           WHEN admin_login_attempts.attempts + 1 >= 5
           THEN strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '+15 minutes')
           ELSE admin_login_attempts.locked_until
         END,
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`
    ).bind(emailKey).run()
  } catch (err) {
    console.warn('Login attempt tracking failed:', err?.message)
  }
}

async function clearLoginAttempts(env, emailKey) {
  try {
    await env.DB.prepare('DELETE FROM admin_login_attempts WHERE email_key = ?').bind(emailKey).run()
  } catch {}
}

async function handleAdminLogin(request, env) {
  const { body, tooLarge } = await readJsonBody(request, 16 * 1024)
  if (tooLarge) return BODY_TOO_LARGE()
  if (!body) return json({ error: 'Invalid JSON body' }, 400)

  const email = cleanText(body.email, 120)?.toLowerCase()
  const password = body.password

  if (!email || typeof password !== 'string' || !password) {
    return json({ error: 'Admin email and password are required' }, 400)
  }

  const gate = await checkLoginAllowed(env, email)
  if (!gate.allowed) {
    return json(
      { error: 'Too many attempts. Try again later.' },
      429,
      { 'Retry-After': String(gate.retryAfterSec || 900), 'Cache-Control': 'no-store' }
    )
  }

  // Find admin user by email (case-insensitive) or UID
  const admin = await env.DB.prepare(
    'SELECT uid, email, role, password_hash, password_salt FROM admin_users WHERE LOWER(email) = ? OR uid = ?'
  ).bind(email, email).first()

  // Same generic message for unknown emails: no account enumeration.
  const fail = async () => {
    await recordLoginFailure(env, email)
    return json({ error: 'Invalid admin email or password' }, 401, { 'Cache-Control': 'no-store' })
  }
  if (!admin) {
    // Equalize timing: unknown emails burn the same ~100ms KDF as a real
    // password check, so response time reveals nothing about the account.
    await hashAdminPasswordPBKDF2('dummy-login-timing-noise', '00'.repeat(16)).catch(() => {})
    return fail()
  }

  let isMatch = false
  let needsUpgrade = false
  if (isPBKDF2Hash(admin.password_hash)) {
    isMatch = await verifyPBKDF2Hash(password, admin.password_hash)
  } else if (admin.password_hash && admin.password_salt) {
    // Legacy single-round SHA-256 row: verify, then upgrade to PBKDF2 below.
    const computedHash = await hashAdminPassword(password, admin.password_salt)
    isMatch = timingSafeEqualStr(computedHash, admin.password_hash)
    needsUpgrade = isMatch
  } else {
    // First-setup bootstrap only: ADMIN_INITIAL_PASSWORD works until a real
    // hash exists, then becomes useless. Never hardcoded in source.
    const initial = env.ADMIN_INITIAL_PASSWORD
    if (typeof initial === 'string' && initial.length >= 8 && timingSafeEqualStr(password, initial)) {
      isMatch = true
      needsUpgrade = true
    }
  }

  if (!isMatch) return fail()

  // Transparent upgrade: legacy/bootstrap passwords become PBKDF2 on login.
  if (needsUpgrade) {
    try {
      const { hash, salt } = await newPBKDF2Hash(password)
      await env.DB.prepare(
        'UPDATE admin_users SET password_hash = ?, password_salt = ? WHERE uid = ?'
      ).bind(hash, salt, admin.uid).run()
    } catch (err) {
      console.warn('Password hash upgrade failed:', err?.message)
    }
  }

  await clearLoginAttempts(env, email)

  // Fail closed without a signing secret: password login is disabled until
  // ADMIN_SECRET is configured (Firebase-based admins still work).
  const adminSecret = getAdminSecret(env)
  if (!adminSecret) {
    console.error('ADMIN_SECRET missing or too short: admin password login disabled')
    return json({ error: 'Internal server error' }, 500)
  }

  // 24-hour session expiration
  const exp = Date.now() + 24 * 60 * 60 * 1000
  const token = await signAdminToken(
    { sub: admin.uid, email: admin.email, role: admin.role, exp },
    adminSecret
  )

  await logAdminAction(env, admin.uid, 'admin_login', 'auth', admin.uid, { email: admin.email }).catch(() => {})

  return json({
    success: true,
    token,
    user: {
      uid: admin.uid,
      email: admin.email,
      role: admin.role
    }
  }, 200, { 'Cache-Control': 'no-store' })
}

async function handleAdminChangePassword(request, env, admin) {
  const { body, tooLarge } = await readJsonBody(request, 16 * 1024)
  if (tooLarge) return BODY_TOO_LARGE()
  if (!body) return json({ error: 'Invalid JSON body' }, 400)

  const currentPassword = body.current_password
  const newPassword = body.new_password

  if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 8) {
    return json({ error: 'New password must be at least 8 characters long' }, 400)
  }

  const row = await env.DB.prepare(
    'SELECT uid, password_hash, password_salt FROM admin_users WHERE uid = ?'
  ).bind(admin.sub).first()

  if (!row) return json({ error: 'Admin account not found' }, 404)

  // Verify the current password (supports legacy rows during transition).
  if (row.password_hash) {
    if (!currentPassword) return json({ error: 'Current password is required' }, 400)
    let ok = false
    if (isPBKDF2Hash(row.password_hash)) {
      ok = await verifyPBKDF2Hash(currentPassword, row.password_hash)
    } else if (row.password_salt) {
      const currentHash = await hashAdminPassword(currentPassword, row.password_salt)
      ok = timingSafeEqualStr(currentHash, row.password_hash)
    } else {
      const initial = env.ADMIN_INITIAL_PASSWORD
      ok = typeof initial === 'string' && timingSafeEqualStr(currentPassword, initial)
    }
    if (!ok) return json({ error: 'Incorrect current password' }, 401)
  }

  // New passwords are always PBKDF2 (salt duplicated into password_salt for
  // compatibility with readers that expect the column to be non-empty).
  const { hash, salt } = await newPBKDF2Hash(newPassword)

  await env.DB.prepare(
    'UPDATE admin_users SET password_hash = ?, password_salt = ? WHERE uid = ?'
  ).bind(hash, salt, row.uid).run()

  await logAdminAction(env, admin.sub, 'change_password', 'auth', admin.sub, { updated: true })

  return json({ success: true, message: 'Password updated successfully' })
}

async function handleAdminCheck(env, admin) {
  return json({ isAdmin: true, role: admin.adminRole, uid: admin.sub, email: admin.email })
}

async function handleAdminStats(env) {
  const [shops, products, reviews, banned] = await Promise.all([
    env.DB.prepare('SELECT COUNT(*) as count FROM shops').first(),
    env.DB.prepare('SELECT COUNT(*) as count FROM products').first(),
    env.DB.prepare('SELECT COUNT(*) as count FROM reviews').first(),
    env.DB.prepare("SELECT COUNT(*) as count FROM shops WHERE is_banned = 1 AND (banned_until IS NULL OR banned_until > strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))").first()
  ])

  // New shops this week
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const newShops = await env.DB.prepare('SELECT COUNT(*) as count FROM shops WHERE created_at > ?').bind(weekAgo).first()

  // New products this week
  const newProducts = await env.DB.prepare('SELECT COUNT(*) as count FROM products WHERE created_at > ?').bind(weekAgo).first()

  return json({
    totalShops: shops?.count || 0,
    totalProducts: products?.count || 0,
    totalReviews: reviews?.count || 0,
    bannedShops: banned?.count || 0,
    newShopsThisWeek: newShops?.count || 0,
    newProductsThisWeek: newProducts?.count || 0,
    // Subscription tier stats (graceful fallback for pre-migration DBs)
    ...(await (async () => {
      try {
        const [free, starter, pro, hero] = await Promise.all([
          env.DB.prepare("SELECT COUNT(*) as count FROM shops WHERE subscription_tier = 'free' OR subscription_tier IS NULL").first(),
          env.DB.prepare("SELECT COUNT(*) as count FROM shops WHERE subscription_tier = 'starter'").first(),
          env.DB.prepare("SELECT COUNT(*) as count FROM shops WHERE subscription_tier = 'pro'").first(),
          env.DB.prepare("SELECT COUNT(*) as count FROM shops WHERE subscription_tier = 'hero'").first()
        ])
        return {
          tierBreakdown: {
            free: free?.count || 0,
            starter: starter?.count || 0,
            pro: pro?.count || 0,
            hero: hero?.count || 0
          }
        }
      } catch { return {} }
    })())
  })
}

async function handleAdminListShops(env, url) {
  const search = url.searchParams.get('search') || ''
  const filter = url.searchParams.get('filter') || 'all' // 'all', 'active', 'banned'
  const limit = Math.min(200, Number(url.searchParams.get('limit')) || 100)

  let query = `
    SELECT s.*,
           (SELECT COUNT(*) FROM products p WHERE p.shop_id = s.id) AS product_count,
           (SELECT ROUND(AVG(r.rating), 1) FROM reviews r WHERE r.shop_id = s.id) AS avg_rating,
           (SELECT COUNT(*) FROM reviews r WHERE r.shop_id = s.id) AS review_count
    FROM shops s
    WHERE 1=1`
  const bindings = []

  // Expired bans read as active (auto-restored) in both filters
  if (filter === 'active') { query += ` AND NOT ${EFFECTIVELY_BANNED_SQL('s')}`; }
  else if (filter === 'banned') { query += ` AND ${EFFECTIVELY_BANNED_SQL('s')}`; }

  if (search) {
    query += ' AND (s.shop_name LIKE ? OR s.owner_name LIKE ? OR s.owner_email LIKE ? OR s.address_text LIKE ?)'
    const wildcard = `%${search}%`
    bindings.push(wildcard, wildcard, wildcard, wildcard)
  }

  query += ' ORDER BY s.created_at DESC LIMIT ?'
  bindings.push(limit)

  const { results } = await env.DB.prepare(query).bind(...bindings).all()
  return json({ shops: results || [] })
}

async function handleAdminBanShop(request, env, admin) {
  const { body, tooLarge } = await readJsonBody(request)
  if (tooLarge) return BODY_TOO_LARGE()
  if (!body) return json({ error: 'Invalid JSON body' }, 400)

  const shopId = cleanText(body.shop_id, 64)
  const banned = body.banned ? 1 : 0
  const reason = banned ? (cleanText(body.reason, 300) || 'Violating local platform policies or standards') : null

  // Optional ban length in days (admin quicks: 7 / 15 / 30). Absent/null = indefinite.
  // Products are NEVER deleted by a ban — they hide during the ban and auto-restore on expiry.
  let durationDays = null
  if (banned && body.duration_days !== undefined && body.duration_days !== null && body.duration_days !== '') {
    durationDays = Math.floor(Number(body.duration_days))
    if (!Number.isFinite(durationDays) || durationDays < 1 || durationDays > 365) {
      return json({ error: 'duration_days must be a number between 1 and 365 (or omitted for indefinite)' }, 400)
    }
  }

  if (!shopId) return json({ error: 'shop_id is required' }, 400)

  const shop = await env.DB.prepare('SELECT id, shop_name FROM shops WHERE id = ?').bind(shopId).first()
  if (!shop) return json({ error: 'Shop not found' }, 404)

  const bannedUntil = banned && durationDays
    ? new Date(Date.now() + durationDays * 86400000).toISOString()
    : null

  await env.DB.prepare('UPDATE shops SET is_banned = ?, ban_reason = ?, banned_until = ? WHERE id = ?').bind(banned, reason, bannedUntil, shopId).run()

  // Bump products updated_at for this shop so client ETags invalidate immediately
  await env.DB.prepare("UPDATE products SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE shop_id = ?").bind(shopId).run()

  await logAdminAction(env, admin.sub, banned ? 'ban_shop' : 'unban_shop', 'shop', shopId, { shop_name: shop.shop_name, reason, duration_days: durationDays, banned_until: bannedUntil })

  return json({ success: true, action: banned ? 'banned' : 'unbanned', banned_until: bannedUntil })
}

async function handleAdminHeroShop(request, env, admin) {
  const { body, tooLarge } = await readJsonBody(request)
  if (tooLarge) return BODY_TOO_LARGE()
  if (!body) return json({ error: 'Invalid JSON body' }, 400)

  const shopId = cleanText(body.shop_id, 64)
  if (!shopId) return json({ error: 'shop_id is required' }, 400)
  // Strict coercion: truthy strings like "false" must not grant hero status
  const isHero = body.is_hero === true || body.is_hero === 1 ? 1 : 0

  const shop = await env.DB.prepare('SELECT id, shop_name, badge_level FROM shops WHERE id = ?').bind(shopId).first()
  if (!shop) return json({ error: 'Shop not found' }, 404)

  await env.DB.prepare('UPDATE shops SET is_hero_shop = ? WHERE id = ?').bind(isHero, shopId).run()

  // Bump products updated_at so feed ETags invalidate immediately (same as ban):
  // otherwise clients keep 304s / edge-cached non-hero cards until TTL expiry.
  await env.DB.prepare("UPDATE products SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE shop_id = ?").bind(shopId).run()

  // Recompute level: hero flag alone grants Level 5 (admin override, no threshold).
  const badge = await refreshShopBadge(env, shopId).catch((badgeErr) => { console.warn('Badge refresh failed:', badgeErr?.message); return null })

  await logAdminAction(env, admin.sub, isHero ? 'grant_hero_shop' : 'revoke_hero_shop', 'shop', shopId, { shop_name: shop.shop_name, badge_level: badge?.level })

  return json({ success: true, is_hero_shop: Boolean(isHero), badge })
}

async function handleAdminDeleteShop(request, env, admin, url) {
  const shopId = url.searchParams.get('id')
  if (!shopId) return json({ error: 'Shop id is required' }, 400)

  const cleanShopId = cleanText(shopId, 64)
  const shop = await env.DB.prepare('SELECT id, shop_name, owner_id FROM shops WHERE id = ?').bind(cleanShopId).first()
  if (!shop) return json({ error: 'Shop not found' }, 404)

  // Explicitly delete shop, products, and reviews to guarantee no orphan data in D1
  await env.DB.batch([
    env.DB.prepare('DELETE FROM products WHERE shop_id = ?').bind(cleanShopId),
    env.DB.prepare('DELETE FROM reviews WHERE shop_id = ?').bind(cleanShopId),
    env.DB.prepare('DELETE FROM shops WHERE id = ?').bind(cleanShopId)
  ])

  await logAdminAction(env, admin.sub, 'delete_shop', 'shop', shop.id, { shop_name: shop.shop_name, owner_id: shop.owner_id })

  return json({ success: true })
}

async function handleAdminListProducts(env, url) {
  const search = url.searchParams.get('search') || ''
  const category = url.searchParams.get('category') || ''
  const limit = Math.min(300, Number(url.searchParams.get('limit')) || 100)

  let query = `
    SELECT p.*, s.shop_name, s.owner_name, s.is_banned AS shop_banned
    FROM products p
    JOIN shops s ON s.id = p.shop_id
    WHERE 1=1`
  const bindings = []

  if (search) {
    query += ' AND (p.name LIKE ? OR s.shop_name LIKE ?)'
    const wildcard = `%${search}%`
    bindings.push(wildcard, wildcard)
  }
  if (category && category !== 'All') {
    query += ' AND p.category = ?'
    bindings.push(category)
  }

  query += ' ORDER BY p.created_at DESC LIMIT ?'
  bindings.push(limit)

  const { results } = await env.DB.prepare(query).bind(...bindings).all()
  return json({ products: results || [] })
}

async function handleAdminDeleteProduct(request, env, admin, url) {
  const id = url.searchParams.get('id')
  if (!id) return json({ error: 'Product id is required' }, 400)

  const product = await env.DB.prepare('SELECT p.id, p.name, p.shop_id, s.shop_name FROM products p JOIN shops s ON s.id = p.shop_id WHERE p.id = ?').bind(cleanText(id, 64)).first()
  if (!product) return json({ error: 'Product not found' }, 404)

  await env.DB.prepare('DELETE FROM products WHERE id = ?').bind(product.id).run()
  await logAdminAction(env, admin.sub, 'delete_product', 'product', product.id, { name: product.name, shop_name: product.shop_name })

  return json({ success: true })
}

async function handleAdminListReviews(env, url) {
  const limit = Math.min(200, Number(url.searchParams.get('limit')) || 100)

  const { results } = await env.DB.prepare(`
    SELECT r.*, s.shop_name
    FROM reviews r
    JOIN shops s ON s.id = r.shop_id
    ORDER BY r.updated_at DESC
    LIMIT ?
  `).bind(limit).all()

  return json({ reviews: results || [] })
}

async function handleAdminDeleteReview(request, env, admin, url) {
  const id = url.searchParams.get('id')
  if (!id) return json({ error: 'Review id is required' }, 400)

  const review = await env.DB.prepare('SELECT r.id, r.user_name, r.rating, r.shop_id, s.shop_name FROM reviews r JOIN shops s ON s.id = r.shop_id WHERE r.id = ?').bind(cleanText(id, 64)).first()
  if (!review) return json({ error: 'Review not found' }, 404)

  await env.DB.prepare('DELETE FROM reviews WHERE id = ?').bind(review.id).run()
  await logAdminAction(env, admin.sub, 'delete_review', 'review', review.id, { user_name: review.user_name, rating: review.rating, shop_name: review.shop_name })

  // Recalculate in case the removal drops the shop below a badge threshold
  const badge = await refreshShopBadge(env, review.shop_id).catch((badgeErr) => { console.warn('Badge refresh failed:', badgeErr?.message); return null })

  return json({ success: true, badge })
}

async function handleAdminAuditLog(env, url) {
  const limit = Math.min(200, Number(url.searchParams.get('limit')) || 50)

  const { results } = await env.DB.prepare(`
    SELECT * FROM admin_audit_log
    ORDER BY created_at DESC
    LIMIT ?
  `).bind(limit).all()

  return json({ logs: results || [] })
}

// ---------- Shopkeeper analytics (YouTube-Studio style) ----------

const ANALYTICS_EVENT_TYPES = ['impression', 'detail_open', 'whatsapp_click', 'directions_click', 'share', 'wishlist', 'review', 'call_click', 'flash_claim', 'search_view']

// Normalized search text: lowercase, trimmed, max 80 chars, min 2 chars.
function sanitizeSearchQuery(value) {
  if (typeof value !== 'string') return null
  const q = value.trim().toLowerCase().slice(0, 80)
  return q.length >= 2 ? q : null
}

// Buyer pincode is coarse location only: exactly 6 digits or nothing.
function sanitizeBuyerPincode(value) {
  if (typeof value !== 'string') return null
  const digits = value.replace(/[^0-9]/g, '').slice(0, 6)
  return digits.length === 6 ? digits : null
}

// Single-insert with NULL-safe per-user-per-day guard. Returns 'inserted',
// 'duplicate', 'owner', or throws. Shared by track + track-search.
async function insertEventOnce(env, { shopId, productId, userId, eventType, searchQuery, buyerPincode, ownerId }) {
  if (ownerId === userId) return 'owner'
  const today = new Date().toISOString().slice(0, 10)
  const existing = await env.DB.prepare(
    `SELECT id FROM product_events
     WHERE user_id = ? AND event_type = ? AND event_date = ? AND shop_id = ?
       AND ((product_id IS NULL AND ? IS NULL) OR product_id = ?)
       AND ((search_query IS NULL AND ? IS NULL) OR search_query = ?)`
  ).bind(userId, eventType, today, shopId, productId, productId, searchQuery, searchQuery).first()
  if (existing) return 'duplicate'
  // Bare DO NOTHING (no conflict target): atomic backstop for races the
  // SELECT guard can miss, enforced by idx_events_dedupe_once (NULL-safe).
  // meta.changes tells a real insert from a swallowed conflict.
  const written = await env.DB.prepare(
    `INSERT INTO product_events (id, shop_id, product_id, user_id, event_type, search_query, buyer_pincode)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT DO NOTHING`
  ).bind(crypto.randomUUID(), shopId, productId, userId, eventType, searchQuery, buyerPincode).run()
  return (written?.meta?.changes ?? 1) > 0 ? 'inserted' : 'duplicate'
}

async function handleTrackEvent(request, env, user) {
  if (!(await checkWriteQuota(env, user.sub, 'track', 1000))) return quotaExceededResponse()
  const { body, tooLarge } = await readJsonBody(request, 64 * 1024)
  if (tooLarge) return BODY_TOO_LARGE()
  if (!body) return json({ error: 'Invalid JSON body' }, 400)

  const event_type = typeof body.event_type === 'string' ? body.event_type.trim() : ''
  const product_id = cleanText(body.product_id, 64)
  const shop_id = cleanText(body.shop_id, 64)
  const buyer_pincode = sanitizeBuyerPincode(body.buyer_pincode)

  if (!ANALYTICS_EVENT_TYPES.includes(event_type)) {
    return json({ error: 'event_type must be one of: ' + ANALYTICS_EVENT_TYPES.join(', ') }, 400)
  }
  if (!product_id && !shop_id) return json({ error: 'product_id or shop_id is required' }, 400)

  // Resolve shop + product, verify they exist and belong together
  let resolvedShopId = shop_id
  let resolvedProductId = product_id || null
  if (product_id) {
    const product = await env.DB.prepare('SELECT id, shop_id FROM products WHERE id = ?').bind(product_id).first()
    if (!product) return json({ error: 'Product not found' }, 404)
    resolvedProductId = product.id
    resolvedShopId = product.shop_id
    if (shop_id && shop_id !== product.shop_id) return json({ error: 'product does not belong to shop' }, 400)
  }
  // search_view rows carry the query; other types must not (keeps tallies clean).
  const searchQuery = event_type === 'search_view' ? sanitizeSearchQuery(body.search_query) : null
  if (event_type === 'search_view' && !searchQuery) return json({ error: 'search_query is required for search_view' }, 400)

  const shop = await env.DB.prepare('SELECT id, owner_id FROM shops WHERE id = ?').bind(resolvedShopId).first()
  if (!shop) return json({ error: 'Shop not found' }, 404)

  try {
    const outcome = await insertEventOnce(env, {
      shopId: resolvedShopId,
      productId: resolvedProductId,
      userId: user.sub,
      eventType: event_type,
      searchQuery,
      buyerPincode: buyer_pincode,
      ownerId: shop.owner_id
    })
    return json({ success: true, ...(outcome === 'inserted' ? {} : { skipped: outcome }) })
  } catch (err) {
    // Pre-migration DBs: missing table OR old event_type CHECK (worker
    // deployed before v3 migration) — fail soft, never break shopping.
    const msg = String(err.message || '')
    if (msg.includes('no such table') || msg.includes('CHECK constraint failed')) {
      return json({ success: true, skipped: 'no-table' })
    }
    throw err
  }
}

// Batched search attribution: one search_view row per shop shown in the
// buyer's results (capped), so Top Keywords tallies per-shop demand.
async function handleTrackSearch(request, env, user) {
  const { body, tooLarge } = await readJsonBody(request, 4 * 1024)
  if (tooLarge) return BODY_TOO_LARGE()
  if (!body) return json({ error: 'Invalid JSON body' }, 400)

  const searchQuery = sanitizeSearchQuery(body.query)
  if (!searchQuery) return json({ error: 'query must be at least 2 characters' }, 400)
  const rawIds = Array.isArray(body.shop_ids) ? body.shop_ids : []
  const shopIds = [...new Set(rawIds.map((id) => cleanText(id, 64)).filter(Boolean))].slice(0, 5)
  if (shopIds.length === 0) return json({ error: 'shop_ids must list at least one shop' }, 400)
  const buyer_pincode = sanitizeBuyerPincode(body.buyer_pincode)

  // Abuse quota: at most 50 DISTINCT searches per user per day. Counted by
  // query (not rows — one search fans out to 5 shops), so legit buyers
  // never hit it; a script spamming shop_ids can't pollute tallies at
  // volume. Per-shop daily dedupe already caps one account vs one shop.
  try {
    const today = new Date().toISOString().slice(0, 10)
    const used = await env.DB.prepare(
      `SELECT COUNT(DISTINCT search_query) AS n FROM product_events
       WHERE user_id = ? AND event_type = 'search_view' AND event_date = ?`
    ).bind(user.sub, today).first()
    if ((Number(used?.n) || 0) >= 50) return json({ success: true, skipped: 'quota' })
  } catch {
    // No table yet (pre-migration): fall through to the fail-soft insert path.
  }

  let recorded = 0
  try {
    for (const shopId of shopIds) {
      const shop = await env.DB.prepare('SELECT id, owner_id FROM shops WHERE id = ?').bind(shopId).first()
      if (!shop) continue
      const outcome = await insertEventOnce(env, {
        shopId: shop.id,
        productId: null,
        userId: user.sub,
        eventType: 'search_view',
        searchQuery,
        buyerPincode: buyer_pincode,
        ownerId: shop.owner_id
      })
      if (outcome === 'inserted') recorded++
    }
  } catch (err) {
    const msg = String(err.message || '')
    if (msg.includes('no such table') || msg.includes('CHECK constraint failed')) {
      return json({ success: true, skipped: 'no-table' })
    }
    throw err
  }
  return json({ success: true, recorded })
}

async function handleGetShopAnalytics(env, url, user) {
  const shopId = cleanText(url.searchParams.get('shop_id'), 64)
  if (!shopId) return json({ error: 'shop_id is required' }, 400)
  const daysRaw = Number(url.searchParams.get('days'))
  const days = daysRaw === 28 ? 28 : daysRaw === 90 ? 90 : 7

  const shop = await env.DB.prepare('SELECT id, owner_id, shop_name FROM shops WHERE id = ?').bind(shopId).first()
  if (!shop) return json({ error: 'Shop not found' }, 404)
  if (shop.owner_id !== user.sub) return json({ error: 'Forbidden: not your shop' }, 403)

  const sinceDate = new Date(Date.now() - (days - 1) * 86400000).toISOString().slice(0, 10)

  try {
    const totalsRow = await env.DB.prepare(
      `SELECT
         SUM(CASE WHEN event_type = 'impression' THEN 1 ELSE 0 END) AS impressions,
         SUM(CASE WHEN event_type = 'detail_open' THEN 1 ELSE 0 END) AS detail_opens,
         SUM(CASE WHEN event_type = 'whatsapp_click' THEN 1 ELSE 0 END) AS whatsapp_clicks,
         SUM(CASE WHEN event_type = 'directions_click' THEN 1 ELSE 0 END) AS directions_clicks,
         SUM(CASE WHEN event_type = 'call_click' THEN 1 ELSE 0 END) AS call_clicks,
         SUM(CASE WHEN event_type = 'flash_claim' THEN 1 ELSE 0 END) AS flash_claims,
         SUM(CASE WHEN event_type = 'share' THEN 1 ELSE 0 END) AS shares,
         SUM(CASE WHEN event_type = 'wishlist' THEN 1 ELSE 0 END) AS wishlists,
         SUM(CASE WHEN event_type = 'review' THEN 1 ELSE 0 END) AS reviews,
         COUNT(*) AS total_events,
         COUNT(DISTINCT user_id) AS unique_viewers
       FROM product_events
       WHERE shop_id = ? AND event_date >= ?`
    ).bind(shopId, sinceDate).first()

    // Peak hours: unique viewers per UTC hour across view-type events.
    // (Daily dedupe means this is active-shopper hours, not raw footfall.)
    const hourlyRows = await env.DB.prepare(
      `SELECT hour_of_day AS hour, COUNT(DISTINCT user_id) AS viewers
       FROM product_events
       WHERE shop_id = ? AND event_date >= ?
         AND hour_of_day IS NOT NULL
         AND event_type IN ('impression', 'detail_open')
       GROUP BY hour_of_day`
    ).bind(shopId, sinceDate).all().catch(() => ({ results: [] }))

    // Distinct shoppers, not rows: one buyer opening 3 products must not
    // triple-count their pincode (events fan out per product).
    const topKeywords = await env.DB.prepare(
      `SELECT search_query AS query, COUNT(DISTINCT user_id) AS count
       FROM product_events
       WHERE shop_id = ? AND event_date >= ?
         AND event_type = 'search_view' AND search_query IS NOT NULL
       GROUP BY search_query ORDER BY count DESC LIMIT 10`
    ).bind(shopId, sinceDate).all().catch(() => ({ results: [] }))

    const areaReach = await env.DB.prepare(
      `SELECT buyer_pincode AS pincode, COUNT(DISTINCT user_id) AS count
       FROM product_events
       WHERE shop_id = ? AND event_date >= ?
         AND buyer_pincode IS NOT NULL
       GROUP BY buyer_pincode ORDER BY count DESC LIMIT 10`
    ).bind(shopId, sinceDate).all().catch(() => ({ results: [] }))

    const timeseries = await env.DB.prepare(
      `SELECT event_date AS date,
         SUM(CASE WHEN event_type = 'impression' THEN 1 ELSE 0 END) AS impressions,
         SUM(CASE WHEN event_type = 'detail_open' THEN 1 ELSE 0 END) AS detail_opens,
         SUM(CASE WHEN event_type = 'whatsapp_click' THEN 1 ELSE 0 END) AS whatsapp_clicks,
         SUM(CASE WHEN event_type = 'directions_click' THEN 1 ELSE 0 END) AS directions_clicks
       FROM product_events
       WHERE shop_id = ? AND event_date >= ?
       GROUP BY event_date ORDER BY event_date ASC`
    ).bind(shopId, sinceDate).all()

    const byProduct = await env.DB.prepare(
      `SELECT e.product_id, p.name AS product_name, p.price AS product_price, p.category AS product_category,
         SUM(CASE WHEN e.event_type = 'impression' THEN 1 ELSE 0 END) AS impressions,
         SUM(CASE WHEN e.event_type = 'detail_open' THEN 1 ELSE 0 END) AS detail_opens,
         SUM(CASE WHEN e.event_type = 'whatsapp_click' THEN 1 ELSE 0 END) AS whatsapp_clicks,
         SUM(CASE WHEN e.event_type = 'directions_click' THEN 1 ELSE 0 END) AS directions_clicks,
         SUM(CASE WHEN e.event_type = 'call_click' THEN 1 ELSE 0 END) AS call_clicks,
         SUM(CASE WHEN e.event_type = 'flash_claim' THEN 1 ELSE 0 END) AS flash_claims,
         SUM(CASE WHEN e.event_type = 'share' THEN 1 ELSE 0 END) AS shares,
         SUM(CASE WHEN e.event_type = 'wishlist' THEN 1 ELSE 0 END) AS wishlists,
         COUNT(*) AS total_events
       FROM product_events e
       LEFT JOIN products p ON p.id = e.product_id
       WHERE e.shop_id = ? AND e.event_date >= ? AND e.product_id IS NOT NULL
       GROUP BY e.product_id ORDER BY detail_opens DESC, impressions DESC LIMIT 50`
    ).bind(shopId, sinceDate).all()

    const impressions = Number(totalsRow?.impressions) || 0
    const detailOpens = Number(totalsRow?.detail_opens) || 0
    const whatsappClicks = Number(totalsRow?.whatsapp_clicks) || 0
    const callClicks = Number(totalsRow?.call_clicks) || 0
    const directionsClicks = Number(totalsRow?.directions_clicks) || 0
    const flashClaims = Number(totalsRow?.flash_claims) || 0
    const ctr = impressions > 0 ? Math.round((detailOpens / impressions) * 1000) / 10 : 0

    // Dense 24-slot array so the chart never has gaps.
    const hourly = Array.from({ length: 24 }, (_, h) => ({ hour: h, viewers: 0 }))
    for (const row of hourlyRows.results || []) {
      const h = Number(row.hour)
      if (Number.isInteger(h) && h >= 0 && h < 24) hourly[h].viewers = Number(row.viewers) || 0
    }

    const res = json({
      shop_id: shopId,
      days,
      since_date: sinceDate,
      totals: {
        impressions,
        detail_opens: detailOpens,
        whatsapp_clicks: whatsappClicks,
        directions_clicks: directionsClicks,
        call_clicks: callClicks,
        flash_claims: flashClaims,
        shares: Number(totalsRow?.shares) || 0,
        wishlists: Number(totalsRow?.wishlists) || 0,
        reviews: Number(totalsRow?.reviews) || 0,
        total_events: Number(totalsRow?.total_events) || 0,
        unique_viewers: Number(totalsRow?.unique_viewers) || 0,
        ctr_percent: ctr
      },
      funnel: {
        impressions,
        detail_opens: detailOpens,
        whatsapp_clicks: whatsappClicks,
        call_clicks: callClicks,
        directions_clicks: directionsClicks,
        flash_claims: flashClaims
      },
      hourly,
      top_keywords: topKeywords.results || [],
      area_reach: areaReach.results || [],
      timeseries: timeseries.results || [],
      by_product: byProduct.results || []
    })
    res.headers.set('Cache-Control', 'no-store')
    return res
  } catch (err) {
    if (String(err.message || '').includes('no such table')) {
      const emptyTotals = { impressions: 0, detail_opens: 0, whatsapp_clicks: 0, directions_clicks: 0, call_clicks: 0, flash_claims: 0, shares: 0, wishlists: 0, reviews: 0, total_events: 0, unique_viewers: 0, ctr_percent: 0 }
      return json({ shop_id: shopId, days, since_date: sinceDate, totals: emptyTotals, funnel: { impressions: 0, detail_opens: 0, whatsapp_clicks: 0, call_clicks: 0, directions_clicks: 0, flash_claims: 0 }, hourly: Array.from({ length: 24 }, (_, hour) => ({ hour, viewers: 0 })), top_keywords: [], area_reach: [], timeseries: [], by_product: [], _empty: true })
    }
    throw err
  }
}

// ---------- Subscription API handlers ----------

async function handleGetSubscription(env, user) {
  try {
    const shop = await env.DB.prepare(
      `SELECT id, subscription_tier, subscription_expires_at, flash_deals_used_this_month, flash_deals_reset_at,
              (SELECT COUNT(*) FROM products WHERE shop_id = shops.id) AS product_count
       FROM shops WHERE owner_id = ?`
    ).bind(user.sub).first()

    if (!shop) return json({ subscription: null })

    const tier = getEffectiveTier(shop)
    const limits = getTierLimits(tier)

    // Auto-reset flash counter if new month
    let flashUsed = Number(shop.flash_deals_used_this_month) || 0
    if (shouldResetFlashCounter(shop.flash_deals_reset_at)) {
      flashUsed = 0
    }

    return json({
      subscription: {
        current_tier: tier,
        stored_tier: shop.subscription_tier || 'free',
        expires_at: shop.subscription_expires_at || null,
        is_expired: tier === 'free' && shop.subscription_tier && shop.subscription_tier !== 'free',
        limits: {
          max_products: limits.maxProducts === Infinity ? null : limits.maxProducts,
          max_flash_deals_per_month: limits.maxFlashDealsPerMonth === Infinity ? null : limits.maxFlashDealsPerMonth,
          max_badge_level: limits.maxBadgeLevel,
          allow_image_upload: limits.allowImageUpload,
          allow_r2_upload: limits.allowR2Upload
        },
        usage: {
          product_count: shop.product_count || 0,
          flash_deals_used_this_month: flashUsed
        },
        tier_label: limits.label
      }
    })
  } catch (err) {
    // Graceful fallback for pre-migration databases
    const msg = String(err.message || '')
    if (msg.includes('no such column')) {
      return json({
        subscription: {
          current_tier: 'free',
          stored_tier: 'free',
          expires_at: null,
          is_expired: false,
          limits: getTierLimits('free'),
          usage: { product_count: 0, flash_deals_used_this_month: 0 },
          tier_label: 'Free'
        }
      })
    }
    throw err
  }
}

async function handleAdminUpdateSubscription(request, env, admin) {
  const { body, tooLarge } = await readJsonBody(request)
  if (tooLarge) return BODY_TOO_LARGE()
  if (!body) return json({ error: 'Invalid JSON body' }, 400)

  const shopId = cleanText(body.shop_id, 64)
  const newTier = cleanText(body.tier, 20)
  const durationDays = body.duration_days ? Math.floor(Number(body.duration_days)) : 30

  if (!shopId) return json({ error: 'shop_id is required' }, 400)
  if (!newTier || !TIER_LIMITS[newTier]) {
    return json({ error: 'tier must be one of: free, starter, pro, hero' }, 400)
  }
  if (!Number.isFinite(durationDays) || durationDays < 1 || durationDays > 365) {
    return json({ error: 'duration_days must be between 1 and 365' }, 400)
  }

  const shop = await env.DB.prepare('SELECT id, shop_name, subscription_tier FROM shops WHERE id = ?').bind(shopId).first()
  if (!shop) return json({ error: 'Shop not found' }, 404)

  const expiresAt = newTier === 'free'
    ? null
    : new Date(Date.now() + durationDays * 86400000).toISOString()

  await env.DB.prepare(
    'UPDATE shops SET subscription_tier = ?, subscription_expires_at = ? WHERE id = ?'
  ).bind(newTier, expiresAt, shopId).run()

  await logAdminAction(env, admin.sub, 'update_subscription', 'shop', shopId, {
    shop_name: shop.shop_name,
    old_tier: shop.subscription_tier || 'free',
    new_tier: newTier,
    duration_days: durationDays,
    expires_at: expiresAt
  })

  return json({
    success: true,
    subscription: {
      tier: newTier,
      expires_at: expiresAt,
      duration_days: durationDays
    }
  })
}

async function routeRequest(request, env, ctx) {
  const url = new URL(request.url)

  try {
    // Device-attestation gate for writes (no-op unless APPCHECK_ENFORCE='1').
    await enforceAppCheck(request, env, url)

    // ---------- Admin routes ----------
      if (url.pathname.startsWith('/api/admin')) {
        // Public admin login endpoint (no auth token required beforehand)
        if (request.method === 'POST' && url.pathname === '/api/admin/login') {
          return await handleAdminLogin(request, env)
        }

        // All other admin endpoints require admin authorization
        const admin = await requireAdmin(request, env)

        if (request.method === 'GET' && url.pathname === '/api/admin/check') {
          return await handleAdminCheck(env, admin)
        }
        if (request.method === 'POST' && url.pathname === '/api/admin/change-password') {
          return await handleAdminChangePassword(request, env, admin)
        }
        if (request.method === 'GET' && url.pathname === '/api/admin/stats') {
          return await handleAdminStats(env)
        }
        if (request.method === 'GET' && url.pathname === '/api/admin/shops') {
          return await handleAdminListShops(env, url)
        }
        if (request.method === 'POST' && url.pathname === '/api/admin/shops/ban') {
          return await handleAdminBanShop(request, env, admin)
        }
        if (request.method === 'POST' && url.pathname === '/api/admin/hero-shop') {
          return await handleAdminHeroShop(request, env, admin)
        }
        if (request.method === 'DELETE' && url.pathname === '/api/admin/shops') {
          return await handleAdminDeleteShop(request, env, admin, url)
        }
        if (request.method === 'GET' && url.pathname === '/api/admin/products') {
          return await handleAdminListProducts(env, url)
        }
        if (request.method === 'DELETE' && url.pathname === '/api/admin/products') {
          return await handleAdminDeleteProduct(request, env, admin, url)
        }
        if (request.method === 'GET' && url.pathname === '/api/admin/reviews') {
          return await handleAdminListReviews(env, url)
        }
        if (request.method === 'DELETE' && url.pathname === '/api/admin/reviews') {
          return await handleAdminDeleteReview(request, env, admin, url)
        }
        if (request.method === 'GET' && url.pathname === '/api/admin/audit-log') {
          return await handleAdminAuditLog(env, url)
        }
        if (request.method === 'POST' && url.pathname === '/api/admin/subscription') {
          return await handleAdminUpdateSubscription(request, env, admin)
        }

        return json({ error: 'Admin route not found' }, 404)
      }

      // ---------- Regular routes ----------
      if (request.method === 'POST' && url.pathname === '/api/upload') {
        const user = await verifyFirebaseIdToken(request.headers.get('Authorization'), env)
        return await handleUploadImage(request, env, user)
      }
      if (request.method === 'POST' && url.pathname === '/api/shops') {
        const user = await verifyFirebaseIdToken(request.headers.get('Authorization'), env)
        return await handleCreateShop(request, env, user)
      }
      if (request.method === 'POST' && url.pathname === '/api/products') {
        const user = await verifyFirebaseIdToken(request.headers.get('Authorization'), env)
        return await handleCreateProduct(request, env, user)
      }
      if (request.method === 'PUT' && url.pathname === '/api/products') {
        const user = await verifyFirebaseIdToken(request.headers.get('Authorization'), env)
        return await handleUpdateProduct(request, env, user)
      }
      if (request.method === 'DELETE' && url.pathname === '/api/products') {
        const user = await verifyFirebaseIdToken(request.headers.get('Authorization'), env)
        return await handleDeleteProduct(request, env, user, url)
      }
      if (request.method === 'GET' && url.pathname === '/api/my-shop') {
        const user = await verifyFirebaseIdToken(request.headers.get('Authorization'), env)
        return await handleGetMyShop(env, user)
      }
      if (request.method === 'GET' && url.pathname === '/api/subscription') {
        const user = await verifyFirebaseIdToken(request.headers.get('Authorization'), env)
        return await handleGetSubscription(env, user)
      }
      if (request.method === 'POST' && url.pathname === '/api/analytics/track') {
        const user = await verifyFirebaseIdToken(request.headers.get('Authorization'), env)
        return await handleTrackEvent(request, env, user)
      }
      if (request.method === 'POST' && url.pathname === '/api/analytics/track-search') {
        const user = await verifyFirebaseIdToken(request.headers.get('Authorization'), env)
        return await handleTrackSearch(request, env, user)
      }
      if (request.method === 'GET' && url.pathname === '/api/analytics/shop') {
        const user = await verifyFirebaseIdToken(request.headers.get('Authorization'), env)
        return await handleGetShopAnalytics(env, url, user)
      }
      if (request.method === 'POST' && url.pathname === '/api/reviews') {
        const user = await verifyFirebaseIdToken(request.headers.get('Authorization'), env)
        return await handleSaveReview(request, env, user)
      }
      if (request.method === 'GET' && url.pathname === '/api/reviews') {
        return await handleGetShopReviews(env, url)
      }
      if (request.method === 'DELETE' && url.pathname === '/api/reviews') {
        const user = await verifyFirebaseIdToken(request.headers.get('Authorization'), env)
        return await handleDeleteReview(request, env, user, url)
      }
      if (request.method === 'GET' && url.pathname === '/api/shops') {
        return await handleListShops(env)
      }
      if (request.method === 'GET' && url.pathname === '/api/products') {
        const shopId = url.searchParams.get('shop_id')
        const since = url.searchParams.get('since')
        const category = url.searchParams.get('category')
        const flashOnly = url.searchParams.get('flash_deals_only') === '1' || url.searchParams.get('flash_deals_only') === 'true'
        const hasCacheBust = url.searchParams.has('_cb') || request.headers.get('Cache-Control')?.includes('no-cache')
        const isGlobalPublicQuery = !hasCacheBust && !shopId && !since && (!category || category === 'All') && !flashOnly

        // Check Cloudflare Edge RAM cache for lightning-fast ~8ms response
        if (isGlobalPublicQuery && typeof caches !== 'undefined' && caches.default) {
          try {
            const cacheKey = new Request(url.origin + url.pathname + url.search, request)
            const cachedRes = await caches.default.match(cacheKey)
            if (cachedRes) {
              const clientEtag = request.headers.get('If-None-Match')
              const cachedEtag = cachedRes.headers.get('ETag')

              if (clientEtag && cachedEtag && clientEtag === cachedEtag) {
                return new Response(null, {
                  status: 304,
                  headers: {
                    'ETag': cachedEtag,
                    'Cache-Control': cachedRes.headers.get('Cache-Control') || 'public, max-age=45',
                    ...corsHeaders()
                  }
                })
              }

              const fastRes = new Response(cachedRes.body, cachedRes)
              Object.entries(corsHeaders()).forEach(([k, v]) => fastRes.headers.set(k, v))
              return fastRes
            }
          } catch (cacheErr) {
            console.warn('Cache lookup error, falling through to D1:', cacheErr)
          }
        }

        return await handleListProducts(env, url, request, ctx)
      }
      return json({ error: 'Not found' }, 404)
    } catch (err) {
      // Auth failures -> 401 with reason. Everything else -> generic 500 so internal
      // details (DB driver messages, stack traces) never leak to clients.
      if (err instanceof AuthError) {
        return json({ error: err.message }, 401)
      }
      console.error('Unhandled worker error:', err)
      return json({ error: 'Internal server error' }, 500)
    }
}

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: { ...corsHeaders(request), ...securityHeaders() } })
    }

    const response = await routeRequest(request, env, ctx)

    // Central hardening: per-request CORS (origin allowlist) + security
    // headers on EVERY response — handlers can never forget them. The
    // delete-then-set matters: inner handler responses carry a wildcard
    // ACAO, which must not survive when the origin is rejected.
    const out = new Response(response.body, response)
    out.headers.delete('Access-Control-Allow-Origin')
    for (const [k, v] of Object.entries(corsHeaders(request))) out.headers.set(k, v)
    for (const [k, v] of Object.entries(securityHeaders())) out.headers.set(k, v)
    return out
  }
}

