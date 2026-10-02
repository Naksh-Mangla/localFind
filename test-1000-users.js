#!/usr/bin/env node
/**
 * LocalFind load test + realistic user simulation.
 * Simulates up to 1,000 concurrent human users (shoppers / buyers / merchants)
 * with real Firebase Authentication against the Cloudflare Worker API.
 *
 * MAPPED TO THE REAL API (see worker/src/index.js):
 *   POST https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=KEY
 *   GET  {BASE}/api/shops                      (public shop list)
 *   GET  {BASE}/api/products?limit=&shop_id=&flash_deals_only=
 *   GET  {BASE}/api/reviews?shop_id=           (public)
 *   POST {BASE}/api/reviews                    {shop_id, rating, comment, user_name} (auth)
 *   POST {BASE}/api/shops                      {shop_name, whatsapp_number, lat, lng, ...} (auth)
 *   POST {BASE}/api/products                   {shop_id, name, price, category, ...} (auth)
 *   GET  {BASE}/api/my-shop                    (auth, own shop)
 *   GET  {BASE}/api/subscription               (auth)
 *   GET  {BASE}/api/analytics/shop?shop_id=&days=  (auth, owner-only)
 *   POST {BASE}/api/analytics/track            {event_type, product_id, shop_id, buyer_pincode} (auth)
 *   POST {BASE}/api/analytics/track-search     {query, shop_ids, buyer_pincode} (auth)
 *   Real event_type values: impression, detail_open, whatsapp_click,
 *   directions_click, call_click, flash_claim, share, wishlist, review
 *
 * USAGE:
 *   VITE_FIREBASE_API_KEY=xxxx node test-1000-users.js [--users=1000] [--ramp=50]
 *     [--ramp-every-ms=5000] [--duration-s=120] [--base-url=https://...]
 *     [--allow-writes] [--seed=42]
 *
 * SAFETY:
 *   - Auth phase creates REAL anonymous Firebase users (counts toward your
 *     project). Start small: --users=10 --duration-s=30.
 *   - WITHOUT --allow-writes every step is read-only or fail-soft tracking:
 *     safe against production. Reviews / shops / products are NEVER created.
 *   - WITH --allow-writes the script creates shops/products/reviews prefixed
 *     "[LOADTEST]" so you can find and delete them afterwards. It prints the
 *     cleanup SQL at the end. Prefer a staging worker + test DB for this mode.
 */

const CONFIG = {
  baseUrl: process.env.LOCALFIND_WORKER_URL || 'https://localfind-api.ishantaggarwall931.workers.dev',
  apiKey: process.env.VITE_FIREBASE_API_KEY || process.argv.find((a) => a.startsWith('--api-key='))?.split('=')[1] || '',
  users: Number((process.argv.find((a) => a.startsWith('--users=')) || '').split('=')[1]) || 1000,
  rampBatch: Number((process.argv.find((a) => a.startsWith('--ramp=')) || '').split('=')[1]) || 50,
  rampEveryMs: Number((process.argv.find((a) => a.startsWith('--ramp-every-ms=')) || '').split('=')[1]) || 5000,
  durationS: Number((process.argv.find((a) => a.startsWith('--duration-s=')) || '').split('=')[1]) || 120,
  allowWrites: process.argv.includes('--allow-writes'),
  seed: Number((process.argv.find((a) => a.startsWith('--seed=')) || '').split('=')[1]) || 42,
  authConcurrency: Number((process.argv.find((a) => a.startsWith('--auth-concurrency=')) || '').split('=')[1]) || 25,
  authDelayMs: Number((process.argv.find((a) => a.startsWith('--auth-delay-ms=')) || '').split('=')[1]) || 0,
  noAuth: process.argv.includes('--no-auth'),
};

// --- deterministic PRNG (mulberry32) so runs are reproducible ----------------
let _s = CONFIG.seed >>> 0;
const rnd = () => {
  _s |= 0; _s = (_s + 0x6d2b79f5) | 0;
  let t = Math.imul(_s ^ (_s >>> 15), 1 | _s);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const int = (min, max) => min + Math.floor(rnd() * (max - min + 1));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const SEARCH_KEYWORDS = ['kurti', 'charger', 'mithai', 'shoes', 'milk', 'saree', 'earbuds', 'atta', 'battry', 'parle-g'];
const REVIEW_COMMENTS = ['Bahut badhiya shop!', 'Fresh stock, good price', 'Nice behaviour', 'Quick service', 'Sahi rate me mila'];
const PINCODES = ['110001', '110045', '201301', '400050', '560038'];
// Delhi-area jitter so merchant shops land in realistic spots.
const SHOP_SPOTS = [
  { lat: 28.6315, lng: 77.2167 }, { lat: 28.6139, lng: 77.209 }, { lat: 28.5708, lng: 77.3271 },
  { lat: 28.6601, lng: 77.2100 }, { lat: 28.5921, lng: 77.3105 },
];

// --- metrics -----------------------------------------------------------------
const latencies = []; // ms, successful + failed-with-status (excludes network errors)
const statusBuckets = { '2xx': 0, '4xx': 0, '5xx': 0, network_error: 0 };
const perRoute = new Map(); // "METHOD path" -> {ok, fail, lat[]}
let totalRequests = 0;
const testStart = Date.now();

async function call(method, path, { token = null, body = null, tag = null } = {}) {
  const route = `${method} ${path.split('?')[0]}`;
  const t0 = Date.now();
  totalRequests++;
  try {
    const res = await fetch(CONFIG.baseUrl + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const ms = Date.now() - t0;
    latencies.push(ms);
    const ok = res.status >= 200 && res.status < 300;
    statusBuckets[res.status >= 500 ? '5xx' : res.status >= 400 ? '4xx' : '2xx']++;
    const r = perRoute.get(route) || { ok: 0, fail: 0, lat: [] };
    ok ? r.ok++ : r.fail++;
    r.lat.push(ms);
    perRoute.set(route, r);
    let data = null;
    try {
      const t = await res.text();
      try { data = JSON.parse(t); } catch { /* non-JSON body */ }
    } catch { /* drain failed */ }
    return { status: res.status, ok, data };
  } catch {
    statusBuckets.network_error++;
    const r = perRoute.get(route) || { ok: 0, fail: 0, lat: [] };
    r.fail++;
    perRoute.set(route, r);
    return { status: 0, ok: false };
  }
}

// --- phase 1: fast batch Firebase signup, tokens cached per VU ---------------
async function signupBatch(count, concurrency = CONFIG.authConcurrency) {
  const tokens = new Array(count);
  let done = 0, failed = 0;
  const worker = async (idx) => {
    if (CONFIG.authDelayMs) await sleep(CONFIG.authDelayMs * (idx % concurrency));
    try {
      const res = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${CONFIG.apiKey}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ returnSecureToken: true }) }
      );
      const data = await res.json().catch(() => ({}));
      if (data.idToken) tokens[idx] = { idToken: data.idToken, uid: data.localId };
      else failed++;
    } catch {
      failed++;
    }
    if (++done % 100 === 0 || done === count) process.stdout.write(`\r  auth: ${done}/${count} (failed: ${failed})`);
    if (CONFIG.authDelayMs) await sleep(CONFIG.authDelayMs);
  };
  const queue = Array.from({ length: count }, (_, i) => i);
  await Promise.all(Array.from({ length: Math.min(concurrency, count) }, async function run() {
    while (queue.length) await worker(queue.pop());
  }));
  process.stdout.write('\n');
  const good = tokens.filter(Boolean);
  console.log(`  authenticated virtual users: ${good.length}/${count}`);
  if (good.length === 0) throw new Error('No Firebase tokens minted — check VITE_FIREBASE_API_KEY.');
  return good;
}

// --- scenarios ---------------------------------------------------------------
const humanPause = () => sleep(int(1000, 4000)); // realistic 1–4s think time

async function shopperLoop(vu, ctx, until) {
  while (Date.now() < until) {
    await call('GET', '/api/shops', { token: vu.idToken });
    await sleep(int(500, 1500));
    // search like a human
    const q = pick(SEARCH_KEYWORDS);
    const matchedShopIds = ctx.shops.filter(() => rnd() < 0.3).map((s) => s.id).slice(0, 5);
    if (matchedShopIds.length) {
      await call('POST', '/api/analytics/track-search', {
        token: vu.idToken,
        body: { query: q, shop_ids: matchedShopIds, buyer_pincode: pick(PINCODES) },
      });
    }
    await humanPause();
    // view 3–5 product details
    const items = [...ctx.products].sort(() => rnd() - 0.5).slice(0, int(3, 5));
    for (const p of items) {
      await call('POST', '/api/analytics/track', {
        token: vu.idToken,
        body: { event_type: 'detail_open', product_id: p.id, shop_id: p.shop_id, buyer_pincode: pick(PINCODES) },
      });
      await call('GET', `/api/reviews?shop_id=${encodeURIComponent(p.shop_id)}`, { token: vu.idToken });
      if (rnd() < 0.35) {
        await call('POST', '/api/analytics/track', {
          token: vu.idToken,
          body: { event_type: 'whatsapp_click', product_id: p.id, shop_id: p.shop_id, buyer_pincode: pick(PINCODES) },
        });
      }
      await humanPause();
      if (Date.now() >= until) break;
    }
  }
}

async function buyerLoop(vu, ctx, until) {
  while (Date.now() < until) {
    // flash deals = filtered products feed (no separate endpoint)
    await call('GET', '/api/products?flash_deals_only=1&limit=20', { token: vu.idToken });
    await humanPause();
    const target = pick(ctx.shops);
    if (target) {
      // open store QR details ~= shop context + its products
      await call('GET', `/api/products?shop_id=${encodeURIComponent(target.id)}`, { token: vu.idToken });
      // 5-star rating (write-gated; otherwise just read existing reviews)
      if (CONFIG.allowWrites) {
        await call('POST', '/api/reviews', {
          token: vu.idToken,
          body: { shop_id: target.id, rating: 5, comment: pick(REVIEW_COMMENTS), user_name: `LoadTester${int(1, 9999)}` },
        });
      } else {
        await call('GET', `/api/reviews?shop_id=${encodeURIComponent(target.id)}`, { token: vu.idToken });
      }
    }
    await humanPause();
  }
}

async function merchantLoop(vu, ctx, until) {
  if (CONFIG.allowWrites) {
    // create one clearly-marked loadtest shop per merchant VU
    const spot = pick(SHOP_SPOTS);
    const phone = String(int(6000000000, 9999999999));
    const created = await call('POST', '/api/shops', {
      token: vu.idToken,
      body: {
        shop_name: `[LOADTEST] Shop ${vu.uid.slice(0, 6)}`,
        whatsapp_number: phone,
        lat: spot.lat + (rnd() - 0.5) * 0.02,
        lng: spot.lng + (rnd() - 0.5) * 0.02,
        address_text: 'Loadtest Market',
      },
    });
    await sleep(500);
    // read back own shop (owner-only paths) + dashboard polls
    await call('GET', '/api/my-shop', { token: vu.idToken });
    await call('GET', '/api/subscription', { token: vu.idToken });
    // add a product + open the analytics dashboard for the new shop
    const myShopId = created.data && created.data.id;
    if (myShopId) {
      await call('POST', '/api/products', {
        token: vu.idToken,
        body: {
          shop_id: myShopId,
          name: `[LOADTEST] Item ${int(100, 999)}`,
          price: int(10, 500),
          category: 'General',
        },
      });
      await call('GET', `/api/analytics/shop?shop_id=${encodeURIComponent(myShopId)}&days=7`, { token: vu.idToken });
    }
    await call('GET', '/api/products?limit=20', { token: vu.idToken });
  } else {
    // read-only merchant: dashboard polls that never mutate prod
    await call('GET', '/api/my-shop', { token: vu.idToken });
    await call('GET', '/api/subscription', { token: vu.idToken });
    await call('GET', '/api/shops', { token: vu.idToken });
  }
  while (Date.now() < until) {
    await call('GET', '/api/products?limit=20', { token: vu.idToken });
    await sleep(int(2000, 5000));
  }
}

// --- no-auth public traffic (no Firebase needed) --------------------------------
async function publicLoop(vu, ctx, until) {
  while (Date.now() < until) {
    await call('GET', '/api/shops');
    await sleep(int(400, 1200));
    await call('GET', `/api/products?limit=50&category=${encodeURIComponent(pick(['All', 'Groceries', 'Fashion', 'Electronics']))}`);
    await sleep(int(500, 1500));
    if (rnd() < 0.5 && ctx.shops.length) {
      await call('GET', `/api/reviews?shop_id=${encodeURIComponent(pick(ctx.shops).id)}`);
    }
    if (rnd() < 0.3) {
      await call('GET', '/api/products?flash_deals_only=1&limit=20');
    }
    await sleep(int(800, 2500));
  }
}

// --- percentile + report ------------------------------------------------------
function pct(sorted, p) {
  if (!sorted.length) return 0;
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
}

function printReport(elapsedS) {
  const s = [...latencies].sort((a, b) => a - b);
  const rps = (totalRequests / elapsedS).toFixed(1);
  const line = '─'.repeat(72);
  console.log(`\n${line}\n  LOCALFIND LOAD TEST — SUMMARY\n${line}`);
  console.log(`  virtual users : ${CONFIG.users}  |  duration: ${elapsedS.toFixed(0)}s  |  writes: ${CONFIG.allowWrites ? 'ON ([LOADTEST] data)' : 'OFF (read-only)'}`);
  console.log(`  total requests: ${totalRequests}  |  throughput: ${rps} RPS`);
  console.log(`  2xx: ${statusBuckets['2xx']}  |  4xx: ${statusBuckets['4xx']}  |  5xx: ${statusBuckets['5xx']}  |  network errors: ${statusBuckets.network_error}`);
  console.log(`  latency ms    : p50 ${pct(s, 50)}  |  p95 ${pct(s, 95)}  |  p99 ${pct(s, 99)}  |  max ${s.length ? s[s.length - 1] : 0}`);
  console.log(`  ${line}\n  PER-ROUTE BREAKDOWN\n  ${line}`);
  console.log('  route'.padEnd(44) + 'ok'.padStart(8) + 'fail'.padStart(8) + 'p95-ms'.padStart(9));
  for (const [route, r] of [...perRoute.entries()].sort((a, b) => b[1].ok + b[1].fail - (a[1].ok + a[1].fail))) {
    const sl = [...r.lat].sort((a, b) => a - b);
    console.log('  ' + route.slice(0, 42).padEnd(42) + String(r.ok).padStart(8) + String(r.fail).padStart(8) + String(pct(sl, 95)).padStart(9));
  }
  console.log(`  ${line}`);
  if (CONFIG.allowWrites) {
    console.log('  CLEANUP (run in D1 — deletes loadtest shops, cascades to products):');
    console.log("    DELETE FROM shops WHERE shop_name LIKE '[LOADTEST]%';");
    console.log('  + delete the anonymous test users in Firebase Console > Authentication.');
    console.log(`  ${line}`);
  }
}

// --- main: ramp batches to avoid local port exhaustion -------------------------
async function main() {
  console.log(`LocalFind load test — ${CONFIG.users} users, ramp +${CONFIG.rampBatch}/${CONFIG.rampEveryMs}ms, ${CONFIG.durationS}s, writes ${CONFIG.allowWrites ? 'ON' : 'OFF'}${CONFIG.noAuth ? ', NO-AUTH public traffic' : ''}`);
  let users;
  if (CONFIG.noAuth) {
    console.log('Phase 1/3: skipped (no-auth mode — public endpoints only, zero writes, zero signups).');
    users = Array.from({ length: CONFIG.users }, (_, i) => ({ idToken: null, uid: `anon-${i}` }));
  } else {
    if (!CONFIG.apiKey) throw new Error('Missing Firebase key: set VITE_FIREBASE_API_KEY env or --api-key=...');
    if (!CONFIG.allowWrites) console.log('Read-only mode: no shops/products/reviews will be created. Add --allow-writes for merchant writes.');
    console.log('Phase 1/3: minting Firebase tokens…');
    users = await signupBatch(CONFIG.users);
  }

  console.log('Phase 2/3: loading shared catalog snapshot…');
  const [shopsRes, productsRes] = await Promise.all([
    fetch(CONFIG.baseUrl + '/api/shops').then((r) => r.json()).catch(() => ({ shops: [] })),
    fetch(CONFIG.baseUrl + '/api/products?limit=100').then((r) => r.json()).catch(() => ({ products: [] })),
  ]);
  const ctx = {
    shops: shopsRes.shops || [],
    products: productsRes.products || [],
  };
  console.log(`  catalog: ${ctx.shops.length} shops, ${ctx.products.length} products`);
  if (!ctx.products.length) console.log('  WARNING: empty catalog — detail/review steps will be thin. Seed products first for a realistic run.');

  console.log('Phase 3/3: ramping virtual users… (Ctrl+C to stop early, report still prints)');
  const stopAt = Date.now() + CONFIG.durationS * 1000;
  const runners = [];
  let started = 0;
  const roles = users.map((_, i) => (i % 100 < 60 ? 'shopper' : i % 100 < 85 ? 'buyer' : 'merchant'));

  process.on('SIGINT', () => {
    console.log('\nInterrupted.');
    printReport((Date.now() - testStart) / 1000);
    process.exit(0);
  });

  while (started < users.length) {
    const batch = users.slice(started, started + CONFIG.rampBatch);
    for (let k = 0; k < batch.length; k++) {
      const vu = batch[k];
      const role = roles[started + k];
      const fn = CONFIG.noAuth ? publicLoop : role === 'shopper' ? shopperLoop : role === 'buyer' ? buyerLoop : merchantLoop;
      runners.push(fn(vu, ctx, stopAt).catch(() => {}));
    }
    started += batch.length;
    process.stdout.write(`\r  running: ${started}/${users.length} VUs`);
    if (started < users.length) await sleep(CONFIG.rampEveryMs);
  }
  process.stdout.write('\n  all VUs running — measuring…\n');
  await Promise.all(runners);
  printReport((Date.now() - testStart) / 1000);
}

main().catch((e) => {
  console.error('Load test failed:', e.message);
  printReport((Date.now() - testStart) / 1000);
  process.exit(1);
});
