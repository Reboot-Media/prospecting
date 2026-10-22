// crm-send: runs every few minutes (pg_cron). Two jobs:
//  1. Draft the next sequence email for every roofer who is due. Drafts wait in
//     Approvals; nothing here sends a draft.
//  2. Send emails K approved, inside the weekday 8-11 AM Central window, under
//     the daily cap, through Resend. Opens and clicks come back via crm-webhook.
// Call with header x-cron-secret: <CRON_SECRET>. ?dry=1 reports without writing.
import { brandedHtml, chicagoMidnightIso, chicagoNow, db, fill, json, resendSend, settings } from '../_shared/common.ts'

Deno.serve(async (req) => {
  if (req.headers.get('x-cron-secret') !== Deno.env.get('CRON_SECRET')) return json({ error: 'unauthorized' }, 401)
  const dry = new URL(req.url).searchParams.get('dry') === '1'
  const force = new URL(req.url).searchParams.get('force') === '1' // ignore the time window (manual test)
  const sb = db()
  const s = await settings(sb)
  const report: Record<string, unknown> = {}

  /* 1. draft due sequence steps --------------------------------------- */
  const { data: seqs } = await sb.from('crm_sequences').select('*').eq('status', 'active')
  let drafted = 0
  for (const seq of seqs || []) {
    const steps = (seq.steps || []) as { day: number; subject: string; body: string; branded: boolean }[]
    const { data: leads } = await sb.from('crm_leads').select('*').eq('sequence_id', seq.id).eq('sequence_state', 'active').eq('email_status', 'ok').neq('status', 'dnc').limit(1000)
    for (const l of leads || []) {
      const step = l.sequence_step as number
      if (step >= steps.length) {
        if (!dry) await sb.from('crm_leads').update({ sequence_state: 'finished' }).eq('id', l.id)
        continue
      }
      // Already drafted or queued for this step?
      const { count } = await sb.from('crm_emails').select('id', { count: 'exact', head: true }).eq('lead_id', l.id).eq('sequence_id', seq.id).eq('step', step)
      if (count) continue
      if (step > 0) {
        const { data: prev } = await sb.from('crm_emails').select('sent_at').eq('lead_id', l.id).eq('sequence_id', seq.id).eq('step', step - 1).eq('status', 'sent').maybeSingle()
        if (!prev?.sent_at) continue
        const due = new Date(prev.sent_at).getTime() + (steps[step].day - steps[step - 1].day) * 864e5
        if (Date.now() < due) continue
      }
      drafted++
      if (dry) continue
      await sb.from('crm_emails').insert({
        lead_id: l.id,
        direction: 'out',
        from_addr: s.sender,
        to_addr: l.email,
        cc: s.cc,
        subject: fill(steps[step].subject, l),
        body: fill(steps[step].body, l),
        branded: steps[step].branded,
        status: 'draft',
        sequence_id: seq.id,
        step,
        created_by: 'Sequence',
      })
    }
  }
  report.drafted = drafted

  /* 2. send approved ---------------------------------------------------- */
  const now = chicagoNow()
  const inWindow = !['Sat', 'Sun'].includes(now.weekday) && now.hour >= 8 && now.hour < 11
  if (!inWindow && !force) return json({ ...report, sent: 0, note: 'outside weekday 8-11 AM Central' })
  if (!Deno.env.get('RESEND_API_KEY')) return json({ ...report, sent: 0, note: 'RESEND_API_KEY not set' })

  const { count: sentToday } = await sb.from('crm_emails').select('id', { count: 'exact', head: true }).eq('direction', 'out').gte('sent_at', chicagoMidnightIso())
  let room = Math.max(0, Number(s.daily_email_cap) - (sentToday || 0))

  // Bounce guard: over the limit in the last 3 days pauses new FIRST emails only.
  const since = new Date(Date.now() - 3 * 864e5).toISOString()
  const { count: recent } = await sb.from('crm_emails').select('id', { count: 'exact', head: true }).eq('direction', 'out').gte('sent_at', since)
  const { count: bounced } = await sb.from('crm_emails').select('id', { count: 'exact', head: true }).eq('status', 'bounced').gte('sent_at', since)
  const pauseFirst = (recent || 0) >= 20 && ((bounced || 0) / (recent || 1)) * 100 > Number(s.bounce_pause_pct)
  report.bounce_pause = pauseFirst

  const { data: queue } = await sb.from('crm_emails').select('*').eq('status', 'approved').order('created_at').limit(200)
  let sent = 0
  const failed: string[] = []
  for (const e of queue || []) {
    if (room <= 0) break
    if (pauseFirst && e.sequence_id && e.step === 0) continue
    const { data: lead } = await sb.from('crm_leads').select('*').eq('id', e.lead_id).single()
    if (!lead || lead.email_status !== 'ok' || lead.status === 'dnc' || !e.to_addr) {
      if (!dry) await sb.from('crm_emails').update({ status: 'failed', error: 'contact cannot be emailed' }).eq('id', e.id)
      continue
    }
    if (dry) {
      sent++
      room--
      continue
    }
    try {
      const r = await resendSend({
        from: `${s.sender_name} <${e.from_addr || s.sender}>`,
        to: [e.to_addr],
        cc: e.cc ? e.cc.split(',').map((x: string) => x.trim()).filter(Boolean) : undefined,
        reply_to: Deno.env.get('REPLY_TO') || e.from_addr || s.sender,
        subject: e.subject,
        text: e.body,
        html: e.branded ? brandedHtml(e.body) : undefined,
        tags: [{ name: 'crm_email', value: e.id.replace(/-/g, '') }],
      })
      const t = new Date().toISOString()
      await sb.from('crm_emails').update({ status: 'sent', sent_at: t, provider_id: r.id, error: null }).eq('id', e.id)
      await sb.from('crm_email_events').insert({ email_id: e.id, lead_id: e.lead_id, type: 'sent', created_at: t })
      await sb.from('crm_activities').insert({ lead_id: e.lead_id, user_name: e.created_by || 'CRM', outcome: 'email', note: `Sent "${e.subject}"` })
      if (e.sequence_id && e.step !== null) await sb.from('crm_leads').update({ sequence_step: e.step + 1, updated_at: t }).eq('id', e.lead_id)
      sent++
      room--
    } catch (err) {
      failed.push(`${e.id}: ${(err as Error).message}`)
      await sb.from('crm_emails').update({ status: 'failed', error: (err as Error).message }).eq('id', e.id)
    }
  }
  return json({ ...report, sent, failed, room_left: room })
})
