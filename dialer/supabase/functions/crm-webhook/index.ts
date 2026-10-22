// crm-webhook: Resend posts tracking events here (opened, clicked, bounced,
// complained) plus replies that land on the reply address (email.received).
// Every request is checked against RESEND_WEBHOOK_SECRET (Svix signature).
import { db, json, resendSend, settings } from '../_shared/common.ts'

async function verify(req: Request, raw: string) {
  const secret = Deno.env.get('RESEND_WEBHOOK_SECRET') || ''
  const id = req.headers.get('svix-id')
  const ts = req.headers.get('svix-timestamp')
  const sigs = req.headers.get('svix-signature') || ''
  if (!secret || !id || !ts) return false
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false
  const key = Uint8Array.from(atob(secret.replace(/^whsec_/, '')), (c) => c.charCodeAt(0))
  const k = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const mac = await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(`${id}.${ts}.${raw}`))
  const expected = btoa(String.fromCharCode(...new Uint8Array(mac)))
  return sigs.split(' ').some((s) => s.split(',')[1] === expected)
}

const addr = (s: string) => (s.match(/<([^>]+)>/)?.[1] || s).trim().toLowerCase()

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ ok: true })
  const raw = await req.text()
  if (!(await verify(req, raw))) return json({ error: 'bad signature' }, 401)
  const evt = JSON.parse(raw) as { type: string; created_at?: string; data: Record<string, any> }
  const sb = db()
  const at = evt.created_at || new Date().toISOString()
  const d = evt.data || {}

  if (evt.type === 'email.received') {
    // A roofer replied. Match by sender, store it, stop his sequence, forward a copy to K.
    const from = addr(String(d.from || ''))
    let text = String(d.text || '')
    if (!text && d.email_id) {
      const r = await fetch(`https://api.resend.com/emails/receiving/${d.email_id}`, { headers: { authorization: `Bearer ${Deno.env.get('RESEND_API_KEY')}` } })
      if (r.ok) {
        const full = await r.json()
        text = String(full.text || (full.html || '').replace(/<[^>]+>/g, ' ') || '')
      }
    }
    const { data: lead } = await sb.from('crm_leads').select('*').eq('email', from).maybeSingle()
    if (lead) {
      const { data: last } = await sb
        .from('crm_emails')
        .select('*')
        .eq('lead_id', lead.id)
        .eq('direction', 'out')
        .eq('status', 'sent')
        .order('sent_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      await sb.from('crm_emails').insert({
        lead_id: lead.id,
        direction: 'in',
        from_addr: from,
        to_addr: String((d.to || [])[0] || ''),
        subject: String(d.subject || ''),
        body: text.slice(0, 20000),
        status: 'received',
        sent_at: at,
        provider_id: d.email_id || null,
        created_by: 'Inbound',
      })
      if (last) {
        await sb.from('crm_emails').update({ replied_at: at }).eq('id', last.id)
        await sb.from('crm_email_events').insert({ email_id: last.id, lead_id: lead.id, type: 'reply', created_at: at })
      }
      await sb
        .from('crm_leads')
        .update({ sequence_state: lead.sequence_state === 'active' ? 'replied' : lead.sequence_state, updated_at: at })
        .eq('id', lead.id)
      await sb.from('crm_activities').insert({ lead_id: lead.id, user_name: 'Inbound', outcome: 'email', note: `Replied: ${text.slice(0, 140)}` })
    }
    // Forward so replies still reach K's normal inbox.
    const s = await settings(sb)
    const to = Deno.env.get('FORWARD_TO') || s.sender
    await resendSend({
      from: `Reboot CRM <${Deno.env.get('FORWARD_FROM') || s.sender}>`,
      to: [to],
      cc: s.cc ? [s.cc] : undefined,
      reply_to: from,
      subject: `${lead ? lead.company : from}: ${d.subject || '(no subject)'}`,
      text: `${from} replied:\n\n${text}`,
    }).catch(() => {})
    return json({ ok: true })
  }

  // Tracking events reference the email Resend sent.
  const { data: e } = await sb
    .from('crm_emails')
    .select('*')
    .eq('provider_id', d.email_id || '')
    .maybeSingle()
  if (!e) return json({ ok: true, note: 'unknown email' })

  if (evt.type === 'email.opened') {
    await sb
      .from('crm_emails')
      .update({ opens: e.opens + 1, first_open_at: e.first_open_at || at, last_open_at: at })
      .eq('id', e.id)
    await sb.from('crm_email_events').insert({ email_id: e.id, lead_id: e.lead_id, type: 'open', created_at: at })
  } else if (evt.type === 'email.clicked') {
    await sb
      .from('crm_emails')
      .update({ clicks: e.clicks + 1 })
      .eq('id', e.id)
    await sb.from('crm_email_events').insert({ email_id: e.id, lead_id: e.lead_id, type: 'click', url: String(d.click?.link || ''), created_at: at })
  } else if (evt.type === 'email.bounced') {
    await sb.from('crm_emails').update({ status: 'bounced' }).eq('id', e.id)
    await sb.from('crm_email_events').insert({ email_id: e.id, lead_id: e.lead_id, type: 'bounce', created_at: at })
    await sb.from('crm_leads').update({ email_status: 'bounced', sequence_state: 'bounced', updated_at: at }).eq('id', e.lead_id)
  } else if (evt.type === 'email.complained') {
    await sb.from('crm_email_events').insert({ email_id: e.id, lead_id: e.lead_id, type: 'unsubscribe', created_at: at })
    await sb.from('crm_leads').update({ email_status: 'unsubscribed', sequence_state: 'paused', updated_at: at }).eq('id', e.lead_id)
  }
  return json({ ok: true })
})
