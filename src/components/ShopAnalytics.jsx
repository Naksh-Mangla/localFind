import React, { useState, useEffect, useCallback } from 'react'
import { apiFetch } from '../lib/api'

const RANGES = [
  { days: 7, label: '7 days' },
  { days: 28, label: '28 days' },
  { days: 90, label: '90 days' }
]

function KpiCard({ icon, label, value, sub }) {
  return (
    <div className="bg-surface-container-lowest dark:bg-zinc-900 border border-surface-variant/60 rounded-2xl p-4 flex flex-col gap-1 shadow-crisp-xs min-w-0">
      <div className="flex items-center gap-1.5 text-on-surface-variant">
        <span className="material-symbols-outlined text-base text-primary">{icon}</span>
        <span className="text-[11px] font-bold uppercase tracking-wider truncate">{label}</span>
      </div>
      <div className="text-2xl font-black text-on-surface tracking-tight">{value}</div>
      {sub && <div className="text-[11px] text-on-surface-variant font-medium">{sub}</div>}
    </div>
  )
}

// Simple SVG line chart: zero deps, easy to read on mobile
function TimeSeriesChart({ points }) {
  const width = 560
  const height = 160
  const pad = 28
  if (!points || points.length === 0) {
    return <p className="text-xs text-on-surface-variant text-center py-6">No views yet — share your Store QR to get first customers.</p>
  }
  const views = points.map((p) => Number(p.detail_opens) || 0)
  const leads = points.map((p) => Number(p.whatsapp_clicks) || 0)
  const max = Math.max(1, ...views, ...leads)
  const stepX = points.length > 1 ? (width - pad * 2) / (points.length - 1) : 0
  const y = (v) => height - pad - (v / max) * (height - pad * 2)
  const x = (i) => (points.length > 1 ? pad + i * stepX : width / 2)
  const line = (arr) => arr.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full min-w-[320px] h-40" role="img" aria-label="Views over time">
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <line key={f} x1={pad} x2={width - pad} y1={y(max * f)} y2={y(max * f)} stroke="currentColor" strokeOpacity="0.08" strokeDasharray="4 4" />
        ))}
        <path d={line(views)} fill="none" stroke="#9c3e20" strokeWidth="2.5" strokeLinecap="round" />
        <path d={line(leads)} fill="none" stroke="#059669" strokeWidth="2" strokeDasharray="6 3" strokeLinecap="round" />
        {views.map((v, i) => (
          <circle key={i} cx={x(i)} cy={y(v)} r="3" fill="#9c3e20" stroke="#fff" strokeWidth="1.5">
            <title>{`${points[i].date}: ${v} views, ${leads[i]} WhatsApp`}</title>
          </circle>
        ))}
      </svg>
      <div className="flex items-center justify-between text-[10px] text-on-surface-variant font-semibold mt-1">
        <span>{points[0]?.date?.slice(5)}</span>
        <span className="flex items-center gap-3">
          <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-primary inline-block rounded" /> Views</span>
          <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-emerald-600 inline-block rounded" /> WhatsApp</span>
        </span>
        <span>{points[points.length - 1]?.date?.slice(5)}</span>
      </div>
    </div>
  )
}

function FunnelBar({ label, value, max, color, conv }) {
  const pct = max > 0 ? Math.max(4, Math.round((value / max) * 100)) : 0
  return (
    <div className="flex items-center gap-3">
      <span className="text-[11px] font-bold text-on-surface-variant w-24 shrink-0 truncate">{label}</span>
      <div className="flex-1 h-6 bg-surface-container-high rounded-full overflow-hidden border border-surface-variant/50">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-black text-on-surface w-10 text-right">{value}</span>
      {conv != null && <span className="text-[10px] font-bold text-on-surface-variant w-11 text-right shrink-0">{conv}%</span>}
    </div>
  )
}

// Peak shopping hours: UTC buckets shifted to IST (+5:30) for shopkeepers.
// Only the UTC hour is stored, so the :30 half-hour can't be placed exactly:
// flooring skews each bucket ~30 min early. Fine at hourly resolution.
// Counts are unique viewers per hour (daily dedupe), not raw footfall.
function PeakHoursChart({ hourly }) {
  const toIST = (h) => (h + 5.5) % 24
  const ist = Array.from({ length: 24 }, () => 0)
  for (const row of hourly || []) {
    const h = Number(row?.hour)
    if (Number.isInteger(h) && h >= 0 && h < 24) {
      ist[Math.floor(toIST(h))] += Number(row?.viewers) || 0
    }
  }
  const max = Math.max(1, ...ist)
  const blocks = [
    { name: 'Morning', range: [6, 7, 8, 9, 10, 11], icon: 'sunny' },
    { name: 'Afternoon', range: [12, 13, 14, 15, 16], icon: 'light_mode' },
    { name: 'Evening', range: [17, 18, 19, 20], icon: 'sunset' },
    { name: 'Night', range: [21, 22, 23, 0, 1, 2, 3, 4, 5], icon: 'bedtime' }
  ]
  const inBlock = (h, range) => range.includes(h)
  const blockTotals = blocks.map((b) => ist.reduce((s, v, h) => s + (inBlock(h, b.range) ? v : 0), 0))
  const peakIdx = blockTotals.indexOf(Math.max(...blockTotals, 1))
  const hasData = blockTotals.some((v) => v > 0)
  const fmtHour = (h) => {
    const hh = ((h % 12) === 0 ? 12 : h % 12)
    return `${hh}${h < 12 ? 'a' : 'p'}`
  }

  if (!hasData) {
    return <p className="text-xs text-on-surface-variant text-center py-6">Not enough views yet to spot peak hours.</p>
  }
  return (
    <div>
      <div className="flex items-end gap-[3px] h-28" role="img" aria-label="Shoppers per hour in Indian time">
        {ist.map((v, h) => (
          <div key={h} className="flex-1 flex flex-col justify-end items-center gap-1 h-full" title={`${fmtHour(h)}: ${v} shoppers`}>
            <div
              className={`w-full rounded-t-md transition-all ${v === max && max > 0 ? 'bg-primary' : 'bg-primary/35'}`}
              style={{ height: `${Math.max(4, Math.round((v / max) * 100))}%` }}
            />
            {h % 3 === 0 && <span className="text-[8px] font-bold text-on-surface-variant">{fmtHour(h)}</span>}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2 mt-3">
        {blocks.map((b, i) => (
          <div key={b.name} className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-bold ${i === peakIdx ? 'bg-primary/10 border-primary/40 text-primary' : 'bg-surface-container-high border-surface-variant/50 text-on-surface-variant'}`}>
            <span className="material-symbols-outlined text-base">{b.icon}</span>
            <span className="flex-1">{b.name}</span>
            <span>{blockTotals[i]}</span>
            {i === peakIdx && <span className="text-[9px] bg-primary text-white px-1.5 py-0.5 rounded-full font-black">PEAK</span>}
          </div>
        ))}
      </div>
      <p className="text-[10px] text-on-surface-variant mt-2">Hours in Indian time. Tip: launch Flash Deals 30 min before your peak block.</p>
    </div>
  )
}

export function ShopAnalytics({ shop, products = [] }) {
  const [days, setDays] = useState(7)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [sortKey, setSortKey] = useState('detail_opens')
  const [sortDir, setSortDir] = useState(-1)

  const fetchAnalytics = useCallback(async (d) => {
    if (!shop?.id) return
    try {
      setLoading(true)
      setError('')
      const res = await apiFetch(`/api/analytics/shop?shop_id=${encodeURIComponent(shop.id)}&days=${d}`, { bustCache: true })
      setData(res)
    } catch (e) {
      setError(e.message || 'Could not load analytics')
    } finally {
      setLoading(false)
    }
  }, [shop?.id])

  useEffect(() => {
    fetchAnalytics(days)
  }, [fetchAnalytics, days])

  const totals = data?.totals || {}
  const views = Number(totals.detail_opens) || 0
  const whatsapp = Number(totals.whatsapp_clicks) || 0
  const directions = Number(totals.directions_clicks) || 0
  const calls = Number(totals.call_clicks) || 0
  const claims = Number(totals.flash_claims) || 0
  const unique = Number(totals.unique_viewers) || 0
  const impressions = Number(totals.impressions) || 0
  const funnelMax = Math.max(1, impressions, views, whatsapp, calls, directions, claims)
  // null (hidden) when there is no denominator — never a fake 100%.
  // Capped at 100: funnel steps are independent per-action rates (a signed-in
  // action without a logged-in open can otherwise read 150%).
  const conv = (part, whole) => (whole > 0 ? Math.min(100, Math.round((part / whole) * 1000) / 10) : null)
  const keywords = data?.top_keywords || []
  const areas = data?.area_reach || []

  const displayName = (r) => r.product_name || products.find((p) => String(p.id) === String(r.product_id))?.name || ''
  const rows = [...(data?.by_product || [])].sort((a, b) => {
    if (sortKey === 'product_name') {
      return displayName(a).localeCompare(displayName(b), 'en-IN') * (sortDir === -1 ? -1 : 1)
    }
    const av = Number(a[sortKey]) || 0
    const bv = Number(b[sortKey]) || 0
    return (av - bv) * sortDir
  })

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir((d) => -d)
    else {
      setSortKey(key)
      // Numbers read best biggest-first, names A-to-Z
      setSortDir(key === 'product_name' ? 1 : -1)
    }
  }

  const productName = (id) => {
    const found = products.find((p) => String(p.id) === String(id))
    return found?.name || null
  }

  if (!shop?.id) return null

  return (
    <section className="bg-surface-container-lowest border border-surface-variant/50 rounded-3xl p-5 sm:p-6 shadow-crisp-xs mb-5">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="font-bold text-base text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">insights</span>
            <span>My Business — like YouTube Studio</span>
          </h3>
          <p className="text-[11px] text-on-surface-variant mt-0.5">Views, WhatsApp leads and best products. Only totals — no buyer names shown.</p>
        </div>
        <div className="flex items-center gap-1.5 bg-surface-container-high border border-surface-variant/60 rounded-full p-1">
          {RANGES.map((r) => (
            <button
              key={r.days}
              onClick={() => setDays(r.days)}
              className={`px-3 py-1.5 rounded-full text-[11px] font-bold transition-all active:scale-95 ${days === r.days ? 'bg-primary text-white shadow-xs' : 'text-on-surface-variant hover:text-on-surface'}`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10 text-xs text-on-surface-variant gap-2">
          <span className="w-5 h-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <span>Loading your business numbers...</span>
        </div>
      ) : error ? (
        <div className="text-center py-6">
          <p className="text-xs text-rose-600 font-bold mb-2">{error}</p>
          <button onClick={() => fetchAnalytics(days)} className="px-4 py-2 bg-primary text-white rounded-full text-xs font-bold active:scale-95">Retry</button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-2.5 mb-5">
            <KpiCard icon="visibility" label="Product views" value={views} sub={`Last ${days} days`} />
            <KpiCard icon="chat" label="WhatsApp leads" value={whatsapp} sub={views > 0 ? `${Math.round((whatsapp / Math.max(1, views)) * 100)} per 100 views` : 'Share QR to grow'} />
            <KpiCard icon="call" label="Phone calls" value={calls} sub="Tapped Call Store" />
            <KpiCard icon="near_me" label="Direction taps" value={directions} sub="Want to visit shop" />
            <KpiCard icon="bolt" label="Deal claims" value={claims} sub="Flash deals claimed" />
            <KpiCard icon="group" label="Unique viewers" value={unique} sub={impressions > 0 ? `${totals.ctr_percent}% opened after seeing` : 'Logged-in buyers'} />
          </div>

          <div className="grid md:grid-cols-5 gap-4 mb-5">
            <div className="md:col-span-3 bg-surface rounded-2xl border border-surface-variant/50 p-4">
              <h4 className="text-xs font-bold text-on-surface mb-2">Views over time</h4>
              <TimeSeriesChart points={data?.timeseries} />
            </div>
            <div className="md:col-span-2 bg-surface rounded-2xl border border-surface-variant/50 p-4 flex flex-col gap-2.5 justify-center">
              <h4 className="text-xs font-bold text-on-surface">How people buy</h4>
              {impressions > 0 && <FunnelBar label="Saw in list" value={impressions} max={funnelMax} color="bg-surface-variant" />}
              <FunnelBar label="Opened product" value={views} max={funnelMax} color="bg-primary" conv={conv(views, impressions)} />
              <FunnelBar label="WhatsApp" value={whatsapp} max={funnelMax} color="bg-emerald-500" conv={conv(whatsapp, views)} />
              <FunnelBar label="Phone calls" value={calls} max={funnelMax} color="bg-sky-500" conv={conv(calls, views)} />
              <FunnelBar label="Directions" value={directions} max={funnelMax} color="bg-amber-500" conv={conv(directions, views)} />
              <FunnelBar label="Deal claims" value={claims} max={funnelMax} color="bg-rose-500" conv={conv(claims, views)} />
              <p className="text-[10px] text-on-surface-variant mt-1">Direction taps = real foot traffic, even without a WhatsApp message.</p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4 mb-5">
            <div className="bg-surface rounded-2xl border border-surface-variant/50 p-4">
              <h4 className="text-xs font-bold text-on-surface mb-2 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm text-primary">schedule</span>
                <span>Peak shopping hours</span>
              </h4>
              <PeakHoursChart hourly={data?.hourly} />
            </div>
            <div className="flex flex-col gap-4">
              <div className="bg-surface rounded-2xl border border-surface-variant/50 p-4">
                <h4 className="text-xs font-bold text-on-surface mb-2 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm text-primary">search</span>
                  <span>Top search keywords</span>
                </h4>
                {keywords.length === 0 ? (
                  <p className="text-[11px] text-on-surface-variant">No searches led here yet. When buyers type words that show your items, the top words appear here.</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {keywords.map((k) => (
                      <span key={k.query} className="inline-flex items-center gap-1.5 bg-primary/10 border border-primary/25 text-on-surface px-2.5 py-1 rounded-full text-[11px] font-bold">
                        <span>{k.query}</span>
                        <span className="text-primary font-black">{k.count}</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="bg-surface rounded-2xl border border-surface-variant/50 p-4">
                <h4 className="text-xs font-bold text-on-surface mb-2 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm text-primary">location_on</span>
                  <span>Customer areas (pincode)</span>
                </h4>
                {areas.length === 0 ? (
                  <p className="text-[11px] text-on-surface-variant">No area data yet. Shoppers who saved their address contribute their pincode here.</p>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {areas.map((a) => (
                      <div key={a.pincode} className="flex items-center gap-2 text-[11px] font-bold">
                        <span className="bg-surface-container-high border border-surface-variant/60 px-2 py-0.5 rounded-lg text-on-surface">{a.pincode}</span>
                        <div className="flex-1 h-2 bg-surface-container-high rounded-full overflow-hidden">
                          <div className="h-full bg-primary/70 rounded-full" style={{ width: `${Math.max(5, Math.round((a.count / Math.max(1, areas[0].count)) * 100))}%` }} />
                        </div>
                        <span className="text-on-surface-variant w-8 text-right">{a.count}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-xs font-bold text-on-surface mb-2">Top products (tap header to sort)</h4>
            {rows.length === 0 ? (
              <div className="bg-surface rounded-2xl border border-dashed border-surface-variant p-6 text-center">
                <p className="text-xs font-bold text-on-surface mb-1">No views yet in last {days} days</p>
                <p className="text-[11px] text-on-surface-variant">New products and Flash Deals bring first views. Your Store QR on the counter helps most.</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-surface-variant/50">
                <table className="w-full text-xs min-w-[640px]">
                  <thead>
                    <tr className="bg-surface-container-high text-on-surface-variant text-[10px] uppercase tracking-wider">
                      {[
                        ['product_name', 'Product'],
                        ['detail_opens', 'Views'],
                        ['whatsapp_clicks', 'WhatsApp'],
                        ['call_clicks', 'Calls'],
                        ['directions_clicks', 'Visit'],
                        ['flash_claims', 'Claims'],
                        ['wishlists', 'Saved']
                      ].map(([key, label]) => (
                        <th key={key} className="text-left font-bold px-3 py-2.5">
                          <button onClick={() => toggleSort(key)} className="inline-flex items-center gap-1 hover:text-primary">
                            <span>{label}</span>
                            {sortKey === key && <span>{sortDir === -1 ? '↓' : '↑'}</span>}
                          </button>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 15).map((r) => (
                      <tr key={r.product_id} className="border-t border-surface-variant/40 hover:bg-primary/5">
                        <td className="px-3 py-2.5 font-bold text-on-surface max-w-[180px] truncate" title={r.product_name || productName(r.product_id) || r.product_id}>
                          {r.product_name || productName(r.product_id) || 'Product'}
                          {r.product_price != null && <span className="block text-[10px] font-semibold text-on-surface-variant">₹{r.product_price}</span>}
                        </td>
                        <td className="px-3 py-2.5 font-black text-on-surface">{r.detail_opens || 0}</td>
                        <td className="px-3 py-2.5 font-bold text-emerald-700 dark:text-emerald-400">{r.whatsapp_clicks || 0}</td>
                        <td className="px-3 py-2.5">{r.call_clicks || 0}</td>
                        <td className="px-3 py-2.5">{r.directions_clicks || 0}</td>
                        <td className="px-3 py-2.5 font-bold text-rose-600 dark:text-rose-400">{r.flash_claims || 0}</td>
                        <td className="px-3 py-2.5">{r.wishlists || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </section>
  )
}
