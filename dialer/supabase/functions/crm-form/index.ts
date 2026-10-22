// crm-form: rebootmedia.us form fills. The site's /api/lead handler posts the same
// JSON it sends to GHL today, with header x-form-secret: <FORM_SECRET>.
// New roofers become contacts; known ones get the fill on their timeline.
import { db, json } from '../_shared/common.ts'

const FORMS = ['visibility-check', 'grow', 'scale', 'commercial']

function e164(p: string) {
  const d = (p || '').replace(/\D/g, '')
  if (d.length === 10) return `+1${d}`
  if (d.length === 11 && d.startsWith('1')) return `+${d}`
  return ''
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ ok: true })
  if (req.headers.get('x-form-secret') !== Deno.env.get('FORM_SECRET')) return json({ error: 'unauthorized' }, 401)
  const f = (await req.json().catch(() => ({}))) as Record<string, string>
  const page = String(f.page || '')
  const form = FORMS.find((x) => page.includes(x) || f.stage === x.replace('-', '_') || f.form === x) || 'grow'
  const email = String(f.email || '').trim().toLowerCase()
  const phone = e164(String(f.phone || ''))
  if (!email && !phone) return json({ error: 'need email or phone' }, 400)
  const [first, ...rest] = String(f.name || f.first_name || '').trim().split(/\s+/)
  const sb = db()

  let lead = null
  if (email) lead = (await sb.from('crm_leads').select('*').eq('email', email).maybeSingle()).data
  if (!lead && phone) lead = (await sb.from('crm_leads').select('*').eq('phone', phone).maybeSingle()).data
  const tag = form === 'visibility-check' ? 'visibilitycheck' : `form-${form}`
  if (!lead) {
    const { data, error } = await sb
      .from('crm_leads')
      .insert({
        first_name: first || '',
        last_name: f.last_name || rest.join(' '),
        company: f.company || f.business || [first, ...rest].join(' ') || email,
        phone,
        email,
        city: f.city || '',
        state: f.state || '',
        website: f.website || f.websiteUrl || '',
        segment: form === 'scale' ? 'shark' : form === 'commercial' ? 'commercial' : 'growing',
        tags: [tag],
        source: 'Website form',
      })
      .select('*')
      .single()
    if (error) return json({ error: error.message }, 500)
    lead = data
  } else if (!lead.tags.includes(tag)) {
    await sb.from('crm_leads').update({ tags: [...lead.tags, tag], updated_at: new Date().toISOString() }).eq('id', lead.id)
  }
  await sb.from('crm_forms').insert({ form, lead_id: lead.id, fields: f, page })
  await sb.from('crm_activities').insert({ lead_id: lead.id, user_name: 'Website', outcome: 'form', note: `Filled ${page || form}` })
  return json({ ok: true, lead_id: lead.id })
})
