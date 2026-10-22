// Shared helpers for the CRM edge functions (Deno).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

export const db = () => createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })

// Secrets: function env first, then the database vault (crm_cron_secret,
// crm_form_secret), which only the service role can read. Empty means locked.
const cache: Record<string, string> = {}
export async function secret(name: string) {
  const env = Deno.env.get(name)
  if (env) return env
  if (name in cache) return cache[name]
  const { data } = await db().rpc('crm_secret', { n: `crm_${name.toLowerCase()}` })
  return (cache[name] = typeof data === 'string' ? data : '')
}

export async function checkHeader(req: Request, header: string, name: string) {
  const want = await secret(name)
  return !!want && req.headers.get(header) === want
}

export const json = (body: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...extra } })

export const DEFAULTS = {
  daily_email_cap: 50,
  cc: 's.kazmi@rebootmedia.us',
  sender: 'k.reid@rebootmedia.us',
  sender_name: 'Kendall Reid',
  bounce_pause_pct: 3,
}

export async function settings(sb: ReturnType<typeof db>) {
  const { data } = await sb.from('crm_settings').select('value').eq('id', 1).maybeSingle()
  return { ...DEFAULTS, ...((data?.value as Record<string, unknown>) || {}) } as typeof DEFAULTS & Record<string, unknown>
}

export function fill(s: string, l: { first_name: string; company: string; city: string }) {
  return s
    .replaceAll('{first}', l.first_name || 'there')
    .replaceAll('{company}', l.company)
    .replaceAll('{city}', l.city)
}

// Links to rebootmedia.us carry the contact id (?rb=) so site visits count toward buyer intent.
export function tagLinks(body: string, leadId: string) {
  return body.replace(/https?:\/\/(?:[a-z0-9-]+\.)?rebootmedia\.us[^\s)>\]"']*/gi, (m) => {
    const trail = m.match(/[.,!?;:]+$/)?.[0] || ''
    const u = m.slice(0, m.length - trail.length)
    return (/[?&]rb=/.test(u) ? u : `${u}${u.includes('?') ? '&' : '?'}rb=${leadId}`) + trail
  })
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// Minimal version of the Reboot branded shell: purple and white, logo text top-left,
// no dividers. Links written as bare URLs become "Tap here" links.
export function brandedHtml(body: string) {
  const html = esc(body)
    .replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" style="color:#6D28D9;text-decoration:underline">Tap here</a>')
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 16px;line-height:1.6">${p.replace(/\n/g, '<br>')}</p>`)
    .join('')
  return `<!doctype html><html><body style="margin:0;background:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Arial,sans-serif;color:#1c1b19">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" style="max-width:560px" cellpadding="0" cellspacing="0">
<tr><td style="padding-bottom:28px;font-weight:700;font-size:18px;color:#6D28D9">Reboot Media</td></tr>
<tr><td style="font-size:15px">${html}</td></tr>
<tr><td style="padding-top:28px;font-size:12px;color:#75726b">Reboot Media · Austin, Texas · <a href="https://rebootmedia.us" style="color:#75726b">rebootmedia.us</a></td></tr>
</table></td></tr></table></body></html>`
}

export function chicagoNow() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    hour: 'numeric',
    hourCycle: 'h23',
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const get = (t: string) => parts.find((p) => p.type === t)?.value || ''
  return { hour: Number(get('hour')), weekday: get('weekday'), date: `${get('year')}-${get('month')}-${get('day')}` }
}

// Start of today in Chicago, as an ISO timestamp.
export function chicagoMidnightIso() {
  const { date } = chicagoNow()
  for (const off of ['-05:00', '-06:00']) {
    const d = new Date(`${date}T00:00:00${off}`)
    const back = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Chicago',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      hourCycle: 'h23',
    }).format(d)
    if (back.startsWith(date) && back.endsWith('00')) return d.toISOString()
  }
  return new Date(`${date}T05:00:00Z`).toISOString()
}

export async function resendSend(payload: Record<string, unknown>) {
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${Deno.env.get('RESEND_API_KEY')}`, 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const data = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(data?.message || `Resend ${r.status}`)
  return data as { id: string }
}
