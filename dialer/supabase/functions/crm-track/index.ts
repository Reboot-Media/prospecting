// crm-track: page views from rebootmedia.us, for buyer intent.
// The site snippet (Integrations → Website tracking, or a GTM custom HTML tag) posts
// { v: visitor id, rb: contact id from ?rb= on email links, page, ref }.
// Once a visitor arrives through a tracked link, their earlier and later visits
// are tied to that roofer and each one can start a "Visited rebootmedia.us" workflow.
import { db, json } from '../_shared/common.ts'

const ORIGINS = [/^https:\/\/(www\.)?rebootmedia\.us$/, /^https:\/\/[a-z0-9-]+\.rebootmedia\.us$/, /^https:\/\/[a-z0-9-]+\.pages\.dev$/, /^http:\/\/localhost(:\d+)?$/]
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

Deno.serve(async (req) => {
  const origin = req.headers.get('origin') || ''
  const cors = {
    'access-control-allow-origin': ORIGINS.some((r) => r.test(origin)) ? origin : 'https://rebootmedia.us',
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
    vary: 'origin',
  }
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })
  if (req.method !== 'POST') return json({ ok: true }, 200, cors)
  if (origin && !ORIGINS.some((r) => r.test(origin))) return json({ error: 'origin' }, 403, cors)

  const b = await req.json().catch(() => ({}))
  const visitor = String(b.v || '').slice(0, 64)
  const page = String(b.page || '/').slice(0, 300).split('?')[0]
  const referrer = String(b.ref || '').slice(0, 300)
  if (!visitor) return json({ ok: false }, 400, cors)
  const sb = db()

  let lead_id: string | null = null
  if (UUID.test(String(b.rb || ''))) {
    const { data } = await sb.from('crm_leads').select('id').eq('id', b.rb).maybeSingle()
    if (data) {
      lead_id = data.id
      await sb.from('crm_site_visits').update({ lead_id }).eq('visitor', visitor).is('lead_id', null)
    }
  }
  if (!lead_id) {
    const { data } = await sb.from('crm_site_visits').select('lead_id').eq('visitor', visitor).not('lead_id', 'is', null).limit(1).maybeSingle()
    lead_id = data?.lead_id ?? null
  }

  // One row per visitor and page per half hour.
  const since = new Date(Date.now() - 30 * 60e3).toISOString()
  const { data: recent } = await sb.from('crm_site_visits').select('id').eq('visitor', visitor).eq('page', page).gte('created_at', since).limit(1)
  if (!recent?.length) await sb.from('crm_site_visits').insert({ lead_id, visitor, page, referrer })
  return json({ ok: true }, 200, cors)
})
