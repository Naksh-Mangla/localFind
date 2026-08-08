const corsHeaders = () => ({
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400'
})

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() }
  })

const b64UrlToBytes = (input) => {
  const pad = input.replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(pad)
  return Uint8Array.from(bin, (c) => c.charCodeAt(0))
}

const decodePayload = (payloadB64) =>
  JSON.parse(new TextDecoder().decode(b64UrlToBytes(payloadB64)))

async function getFirebaseJwks(env) {
  const jwksUrl = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'
  const res = await fetch(jwksUrl)
  if (!res.ok) throw new Error('Failed to fetch Firebase JWKS keys')
  const data = await res.json()
  return data.keys || []
}

async function verifyFirebaseIdToken(authHeader, env) {
  if (!authHeader?.startsWith('Bearer ')) throw new Error('Missing bearer token')
  const token = authHeader.slice(7)
  const [headerB64, payloadB64, signatureB64] = token.split('.')
  if (!headerB64 || !payloadB64 || !signatureB64) throw new Error('Malformed token')

  const header = decodePayload(headerB64)
  const payload = decodePayload(payloadB64)

  if (payload.exp && payload.exp * 1000 < Date.now()) throw new Error('Token expired')

  const projectId = env.FIREBASE_PROJECT_ID || 'localfind-2012'
  const validAudience = [env.FIREBASE_AUD, env.FIREBASE_PROJECT_ID, projectId, 'localfind-2012'].filter(Boolean)
  if (payload.aud && !validAudience.includes(payload.aud)) throw new Error('Invalid audience')
  if (payload.iss && payload.iss !== `https://securetoken.google.com/${projectId}`) {
    throw new Error('Invalid issuer')
  }

  const keys = await getFirebaseJwks(env)
  const jwk = keys.find((k) => k.kid === header.kid)
  if (!jwk) throw new Error('Unknown signing key')

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

  if (!valid) throw new Error('Invalid token signature')
  return payload
}

async function handleCreateShop(request, env, user) {
  const body = await request.json().catch(() => null)
  if (!body) return json({ error: 'Invalid JSON body' }, 400)

  const { shop_name, whatsapp_number, lat, lng, address_text } = body
  if (!shop_name || !whatsapp_number) return json({ error: 'shop_name and whatsapp_number are required' }, 400)
  if (typeof lat !== 'number' || !Number.isFinite(lat) || lat < -90 || lat > 90) {
    return json({ error: 'lat must be a number between -90 and 90' }, 400)
  }
  if (typeof lng !== 'number' || !Number.isFinite(lng) || lng < -180 || lng > 180) {
    return json({ error: 'lng must be a number between -180 and 180' }, 400)
  }

  await env.DB.prepare('PRAGMA foreign_keys = ON;').run()

  // Prevent duplicate shop rows per merchant by updating if shop exists for user.sub
  const existing = await env.DB.prepare('SELECT id FROM shops WHERE owner_id = ?').bind(user.sub).first()
  if (existing) {
    const res = await env.DB.prepare(
      `UPDATE shops
       SET shop_name = ?, whatsapp_number = ?, lat = ?, lng = ?, address_text = ?
       WHERE id = ? AND owner_id = ?`
    ).bind(shop_name, whatsapp_number, lat, lng, address_text ?? null, existing.id, user.sub).run()

    if (!res.success) return json({ error: res.error?.message ?? 'Update failed' }, 500)
    return json({ id: existing.id, updated: true }, 200)
  }

  const id = crypto.randomUUID()
  const res = await env.DB.prepare(
    `INSERT INTO shops (id, owner_id, shop_name, whatsapp_number, lat, lng, address_text)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, user.sub, shop_name, whatsapp_number, lat, lng, address_text ?? null).run()

  if (!res.success) return json({ error: res.error?.message ?? 'Insert failed' }, 500)
  return json({ id, created: true }, 201)
}

async function handleCreateProduct(request, env, user) {
  const body = await request.json().catch(() => null)
  if (!body) return json({ error: 'Invalid JSON body' }, 400)

  const { shop_id, name, price, category, image_url, is_affiliate_fallback, affiliate_link } = body
  if (!shop_id || !name || !category) return json({ error: 'shop_id, name and category are required' }, 400)
  if (typeof price !== 'number' || !Number.isFinite(price) || price < 0) return json({ error: 'price must be a valid positive number' }, 400)

  await env.DB.prepare('PRAGMA foreign_keys = ON;').run()

  const shop = await env.DB.prepare('SELECT id, owner_id FROM shops WHERE id = ?').bind(shop_id).first()
  if (!shop) return json({ error: 'Shop not found' }, 404)
  if (shop.owner_id !== user.sub) return json({ error: 'Forbidden: shop belongs to another user' }, 403)

  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  const res = await env.DB.prepare(
    `INSERT INTO products (id, shop_id, name, price, category, image_url, is_affiliate_fallback, affiliate_link, version, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`
  ).bind(
    id,
    shop_id,
    name,
    price,
    category,
    image_url ?? null,
    is_affiliate_fallback ? 1 : 0,
    affiliate_link ?? null,
    now
  ).run()

  if (!res.success) return json({ error: res.error?.message ?? 'Insert failed' }, 500)
  return json({ id }, 201)
}

async function handleUpdateProduct(request, env, user) {
  const body = await request.json().catch(() => null)
  if (!body) return json({ error: 'Invalid JSON body' }, 400)

  const { id, name, price, category, image_url, is_affiliate_fallback, affiliate_link } = body
  if (!id || !name || !category) return json({ error: 'id, name and category are required' }, 400)
  if (typeof price !== 'number' || !Number.isFinite(price) || price < 0) return json({ error: 'price must be a valid positive number' }, 400)

  await env.DB.prepare('PRAGMA foreign_keys = ON;').run()

  const prod = await env.DB.prepare(
    `SELECT p.id, s.owner_id FROM products p JOIN shops s ON s.id = p.shop_id WHERE p.id = ?`
  ).bind(id).first()

  if (!prod) return json({ error: 'Product not found' }, 404)
  if (prod.owner_id !== user.sub) return json({ error: 'Forbidden: product belongs to another shopkeeper' }, 403)

  const res = await env.DB.prepare(
    `UPDATE products
     SET name = ?, price = ?, category = ?, image_url = ?, is_affiliate_fallback = ?, affiliate_link = ?,
         version = COALESCE(version, 1) + 1,
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
     WHERE id = ?`
  ).bind(
    name,
    price,
    category,
    image_url ?? null,
    is_affiliate_fallback ? 1 : 0,
    affiliate_link ?? null,
    id
  ).run()

  if (!res.success) return json({ error: res.error?.message ?? 'Update failed' }, 500)
  return json({ success: true })
}

async function handleDeleteProduct(request, env, user, url) {
  const id = url.searchParams.get('id')
  if (!id) return json({ error: 'Product id parameter is required' }, 400)

  await env.DB.prepare('PRAGMA foreign_keys = ON;').run()

  const prod = await env.DB.prepare(
    `SELECT p.id, s.owner_id FROM products p JOIN shops s ON s.id = p.shop_id WHERE p.id = ?`
  ).bind(id).first()

  if (!prod) return json({ error: 'Product not found' }, 404)
  if (prod.owner_id !== user.sub) return json({ error: 'Forbidden: product belongs to another shopkeeper' }, 403)

  const res = await env.DB.prepare('DELETE FROM products WHERE id = ?').bind(id).run()
  if (!res.success) return json({ error: res.error?.message ?? 'Delete failed' }, 500)
  return json({ success: true })
}

async function handleListShops(env) {
  const { results } = await env.DB.prepare('SELECT * FROM shops ORDER BY created_at DESC').all()
  return json({ shops: results })
}

async function handleListProducts(env) {
  const { results } = await env.DB.prepare(
    `SELECT p.id, p.shop_id, p.name, p.price, p.category, p.image_url,
            p.is_affiliate_fallback, p.affiliate_link, p.version, p.updated_at, p.created_at,
            s.shop_name, s.whatsapp_number, s.lat, s.lng, s.address_text
     FROM products p
     JOIN shops s ON s.id = p.shop_id
     ORDER BY p.created_at DESC`
  ).all()
  return json({ products: results, app_version: '1.2.0' })
}

async function handleUploadImage(request, env, user) {
  if (!env.IMAGES_BUCKET) {
    return json({ error: 'R2 bucket binding "IMAGES_BUCKET" not configured on worker.' }, 500)
  }

  const formData = await request.formData().catch(() => null)
  if (!formData) return json({ error: 'Invalid form data' }, 400)

  const file = formData.get('file')
  if (!file || typeof file === 'string') return json({ error: 'No file uploaded' }, 400)

  const ext = file.name ? file.name.split('.').pop() : 'jpg'
  const key = `products/${user.sub}/${crypto.randomUUID()}.${ext}`

  await env.IMAGES_BUCKET.put(key, file.stream(), {
    httpMetadata: {
      contentType: file.type || 'image/jpeg'
    }
  })

  const publicBase = env.R2_PUBLIC_URL || 'https://pub-r2.dev'
  const url = `${publicBase}/${key}`

  return json({ url, key }, 201)
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders() })

    const url = new URL(request.url)

    try {
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
      if (request.method === 'GET' && url.pathname === '/api/shops') {
        return await handleListShops(env)
      }
      if (request.method === 'GET' && url.pathname === '/api/products') {
        return await handleListProducts(env)
      }
      return json({ error: 'Not found' }, 404)
    } catch (err) {
      return json({ error: err.message }, 401)
    }
  }
}

