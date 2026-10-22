// crm-enrich: reads a roofer's website and records which marketing and tracking
// tools it runs (GTM, GA4, Google Ads, Meta pixel, call tracking, chat, review and
// estimator widgets), plus Google rating and review count when GOOGLE_PLACES_KEY is set.
//
//   POST { lead_id }     from the app (signed-in teammate)
//   POST {} + x-cron-secret   every 15 minutes: the next 15 roofers never checked
import { checkHeader, db, json } from '../_shared/common.ts'

type Tags = Record<string, string[] | string>

const uniq = (a: string[]) => [...new Set(a)].slice(0, 5)
const all = (html: string, re: RegExp) => uniq([...html.matchAll(re)].map((m) => m[1] || m[0]))
const has = (html: string, list: [string, RegExp][]) => list.filter(([, re]) => re.test(html)).map(([n]) => n)

export function detect(html: string): Tags {
  const t: Tags = {}
  const put = (k: string, v: string[]) => {
    if (v.length) t[k] = v
  }
  put('gtm', all(html, /\b(GTM-[A-Z0-9]{4,9})\b/g))
  put('ga4', all(html, /\b(G-[A-Z0-9]{6,12})\b/g))
  put('google_ads', all(html, /\b(AW-\d{6,12})\b/g))
  put('meta_pixel', [
    ...all(html, /fbq\(\s*['"]init['"]\s*,\s*['"](\d{10,20})['"]/g),
    ...(/connect\.facebook\.net\/[^"']*fbevents\.js/.test(html) ? ['installed'] : []),
  ].filter((v, i, a) => !(v === 'installed' && a.length > 1)))
  put(
    'call_tracking',
    has(html, [
      ['CallRail', /callrail\.com|swap\.js/i],
      ['WhatConverts', /whatconverts\.com/i],
      ['CallTrackingMetrics', /tctm\.co|calltrackingmetrics/i],
      ['Invoca', /invoca\.net/i],
      ['GoHighLevel', /leadconnectorhq\.com|msgsndr\.com/i],
    ]),
  )
  put(
    'chat',
    has(html, [
      ['Podium', /podium\.com/i],
      ['Birdeye', /birdeye\.com\/widget|birdeye.*chat/i],
      ['Intercom', /intercom(cdn)?\.(io|com)/i],
      ['Drift', /drift\.com|js\.driftt\.com/i],
      ['Tawk', /tawk\.to/i],
      ['LiveChat', /livechatinc\.com/i],
      ['Facebook chat', /customerchat/i],
    ]),
  )
  put(
    'reviews_widget',
    has(html, [
      ['Birdeye', /birdeye\.com/i],
      ['Elfsight', /elfsight/i],
      ['Trustindex', /trustindex/i],
      ['NiceJob', /nicejob/i],
      ['GatherUp', /gatherup/i],
    ]),
  )
  put(
    'estimator',
    has(html, [
      ['Roofle', /roofle/i],
      ['Roofr', /roofr\.com/i],
      ['RoofQuote PRO', /roofquote/i],
      ['Instant estimate', /instant (roof )?(estimate|quote)/i],
    ]),
  )
  put(
    'crm',
    has(html, [
      ['GoHighLevel', /leadconnectorhq\.com|msgsndr\.com|highlevel/i],
      ['JobNimbus', /jobnimbus/i],
      ['AccuLynx', /acculynx/i],
      ['ServiceTitan', /servicetitan/i],
      ['HubSpot', /hs-scripts\.com|hubspot/i],
      ['Calendly', /calendly\.com/i],
    ]),
  )
  const builder = has(html, [
    ['WordPress', /wp-content|wp-includes/i],
    ['Wix', /wixstatic|wix\.com/i],
    ['Squarespace', /squarespace/i],
    ['Webflow', /webflow/i],
    ['GoDaddy', /godaddy|img1\.wsimg\.com/i],
    ['Duda', /dudaone|multiscreensite/i],
    ['Shopify', /cdn\.shopify\.com/i],
    ['GoHighLevel', /leadconnectorhq\.com/i],
  ])[0]
  if (builder) t.builder = builder
  return t
}

async function readSite(url: string) {
  const u = url.startsWith('http') ? url : `https://${url}`
  const r = await fetch(u, {
    redirect: 'follow',
    signal: AbortSignal.timeout(12000),
    headers: { 'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36' },
  })
  if (!r.ok) throw new Error(`Website answered ${r.status}`)
  const html = (await r.text()).slice(0, 2_000_000)
  // GTM containers hold the GA4/Ads/pixel tags; read the first one too.
  const gtm = html.match(/\bGTM-[A-Z0-9]{4,9}\b/)?.[0]
  let extra = ''
  if (gtm) {
    try {
      const g = await fetch(`https://www.googletagmanager.com/gtm.js?id=${gtm}`, { signal: AbortSignal.timeout(8000) })
      if (g.ok) extra = (await g.text()).slice(0, 1_500_000)
    } catch {
      /* container unreadable: the page alone is enough */
    }
  }
  return { html, extra }
}

async function places(company: string, city: string, state: string) {
  const key = Deno.env.get('GOOGLE_PLACES_KEY')
  if (!key) return null
  const r = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': 'places.rating,places.userRatingCount,places.googleMapsUri' },
    body: JSON.stringify({ textQuery: `${company} roofing ${city} ${state}`.trim(), maxResultCount: 1 }),
    signal: AbortSignal.timeout(8000),
  })
  const p = (await r.json().catch(() => ({})))?.places?.[0]
  return p ? { google_rating: p.rating ?? null, review_count: p.userRatingCount ?? null, gbp_url: p.googleMapsUri || '' } : null
}

async function teammate(req: Request) {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer /, '')
  if (!token) return false
  const sb = db()
  const { data } = await sb.auth.getUser(token)
  const email = data.user?.email?.toLowerCase()
  if (!email) return false
  const { data: t } = await sb.from('crm_team').select('name').eq('email', email).maybeSingle()
  return !!t
}

async function enrich(sb: ReturnType<typeof db>, lead: Record<string, any>) {
  const patch: Record<string, unknown> = { site_checked_at: new Date().toISOString(), updated_at: new Date().toISOString() }
  if (lead.website) {
    try {
      const { html, extra } = await readSite(lead.website)
      const t = detect(html)
      if (extra) {
        const g = detect(extra)
        for (const k of ['ga4', 'google_ads', 'meta_pixel'] as const) if (g[k] && !t[k]) t[k] = g[k]
      }
      patch.site_tags = t
    } catch (e) {
      patch.site_tags = { error: e instanceof Error && e.name === 'TimeoutError' ? 'Website took too long to answer' : (e as Error).message || 'Could not open the website' }
    }
  } else patch.site_tags = { error: 'No website on file' }
  if (lead.google_rating === null) {
    try {
      const p = await places(lead.company, lead.city, lead.state)
      if (p) Object.assign(patch, p)
    } catch {
      /* reviews stay unknown */
    }
  }
  await sb.from('crm_leads').update(patch).eq('id', lead.id)
  return patch
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })
  if (req.method !== 'POST') return json({ ok: true })
  const sb = db()
  const body = await req.json().catch(() => ({}))
  if (body.lead_id) {
    if (!(await teammate(req))) return json({ error: 'unauthorized' }, 401, CORS)
    const { data: lead } = await sb.from('crm_leads').select('*').eq('id', body.lead_id).maybeSingle()
    if (!lead) return json({ error: 'not found' }, 404, CORS)
    return json(await enrich(sb, lead), 200, CORS)
  }
  if (!(await checkHeader(req, 'x-cron-secret', 'CRON_SECRET'))) return json({ error: 'unauthorized' }, 401)
  const { data: due } = await sb.from('crm_leads').select('*').is('site_checked_at', null).neq('website', '').order('created_at').limit(15)
  for (const l of due || []) await enrich(sb, l)
  return json({ checked: due?.length || 0 })
})

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, apikey, content-type',
  'access-control-allow-methods': 'POST, OPTIONS',
}
