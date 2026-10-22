// crm-flow: runs workflows. pg_cron calls it every minute (supabase/cron.sql).
//  1. Reads new events (database triggers write them: call outcomes, bookings,
//     tags, stages, form fills, email opens/clicks/replies, missed calls),
//     starts matching workflows, resumes runs waiting for that event, and stops
//     runs that end on a reply.
//  2. Moves every run whose wait is over.
// Emails it makes wait in Approvals (or go straight to "approved" when the step
// says so); crm-send sends them in the weekday window under the daily cap.
import { checkHeader, db, json, settings } from '../_shared/common.ts'
import { advance, resumeOnEvent, startRun, stopRun, triggerLabel, triggerMatches, type FlowCtx, type FlowEvent, type FlowLead, type FlowRun, type Workflow } from '../../../src/lib/flow.ts'

type DB = ReturnType<typeof db>

Deno.serve(async (req) => {
  if (!(await checkHeader(req, 'x-cron-secret', 'CRON_SECRET'))) return json({ error: 'unauthorized' }, 401)
  const sb = db()
  const s = await settings(sb)
  const now = new Date()
  const t = now.toISOString()
  const callers = (s.callers as string[] | undefined) || ['K', 'Ali']
  const booking = (s.booking_link as string | undefined) || ''

  const { data: wfRows } = await sb.from('crm_workflows').select('*')
  const wfs = (wfRows || []) as Workflow[]
  const byId = new Map(wfs.map((w) => [w.id, w]))

  const leads = new Map<string, FlowLead & Record<string, unknown>>()
  const getLead = async (id: string) => {
    if (leads.has(id)) return leads.get(id)!
    const { data } = await sb.from('crm_leads').select('*').eq('id', id).maybeSingle()
    if (data) leads.set(id, data)
    return data as (FlowLead & Record<string, unknown>) | null
  }

  const ctxFor = async (lead: FlowLead): Promise<FlowCtx> => {
    const [{ data: em }, { data: mt }] = await Promise.all([
      sb.from('crm_emails').select('opens, clicks, replied_at, direction').eq('lead_id', lead.id),
      sb.from('crm_meetings').select('id').eq('lead_id', lead.id).gt('starts_at', t).not('status', 'in', '(canceled,no_show)').limit(1),
    ])
    const e = em || []
    return {
      lead,
      now,
      opened: e.some((x) => x.opens > 0),
      clicked: e.some((x) => x.clicks > 0),
      replied: e.some((x) => !!x.replied_at || x.direction === 'in'),
      meeting_upcoming: !!mt?.length,
      booking_link: booking,
      callers,
    }
  }

  let stepped = 0
  // Advance one run and carry out what it decided.
  const step = async (run: FlowRun, wf: Workflow, fresh: boolean) => {
    const lead = await getLead(run.lead_id)
    if (!lead) return
    const out = advance(run, wf, await ctxFor(lead))
    const patch: Record<string, unknown> = {}
    for (const e of out.effects) {
      if (e.kind === 'email') {
        await sb.from('crm_emails').insert({
          lead_id: lead.id,
          direction: 'out',
          from_addr: s.sender,
          to_addr: lead.email,
          cc: s.cc,
          subject: e.subject,
          body: e.body,
          branded: e.branded,
          status: e.status,
          created_by: `Workflow: ${wf.name}`,
        })
      } else if (e.kind === 'task') {
        await sb.from('crm_tasks').insert({ lead_id: lead.id, kind: e.task_kind, owner: e.owner, due_at: e.due_at, reason: e.reason, created_by: `Workflow: ${wf.name}` })
      } else if (e.kind === 'lead') {
        Object.assign(patch, e.patch)
      } else if (e.kind === 'sequence') {
        if (e.mode === 'stop') {
          if (lead.sequence_state === 'active') patch.sequence_state = 'paused'
        } else {
          const { data: seqs } = await sb.from('crm_sequences').select('id, lane, status')
          const seq = (seqs || []).find((x) => x.id === e.sequence_id) || (seqs || []).find((x) => x.lane === lead.pain && x.status === 'active')
          if (seq && lead.email && lead.email_status === 'ok') Object.assign(patch, { sequence_id: seq.id, sequence_step: 0, sequence_state: 'active' })
        }
      } else if (e.kind === 'webhook') {
        try {
          await fetch(e.url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ workflow: wf.name, contact: lead }), signal: AbortSignal.timeout(5000) })
        } catch {
          out.run.log.push({ at: t, step: '', text: `Could not reach ${e.url}` })
        }
      }
    }
    if (Object.keys(patch).length) {
      await sb
        .from('crm_leads')
        .update({ ...patch, updated_at: t })
        .eq('id', lead.id)
      leads.set(lead.id, { ...lead, ...patch } as FlowLead & Record<string, unknown>)
    }
    if (fresh) await sb.from('crm_flow_runs').insert(out.run)
    else await sb.from('crm_flow_runs').update(out.run).eq('id', run.id)
    stepped++
  }

  /* 1. events ------------------------------------------------------------ */
  const { data: evRows } = await sb.from('crm_flow_events').select('*').is('processed_at', null).order('id').limit(300)
  for (const row of evRows || []) {
    const ev: FlowEvent = { type: row.type, value: row.value || '', lead_id: row.lead_id, at: row.created_at }
    const lead = await getLead(ev.lead_id)
    if (lead) {
      const { data: mine } = await sb.from('crm_flow_runs').select('*').eq('lead_id', lead.id)
      const runs = (mine || []) as FlowRun[]
      for (const r of runs.filter((x) => x.status === 'active' || x.status === 'waiting')) {
        const wf = byId.get(r.workflow_id)
        if (!wf || wf.status !== 'active') continue
        const resumed = resumeOnEvent(r, wf, ev)
        if (resumed) await step(resumed, wf, false)
        else if (ev.type === 'email_replied' && wf.stop_on_reply) await sb.from('crm_flow_runs').update(stopRun(r, t, 'Stopped: they replied')).eq('id', r.id)
      }
      const ctx = await ctxFor(lead)
      for (const wf of wfs) {
        if (!triggerMatches(wf, ev, ctx)) continue
        const prior = runs.filter((r) => r.workflow_id === wf.id)
        if (!wf.reentry && prior.length) continue
        if (prior.some((r) => r.status === 'active' || r.status === 'waiting')) continue
        const r = startRun(wf, lead.id, now, crypto.randomUUID(), `Triggered: ${triggerLabel(ev.type)}${ev.value ? ` · ${ev.value.replace(/_/g, ' ')}` : ''}`)
        runs.push(r)
        await step(r, wf, true)
      }
    }
    await sb.from('crm_flow_events').update({ processed_at: t }).eq('id', row.id)
  }

  /* 2. runs that are due ------------------------------------------------- */
  const { data: due } = await sb.from('crm_flow_runs').select('*').or(`status.eq.active,and(status.eq.waiting,wake_at.lte.${t})`).order('updated_at').limit(200)
  for (const r of (due || []) as FlowRun[]) {
    const wf = byId.get(r.workflow_id)
    if (!wf) {
      await sb.from('crm_flow_runs').update({ status: 'failed', updated_at: t }).eq('id', r.id)
      continue
    }
    if (wf.status !== 'active') continue
    await step(r, wf, false)
  }

  return json({ events: evRows?.length || 0, stepped })
})
