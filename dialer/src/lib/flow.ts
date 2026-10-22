// Workflow engine. Pure logic with no imports, shared by the app (demo mode runs
// it in the browser) and the crm-flow edge function (live mode runs it every
// minute). A workflow is a trigger plus a tree of steps; a run is one contact
// moving through that tree, with a cursor on the next step to execute.

export type TriggerType =
  | 'call_outcome'
  | 'contact_created'
  | 'tag_added'
  | 'tag_removed'
  | 'stage_changed'
  | 'meeting_booked'
  | 'meeting_status'
  | 'form_submitted'
  | 'email_opened'
  | 'email_clicked'
  | 'email_replied'
  | 'email_bounced'
  | 'missed_call'
  | 'inbound_call'
  | 'site_visit'
  | 'manual'

export interface FlowEvent {
  type: TriggerType
  value: string
  lead_id: string
  at: string
}

export type CondField =
  | 'pain'
  | 'segment'
  | 'status'
  | 'stage'
  | 'tag'
  | 'owner'
  | 'source'
  | 'has_email'
  | 'has_phone'
  | 'attempts'
  | 'opened_email'
  | 'clicked_email'
  | 'replied'
  | 'meeting_upcoming'

export type CondOp = 'is' | 'is_not' | 'gte' | 'lte'

export interface Condition {
  field: CondField
  op: CondOp
  value: string
}

export type WaitWindow = 'any' | 'business' | 'email'
export type WaitEvent = 'email_replied' | 'email_opened' | 'email_clicked' | 'meeting_booked' | 'call_outcome'

export type Step =
  | { id: string; type: 'wait'; amount: number; unit: 'minutes' | 'hours' | 'days'; window: WaitWindow }
  | { id: string; type: 'wait_for'; event: WaitEvent; days: number; yes: Step[]; no: Step[] }
  | { id: string; type: 'email'; subject: string; body: string; branded: boolean; auto_send: boolean }
  | { id: string; type: 'text'; body: string }
  | { id: string; type: 'task'; kind: 'callback' | 'follow_up' | 'todo'; owner: string; due_minutes: number; reason: string }
  | { id: string; type: 'notify'; to: string; text: string }
  | { id: string; type: 'tag'; mode: 'add' | 'remove'; tag: string }
  | { id: string; type: 'field'; field: 'status' | 'stage' | 'owner' | 'pain' | 'segment'; value: string }
  | { id: string; type: 'sequence'; mode: 'enroll' | 'stop'; sequence_id: string }
  | { id: string; type: 'webhook'; url: string }
  | { id: string; type: 'branch'; match: 'all' | 'any'; conditions: Condition[]; yes: Step[]; no: Step[] }
  | { id: string; type: 'end' }

export type StepType = Step['type']

export interface Workflow {
  id: string
  name: string
  description: string
  status: 'active' | 'draft' | 'paused'
  trigger: { type: TriggerType; value: string; conditions: Condition[] }
  steps: Step[]
  reentry: boolean
  stop_on_reply: boolean
  created_by: string
  created_at: string
  updated_at: string
}

export interface RunLog {
  at: string
  step: string
  text: string
}

export interface FlowRun {
  id: string
  workflow_id: string
  lead_id: string
  status: 'active' | 'waiting' | 'done' | 'stopped' | 'failed'
  cursor: string | null
  wake_at: string | null
  waiting_for: string | null
  log: RunLog[]
  created_at: string
  updated_at: string
}

// The parts of a contact the engine reads and writes.
export interface FlowLead {
  id: string
  first_name: string
  last_name: string
  company: string
  phone: string
  email: string
  city: string
  pain: string
  segment: string
  status: string
  stage: string | null
  owner: string | null
  tags: string[]
  source: string
  attempts: number
}

export interface FlowCtx {
  lead: FlowLead
  now: Date
  opened: boolean
  clicked: boolean
  replied: boolean
  meeting_upcoming: boolean
  booking_link: string
  callers: string[]
}

export type Effect =
  | { kind: 'email'; subject: string; body: string; branded: boolean; status: 'draft' | 'approved' }
  | { kind: 'task'; task_kind: 'callback' | 'follow_up' | 'todo'; owner: string; due_at: string; reason: string }
  | { kind: 'lead'; patch: Partial<FlowLead> }
  | { kind: 'sequence'; mode: 'enroll' | 'stop'; sequence_id: string }
  | { kind: 'webhook'; url: string }

/* ------------------------------------------------------------- labels --- */

export const TRIGGERS: { type: TriggerType; label: string; valueLabel?: string; hint: string }[] = [
  { type: 'call_outcome', label: 'Call outcome logged', valueLabel: 'Outcome', hint: 'After you log a result on a dial.' },
  { type: 'missed_call', label: 'Missed inbound call', valueLabel: 'From number source', hint: 'Someone called a tracking number and nobody picked up.' },
  { type: 'inbound_call', label: 'Roofer called us', valueLabel: 'From number source', hint: 'A known roofer called one of your numbers and someone picked up.' },
  {
    type: 'site_visit',
    label: 'Visited rebootmedia.us',
    valueLabel: 'Page contains',
    hint: 'A roofer you emailed opened the site (links carry their id). Use /pricing or /case for buying signals.',
  },
  { type: 'meeting_booked', label: 'Call booked', hint: 'A meeting lands on the calendar.' },
  { type: 'meeting_status', label: 'Meeting status changed', valueLabel: 'New status', hint: 'Confirmed, showed, no-show or canceled.' },
  { type: 'stage_changed', label: 'Pipeline stage changed', valueLabel: 'New stage', hint: 'A deal moves to a stage.' },
  { type: 'email_replied', label: 'Email replied', hint: 'They answered any email.' },
  { type: 'email_clicked', label: 'Email link clicked', hint: 'They clicked a link in an email.' },
  { type: 'email_opened', label: 'Email opened', hint: 'Soft signal: Apple Mail opens everything.' },
  { type: 'email_bounced', label: 'Email bounced', hint: 'The address did not take the email.' },
  { type: 'form_submitted', label: 'Website form filled', valueLabel: 'Form', hint: 'Visibility Check, grow, scale or commercial form.' },
  { type: 'contact_created', label: 'Contact created', hint: 'A new roofer is added or imported.' },
  { type: 'tag_added', label: 'Tag added', valueLabel: 'Tag', hint: 'A tag lands on a contact.' },
  { type: 'tag_removed', label: 'Tag removed', valueLabel: 'Tag', hint: 'A tag comes off a contact.' },
  { type: 'manual', label: 'Added by hand', hint: 'You enroll contacts yourself from a contact or a list.' },
]

export const triggerLabel = (t: TriggerType) => TRIGGERS.find((x) => x.type === t)?.label || t

export const STEP_TYPES: { type: StepType; label: string; group: 'Send' | 'Do' | 'Wait' | 'Logic'; hint: string }[] = [
  { type: 'email', label: 'Send email', group: 'Send', hint: 'Through Resend. Waits in Approvals unless you let it send itself.' },
  { type: 'text', label: 'Send text', group: 'Send', hint: 'Becomes a text task until the phone carrier is connected.' },
  { type: 'task', label: 'Create task', group: 'Do', hint: 'Callback, follow-up or to-do for whoever owns the contact.' },
  { type: 'notify', label: 'Notify teammate', group: 'Do', hint: 'A due-now to-do that pops for K or Ali.' },
  { type: 'tag', label: 'Add or remove tag', group: 'Do', hint: 'Tags drive lists and other workflows.' },
  { type: 'field', label: 'Update contact', group: 'Do', hint: 'Status, stage, owner, pain or segment.' },
  { type: 'sequence', label: 'Email sequence', group: 'Do', hint: 'Start or stop a cold email lane.' },
  { type: 'webhook', label: 'Send to a URL', group: 'Do', hint: 'Posts the contact to another tool.' },
  { type: 'wait', label: 'Wait', group: 'Wait', hint: 'Minutes, hours or days, optionally inside working hours.' },
  { type: 'wait_for', label: 'Wait for reply or click', group: 'Wait', hint: 'Splits on whether it happens before a deadline.' },
  { type: 'branch', label: 'If / else', group: 'Logic', hint: 'Splits on pain, tag, stage, opens and more.' },
  { type: 'end', label: 'End workflow', group: 'Logic', hint: 'Stops this contact here.' },
]

export const COND_FIELDS: { field: CondField; label: string; kind: 'enum' | 'tag' | 'bool' | 'number' | 'text' }[] = [
  { field: 'pain', label: 'Pain', kind: 'enum' },
  { field: 'segment', label: 'Segment', kind: 'enum' },
  { field: 'status', label: 'Call status', kind: 'enum' },
  { field: 'stage', label: 'Pipeline stage', kind: 'enum' },
  { field: 'tag', label: 'Has tag', kind: 'tag' },
  { field: 'owner', label: 'Owner', kind: 'text' },
  { field: 'source', label: 'Source', kind: 'text' },
  { field: 'attempts', label: 'Dial attempts', kind: 'number' },
  { field: 'has_email', label: 'Has an email', kind: 'bool' },
  { field: 'has_phone', label: 'Has a phone', kind: 'bool' },
  { field: 'opened_email', label: 'Opened an email', kind: 'bool' },
  { field: 'clicked_email', label: 'Clicked an email', kind: 'bool' },
  { field: 'replied', label: 'Replied', kind: 'bool' },
  { field: 'meeting_upcoming', label: 'Has a call booked', kind: 'bool' },
]

const UNIT_MS = { minutes: 6e4, hours: 36e5, days: 864e5 }

export function describeStep(s: Step): string {
  switch (s.type) {
    case 'wait':
      return `Wait ${s.amount} ${s.amount === 1 ? s.unit.slice(0, -1) : s.unit}${s.window === 'business' ? ', then working hours' : s.window === 'email' ? ', then the 8–11 AM send window' : ''}`
    case 'wait_for':
      return `Wait up to ${s.days} day${s.days === 1 ? '' : 's'} for ${WAIT_EVENT_LABEL[s.event]}`
    case 'email':
      return `${s.branded ? 'Branded' : 'Plain'} email: ${s.subject || 'no subject yet'}`
    case 'text':
      return `Text: ${s.body.slice(0, 60) || 'empty'}`
    case 'task':
      return `${s.kind === 'callback' ? 'Callback' : s.kind === 'follow_up' ? 'Follow-up' : 'To-do'} for ${s.owner || 'the owner'}${s.due_minutes ? ` in ${humanMinutes(s.due_minutes)}` : ' now'}`
    case 'notify':
      return `Tell ${s.to || 'the owner'}: ${s.text.slice(0, 50)}`
    case 'tag':
      return `${s.mode === 'add' ? 'Add' : 'Remove'} tag ${s.tag || '…'}`
    case 'field':
      return `Set ${s.field} to ${s.value || '…'}`
    case 'sequence':
      return s.mode === 'enroll' ? 'Start email sequence' : 'Stop email sequence'
    case 'webhook':
      return `Post to ${s.url || 'a URL'}`
    case 'branch':
      return s.conditions.length ? s.conditions.map(describeCondition).join(s.match === 'all' ? ' and ' : ' or ') : 'Add a condition'
    case 'end':
      return 'Stop here'
  }
}

export const WAIT_EVENT_LABEL: Record<WaitEvent, string> = {
  email_replied: 'a reply',
  email_clicked: 'a link click',
  email_opened: 'an open',
  meeting_booked: 'a booked call',
  call_outcome: 'a logged call',
}

export function describeCondition(c: Condition): string {
  const f = COND_FIELDS.find((x) => x.field === c.field)
  if (!f) return c.field
  if (f.kind === 'bool') return `${f.label.toLowerCase()} is ${c.value === 'no' ? 'no' : 'yes'}`
  if (f.kind === 'number') return `${f.label.toLowerCase()} ${c.op === 'lte' ? '≤' : '≥'} ${c.value}`
  if (f.kind === 'tag') return `${c.op === 'is_not' ? 'no tag' : 'tag'} ${c.value}`
  return `${f.label.toLowerCase()} ${c.op === 'is_not' ? 'is not' : 'is'} ${c.value || 'none'}`
}

export function humanMinutes(m: number) {
  if (m % 1440 === 0) return `${m / 1440} day${m === 1440 ? '' : 's'}`
  if (m % 60 === 0) return `${m / 60} hour${m === 60 ? '' : 's'}`
  return `${m} min`
}

/* --------------------------------------------------------------- tree --- */

type Arm = Step[]
interface Place {
  list: Arm
  index: number
  parent: Step | null
}

function childArms(s: Step): Arm[] {
  return s.type === 'branch' || s.type === 'wait_for' ? [s.yes, s.no] : []
}

export function locate(steps: Arm, id: string, parent: Step | null = null): Place | null {
  for (let i = 0; i < steps.length; i++) {
    const s = steps[i]
    if (s.id === id) return { list: steps, index: i, parent }
    for (const arm of childArms(s)) {
      const p = locate(arm, id, s)
      if (p) return p
    }
  }
  return null
}

export function findStep(steps: Arm, id: string): Step | null {
  const p = locate(steps, id)
  return p ? p.list[p.index] : null
}

// The step after `id` once it is done: its next sibling, or whatever follows the
// branch it sits in.
export function nextOf(steps: Arm, id: string): string | null {
  const p = locate(steps, id)
  if (!p) return null
  if (p.index + 1 < p.list.length) return p.list[p.index + 1].id
  return p.parent ? nextOf(steps, p.parent.id) : null
}

function enterArm(steps: Arm, from: Step, arm: Arm): string | null {
  return arm.length ? arm[0].id : nextOf(steps, from.id)
}

export function countSteps(steps: Arm): number {
  return steps.reduce((n, s) => n + 1 + childArms(s).reduce((m, a) => m + countSteps(a), 0), 0)
}

// Tree edits used by the builder. All return new arrays.
export function mapSteps(steps: Arm, fn: (s: Step) => Step): Arm {
  return steps.map((s) => {
    const t = fn(s)
    if (t.type === 'branch' || t.type === 'wait_for') return { ...t, yes: mapSteps(t.yes, fn), no: mapSteps(t.no, fn) }
    return t
  })
}

export function removeStep(steps: Arm, id: string): Arm {
  return steps.filter((s) => s.id !== id).map((s) => (s.type === 'branch' || s.type === 'wait_for' ? { ...s, yes: removeStep(s.yes, id), no: removeStep(s.no, id) } : s))
}

// Where a new or moved step goes: into the top list or one arm of a step, at an index.
export interface Slot {
  parent: string | null
  arm: 'yes' | 'no' | null
  index: number
}

export function insertAt(steps: Arm, slot: Slot, step: Step): Arm {
  if (!slot.parent) {
    const next = steps.slice()
    next.splice(Math.min(slot.index, next.length), 0, step)
    return next
  }
  return steps.map((s) => {
    if ((s.type === 'branch' || s.type === 'wait_for') && s.id === slot.parent && slot.arm) {
      const arm = s[slot.arm].slice()
      arm.splice(Math.min(slot.index, arm.length), 0, step)
      return { ...s, [slot.arm]: arm }
    }
    if (s.type === 'branch' || s.type === 'wait_for') return { ...s, yes: insertAt(s.yes, slot, step), no: insertAt(s.no, slot, step) }
    return s
  })
}

function contains(step: Step, id: string): boolean {
  return childArms(step).some((a) => a.some((s) => s.id === id || contains(s, id)))
}

export function moveStep(steps: Arm, id: string, slot: Slot): Arm {
  const p = locate(steps, id)
  if (!p) return steps
  const step = p.list[p.index]
  if (slot.parent === id || (slot.parent && contains(step, slot.parent))) return steps
  // Removing first shifts indexes in the same list.
  const sameList = (p.parent?.id ?? null) === slot.parent && (slot.parent === null || (p.parent && armOf(p.parent, p.list) === slot.arm))
  const index = sameList && p.index < slot.index ? slot.index - 1 : slot.index
  return insertAt(removeStep(steps, id), { ...slot, index }, step)
}

function armOf(parent: Step, list: Arm): 'yes' | 'no' | null {
  if (parent.type !== 'branch' && parent.type !== 'wait_for') return null
  return parent.yes === list ? 'yes' : parent.no === list ? 'no' : null
}

export function newStep(type: StepType, id: string): Step {
  switch (type) {
    case 'wait':
      return { id, type, amount: 1, unit: 'days', window: 'business' }
    case 'wait_for':
      return { id, type, event: 'email_replied', days: 2, yes: [], no: [] }
    case 'email':
      return { id, type, subject: '', body: 'Hi {first},\n\n', branded: true, auto_send: false }
    case 'text':
      return { id, type, body: 'Hi {first}, ' }
    case 'task':
      return { id, type, kind: 'callback', owner: '', due_minutes: 0, reason: '' }
    case 'notify':
      return { id, type, to: '', text: '{company} needs you' }
    case 'tag':
      return { id, type, mode: 'add', tag: '' }
    case 'field':
      return { id, type, field: 'status', value: '' }
    case 'sequence':
      return { id, type, mode: 'enroll', sequence_id: '' }
    case 'webhook':
      return { id, type, url: '' }
    case 'branch':
      return { id, type, match: 'all', conditions: [{ field: 'pain', op: 'is', value: 'never-ads' }], yes: [], no: [] }
    case 'end':
      return { id, type }
  }
}

/* --------------------------------------------------------- conditions --- */

export function conditionPasses(c: Condition, ctx: FlowCtx): boolean {
  const l = ctx.lead
  const yes = c.value !== 'no'
  switch (c.field) {
    case 'tag': {
      const has = l.tags.map((t) => t.toLowerCase()).includes(c.value.toLowerCase())
      return c.op === 'is_not' ? !has : has
    }
    case 'attempts':
      return c.op === 'lte' ? l.attempts <= Number(c.value) : l.attempts >= Number(c.value)
    case 'has_email':
      return !!l.email === yes
    case 'has_phone':
      return !!l.phone === yes
    case 'opened_email':
      return ctx.opened === yes
    case 'clicked_email':
      return ctx.clicked === yes
    case 'replied':
      return ctx.replied === yes
    case 'meeting_upcoming':
      return ctx.meeting_upcoming === yes
    default: {
      const v = String((l as unknown as Record<string, unknown>)[c.field] ?? '') || 'none'
      const eq = v.toLowerCase() === (c.value || 'none').toLowerCase()
      return c.op === 'is_not' ? !eq : eq
    }
  }
}

export function conditionsPass(list: Condition[], match: 'all' | 'any', ctx: FlowCtx) {
  if (!list.length) return true
  return match === 'any' ? list.some((c) => conditionPasses(c, ctx)) : list.every((c) => conditionPasses(c, ctx))
}

export function triggerMatches(wf: Workflow, ev: FlowEvent, ctx: FlowCtx): boolean {
  if (wf.status !== 'active' || wf.trigger.type !== ev.type || ev.type === 'manual') return false
  const want = wf.trigger.value.toLowerCase()
  if (want && (ev.type === 'site_visit' ? !ev.value.toLowerCase().includes(want) : want !== ev.value.toLowerCase())) return false
  return conditionsPass(wf.trigger.conditions, 'all', ctx)
}

/* ------------------------------------------------------------- timing --- */

// Hour and weekday in Central time.
function central(d: Date) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', hour: 'numeric', hourCycle: 'h23', weekday: 'short' }).formatToParts(d)
  const get = (t: string) => parts.find((p) => p.type === t)?.value || ''
  return { hour: Number(get('hour')), weekday: get('weekday') }
}

export function nextInWindow(d: Date, window: WaitWindow): Date {
  if (window === 'any') return d
  const [start, end] = window === 'email' ? [8, 11] : [8, 18]
  let t = new Date(d)
  for (let i = 0; i < 7 * 96; i++) {
    const c = central(t)
    if (c.weekday !== 'Sat' && c.weekday !== 'Sun' && c.hour >= start && c.hour < end) return t
    t = new Date(Math.ceil((t.getTime() + 1) / 9e5) * 9e5) // next quarter hour
  }
  return t
}

/* -------------------------------------------------------------- runs --- */

export function fill(text: string, ctx: FlowCtx) {
  const l = ctx.lead
  return text
    .replaceAll('{first}', l.first_name || 'there')
    .replaceAll('{last}', l.last_name)
    .replaceAll('{company}', l.company)
    .replaceAll('{city}', l.city)
    .replaceAll('{phone}', l.phone)
    .replaceAll('{owner}', l.owner || '')
    .replaceAll('{booking_link}', ctx.booking_link)
}

export function startRun(wf: Workflow, lead_id: string, now: Date, id: string, why: string): FlowRun {
  const t = now.toISOString()
  return {
    id,
    workflow_id: wf.id,
    lead_id,
    status: 'active',
    cursor: wf.steps[0]?.id ?? null,
    wake_at: null,
    waiting_for: null,
    log: [{ at: t, step: '', text: why }],
    created_at: t,
    updated_at: t,
  }
}

// An event a waiting run cares about: move it into the "yes" arm.
export function resumeOnEvent(run: FlowRun, wf: Workflow, ev: FlowEvent): FlowRun | null {
  if (run.status !== 'waiting' || run.waiting_for !== ev.type || !run.cursor) return null
  const s = findStep(wf.steps, run.cursor)
  if (!s || s.type !== 'wait_for') return null
  return {
    ...run,
    status: 'active',
    waiting_for: null,
    wake_at: null,
    cursor: enterArm(wf.steps, s, s.yes),
    log: [...run.log, { at: ev.at, step: s.id, text: `Got ${WAIT_EVENT_LABEL[s.event]}` }],
  }
}

export function stopRun(run: FlowRun, at: string, why: string): FlowRun {
  return { ...run, status: 'stopped', wake_at: null, waiting_for: null, updated_at: at, log: [...run.log, { at, step: '', text: why }] }
}

export function isDue(run: FlowRun, now: Date) {
  return run.status === 'active' || (run.status === 'waiting' && !!run.wake_at && run.wake_at <= now.toISOString())
}

// Run steps until the contact has to wait or reaches the end. Returns the new
// run and what to do in the world (emails, tasks, contact updates).
export function advance(run: FlowRun, wf: Workflow, ctx: FlowCtx): { run: FlowRun; effects: Effect[] } {
  const effects: Effect[] = []
  const t = ctx.now.toISOString()
  const log = run.log.slice()
  const lead = { ...ctx.lead, tags: ctx.lead.tags.slice() }
  const c = { ...ctx, lead }
  let r: FlowRun = { ...run }

  // Waking up from a wait: step past it (or into the "no" arm on a timeout).
  if (r.status === 'waiting') {
    if (!isDue(r, ctx.now)) return { run, effects }
    const s = r.cursor ? findStep(wf.steps, r.cursor) : null
    if (!s) r.cursor = null
    else if (s.type === 'wait_for') {
      log.push({ at: t, step: s.id, text: `No ${WAIT_EVENT_LABEL[s.event]} in ${s.days} day${s.days === 1 ? '' : 's'}` })
      r.cursor = enterArm(wf.steps, s, s.no)
    } else r.cursor = nextOf(wf.steps, s.id)
    r = { ...r, status: 'active', wake_at: null, waiting_for: null }
  }

  for (let guard = 0; guard < 60 && r.cursor; guard++) {
    const s = findStep(wf.steps, r.cursor)
    if (!s) {
      r.cursor = null
      break
    }
    const next = () => nextOf(wf.steps, s.id)
    const owner = lead.owner || ctx.callers[0] || 'K'

    if (s.type === 'wait') {
      const wake = nextInWindow(new Date(ctx.now.getTime() + s.amount * UNIT_MS[s.unit]), s.window)
      log.push({ at: t, step: s.id, text: `Waiting until ${wake.toISOString()}` })
      r = { ...r, status: 'waiting', wake_at: wake.toISOString(), updated_at: t, log }
      return { run: r, effects }
    }
    if (s.type === 'wait_for') {
      const wake = new Date(ctx.now.getTime() + s.days * 864e5)
      log.push({ at: t, step: s.id, text: `Waiting for ${WAIT_EVENT_LABEL[s.event]}` })
      r = { ...r, status: 'waiting', waiting_for: s.event, wake_at: wake.toISOString(), updated_at: t, log }
      return { run: r, effects }
    }
    if (s.type === 'branch') {
      const ok = conditionsPass(s.conditions, s.match, c)
      log.push({ at: t, step: s.id, text: ok ? 'Yes' : 'No' })
      r.cursor = enterArm(wf.steps, s, ok ? s.yes : s.no)
      continue
    }
    if (s.type === 'end') {
      log.push({ at: t, step: s.id, text: 'Ended' })
      r.cursor = null
      break
    }

    if (s.type === 'email') {
      if (!lead.email) log.push({ at: t, step: s.id, text: 'Skipped email: no address' })
      else {
        effects.push({ kind: 'email', subject: fill(s.subject, c), body: fill(s.body, c), branded: s.branded, status: s.auto_send ? 'approved' : 'draft' })
        log.push({ at: t, step: s.id, text: s.auto_send ? 'Email queued to send' : 'Email waiting in Approvals' })
      }
    } else if (s.type === 'text') {
      effects.push({ kind: 'task', task_kind: 'follow_up', owner, due_at: t, reason: `Text ${lead.phone}: ${fill(s.body, c)}` })
      log.push({ at: t, step: s.id, text: 'Text task created' })
    } else if (s.type === 'task') {
      effects.push({
        kind: 'task',
        task_kind: s.kind,
        owner: s.owner || owner,
        due_at: new Date(ctx.now.getTime() + s.due_minutes * 6e4).toISOString(),
        reason: fill(s.reason, c) || `From ${wf.name}`,
      })
      log.push({ at: t, step: s.id, text: `Task for ${s.owner || owner}` })
    } else if (s.type === 'notify') {
      effects.push({ kind: 'task', task_kind: 'todo', owner: s.to || owner, due_at: t, reason: fill(s.text, c) })
      log.push({ at: t, step: s.id, text: `Told ${s.to || owner}` })
    } else if (s.type === 'tag' && s.tag) {
      const has = lead.tags.some((x) => x.toLowerCase() === s.tag.toLowerCase())
      if (s.mode === 'add' && !has) lead.tags = [...lead.tags, s.tag]
      if (s.mode === 'remove' && has) lead.tags = lead.tags.filter((x) => x.toLowerCase() !== s.tag.toLowerCase())
      if ((s.mode === 'add') !== has) effects.push({ kind: 'lead', patch: { tags: lead.tags } })
      log.push({ at: t, step: s.id, text: `${s.mode === 'add' ? 'Added' : 'Removed'} tag ${s.tag}` })
    } else if (s.type === 'field' && s.value) {
      const value = s.field === 'stage' && s.value === 'none' ? null : s.value
      ;(lead as unknown as Record<string, unknown>)[s.field] = value
      effects.push({ kind: 'lead', patch: { [s.field]: value } as Partial<FlowLead> })
      log.push({ at: t, step: s.id, text: `Set ${s.field} to ${s.value}` })
    } else if (s.type === 'sequence') {
      effects.push({ kind: 'sequence', mode: s.mode, sequence_id: s.sequence_id })
      log.push({ at: t, step: s.id, text: s.mode === 'enroll' ? 'Started sequence' : 'Stopped sequence' })
    } else if (s.type === 'webhook' && s.url) {
      effects.push({ kind: 'webhook', url: s.url })
      log.push({ at: t, step: s.id, text: `Posted to ${s.url}` })
    }
    r.cursor = next()
  }

  if (!r.cursor) {
    log.push({ at: t, step: '', text: 'Finished' })
    r = { ...r, status: 'done', wake_at: null, waiting_for: null }
  }
  return { run: { ...r, log, updated_at: t }, effects }
}

/* ------------------------------------------------------------ events --- */

const DIAL_OUTCOMES = ['no_answer', 'voicemail', 'gatekeeper', 'callback', 'booked', 'confirmed', 'not_interested', 'bad_number', 'dnc']

// The events a row change produces. The database triggers in schema.sql do the
// same thing for live data; demo mode calls this from the store.
export function eventsFromChange(table: string, before: Record<string, any> | null, after: Record<string, any> | null, at: string): FlowEvent[] {
  if (!after) return []
  const ev = (type: TriggerType, value: string, lead_id: string): FlowEvent => ({ type, value, lead_id, at })
  const out: FlowEvent[] = []
  if (table === 'activities' && !before && DIAL_OUTCOMES.includes(after.outcome)) out.push(ev('call_outcome', after.outcome, after.lead_id))
  if (table === 'leads') {
    if (!before) out.push(ev('contact_created', after.source || '', after.id))
    const was: string[] = before?.tags || []
    const now: string[] = after.tags || []
    for (const tag of now) if (!was.includes(tag)) out.push(ev('tag_added', tag, after.id))
    if (before) for (const tag of was) if (!now.includes(tag)) out.push(ev('tag_removed', tag, after.id))
    if (before && before.stage !== after.stage && after.stage) out.push(ev('stage_changed', after.stage, after.id))
  }
  if (table === 'meetings') {
    if (!before) out.push(ev('meeting_booked', after.source || '', after.lead_id))
    else if (before.status !== after.status) out.push(ev('meeting_status', after.status, after.lead_id))
  }
  if (table === 'forms' && !before && after.lead_id) out.push(ev('form_submitted', after.form, after.lead_id))
  if (table === 'email_events' && !before) {
    const map: Record<string, TriggerType> = { open: 'email_opened', click: 'email_clicked', reply: 'email_replied', bounce: 'email_bounced' }
    if (map[after.type]) out.push(ev(map[after.type], after.url || '', after.lead_id))
  }
  if (table === 'calls' && after.lead_id && after.direction === 'in' && after.status === 'missed' && before?.status !== 'missed')
    out.push(ev('missed_call', after.source || '', after.lead_id))
  if (table === 'calls' && after.lead_id && after.direction === 'in' && after.status === 'completed' && before && before.status !== 'completed')
    out.push(ev('inbound_call', after.source || '', after.lead_id))
  if (table === 'site_visits' && !before && after.lead_id) out.push(ev('site_visit', after.page || '', after.lead_id))
  return out
}
