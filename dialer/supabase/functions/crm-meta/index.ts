// crm-meta: Meta (Facebook/Instagram) lead ads into the CRM.
//
//   GET  ?hub.mode=subscribe&hub.verify_token=…&hub.challenge=…   webhook check
//   POST leadgen change from Meta → fetch the lead → new or matched contact,
//        a "Meta lead ad" form fill (starts the "Meta lead" workflow) and a timeline note.
//
// Secrets (Supabase function secrets): META_VERIFY_TOKEN (any phrase you also type
// in Meta), META_APP_SECRET (checks Meta's signature), META_PAGE_TOKEN (page access
// token with leads_retrieval). Until they exist every request is refused.
import { db, json } from '../_shared/common.ts'

const env = (k: string) => Deno.env.get(k) || ''
const GRAPH = 'https://graph.facebook.com/v21.0'

function e164(p: string) {
  const d = (p || '').replace(/\D/g, '')
  if (d.length === 10) return `+1${d}`
  if (d.length === 11 && d.startsWith('1')) return `+${d}`
  return ''
}

async function signed(req: Request, raw: string) {
  const secret = env('META_APP_SECRET')
  const sig = req.headers.get('x-hub-signature-256') || ''
  if (!secret || !sig.startsWith('sha256=')) return false
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(raw)))
  const hex = [...mac].map((b) => b.toString(16).padStart(2, '0')).join('')
  return hex === sig.slice(7)
}

// Meta field names vary by form; map the common ones.
function pick(fields: Record<string, string>, ...names: string[]) {
  for (const n of names) if (fields[n]) return fields[n]
  return ''
}

Deno.serve(async (req) => {
  const url = new URL(req.url)
  if (req.method === 'GET') {
    const ok = url.searchParams.get('hub.mode') === 'subscribe' && env('META_VERIFY_TOKEN') && url.searchParams.get('hub.verify_token') === env('META_VERIFY_TOKEN')
    return ok ? new Response(url.searchParams.get('hub.challenge') || '') : json({ error: 'forbidden' }, 403)
  }
  if (req.method !== 'POST') return json({ ok: true })
  const raw = await req.text()
  if (!(await signed(req, raw))) return json({ error: 'bad signature' }, 401)
  const token = env('META_PAGE_TOKEN')
  if (!token) return json({ error: 'META_PAGE_TOKEN missing' }, 503)
  const body = JSON.parse(raw || '{}')
  const sb = db()
  let added = 0

  for (const entry of body.entry || []) {
    for (const ch of entry.changes || []) {
      if (ch.field !== 'leadgen' || !ch.value?.leadgen_id) continue
      const id = String(ch.value.leadgen_id)
      const { data: seen } = await sb.from('crm_forms').select('id').eq('form', 'meta-lead').eq('page', `meta:${id}`).maybeSingle()
      if (seen) continue
      const r = await fetch(`${GRAPH}/${id}?fields=field_data,created_time,ad_name,campaign_name,form_id&access_token=${encodeURIComponent(token)}`)
      const lead = await r.json().catch(() => ({}))
      if (!r.ok) {
        console.error('meta lead fetch failed', lead?.error?.message)
        continue
      }
      const f: Record<string, string> = {}
      for (const x of lead.field_data || []) f[x.name] = (x.values || []).join(', ')
      const email = pick(f, 'email', 'work_email').trim().toLowerCase()
      const phone = e164(pick(f, 'phone_number', 'phone', 'work_phone_number'))
      const full = pick(f, 'full_name', 'name')
      const [first, ...rest] = (pick(f, 'first_name') || full).trim().split(/\s+/)
      const company = pick(f, 'company_name', 'company', 'business_name') || full || email || phone
      f.ad = lead.ad_name || ''
      f.campaign = lead.campaign_name || ''

      let row = null
      if (email) row = (await sb.from('crm_leads').select('*').eq('email', email).maybeSingle()).data
      if (!row && phone) row = (await sb.from('crm_leads').select('*').eq('phone', phone).maybeSingle()).data
      if (!row) {
        const { data, error } = await sb
          .from('crm_leads')
          .insert({
            first_name: first || '',
            last_name: pick(f, 'last_name') || rest.join(' '),
            company,
            phone,
            email,
            city: pick(f, 'city'),
            state: pick(f, 'state', 'province'),
            website: pick(f, 'website'),
            tags: ['meta-lead'],
            source: 'Meta lead ad',
          })
          .select('*')
          .single()
        if (error) {
          console.error('meta lead insert failed', error.message)
          continue
        }
        row = data
      } else if (!row.tags.includes('meta-lead')) {
        await sb.from('crm_leads').update({ tags: [...row.tags, 'meta-lead'], updated_at: new Date().toISOString() }).eq('id', row.id)
      }
      await sb.from('crm_forms').insert({ form: 'meta-lead', lead_id: row.id, fields: f, page: `meta:${id}` })
      await sb.from('crm_activities').insert({ lead_id: row.id, user_name: 'Meta', outcome: 'form', note: `Meta lead ad${f.ad ? `: ${f.ad}` : ''}` })
      added++
    }
  }
  return json({ ok: true, added })
})
