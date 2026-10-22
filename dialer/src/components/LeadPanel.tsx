import { useEffect, useMemo, useState } from 'react'
import { Badge, Button, Field, Icon, Modal, PainBadge, Select, StatusBadge, inputCls } from './ui'
import { EVENT_LABEL, OUTCOME_LABEL, PAIN_LABEL, SEGMENT_LABEL, STAGE_LABEL, STAGE_TONE, STATUS_LABEL } from '../lib/constants'
import { ago, fullName, prettyPhone, when } from '../lib/format'
import type { Email, Lead, Pain, Segment, Stage, Status } from '../lib/types'
import { useData } from '../lib/store'
import { fillTemplate, smsHref } from './OutcomeModals'
import { fmtDur, useCall } from './CallBar'

export function LeadHeader({ lead, big }: { lead: Lead; big?: boolean }) {
  const { me, data } = useData()
  const { call, live } = useCall()
  const text = lead.meeting_at ? fillTemplate(data.settings.booking_text, lead, me.name, lead.meeting_at, lead.why_now) : ''
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={lead.status} />
        {lead.stage && <Badge tone={STAGE_TONE[lead.stage]}>{STAGE_LABEL[lead.stage]}</Badge>}
        <PainBadge pain={lead.pain} />
        {lead.owner && <span className="text-xs text-ink-500">· Owner {lead.owner}</span>}
      </div>
      <h2 className={`mt-2 font-semibold tracking-tight text-ink-900 ${big ? 'text-2xl' : 'text-lg'}`}>{lead.company}</h2>
      <div className="mt-0.5 text-sm text-ink-500">{[fullName(lead), [lead.city, lead.state].filter(Boolean).join(', ')].filter(Boolean).join(' · ') || 'No contact name'}</div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          onClick={() => call(lead)}
          disabled={!!live && live.state !== 'ended'}
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-sage-600 px-4 text-sm font-semibold text-white hover:bg-sage-700 disabled:opacity-60"
        >
          <Icon name="phone" /> {live && live.lead.id === lead.id && live.state !== 'ended' ? 'On call…' : prettyPhone(lead.phone)}
        </button>
        {lead.status === 'booked' && text && (
          <a
            href={smsHref(lead.phone, text)}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-white px-3.5 text-sm font-medium text-ink-900 ring-1 ring-inset ring-line hover:bg-wash"
          >
            <Icon name="message" /> Resend confirmation
          </a>
        )}
        {lead.website && (
          <a
            href={/^https?:/.test(lead.website) ? lead.website : `https://${lead.website}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-10 items-center gap-1.5 rounded-lg px-3 text-sm text-ink-700 ring-1 ring-inset ring-line hover:bg-wash"
          >
            <Icon name="globe" /> Website
          </a>
        )}
      </div>
      {lead.meeting_at && (lead.status === 'booked' || lead.status === 'confirmed') && (
        <div className="mt-3 rounded-lg bg-accent-50 px-3 py-2 text-sm text-accent-700 ring-1 ring-inset ring-accent-400/20">
          Meeting {when(lead.meeting_at)}
          {lead.why_now && <span className="text-accent-600"> · "{lead.why_now}"</span>}
        </div>
      )}
    </div>
  )
}

// Email engagement in one line: what tracking has seen for this roofer.
export function EmailPulse({ lead }: { lead: Lead }) {
  const { data } = useData()
  const out = data.emails.filter((e) => e.lead_id === lead.id && e.direction === 'out' && (e.status === 'sent' || e.status === 'bounced'))
  if (!out.length) return null
  const opens = out.reduce((a, e) => a + e.opens, 0)
  const clicks = out.reduce((a, e) => a + e.clicks, 0)
  const replied = out.some((e) => e.replied_at)
  const last =
    out
      .map((e) => e.last_open_at)
      .filter(Boolean)
      .sort()
      .pop() || null
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-500">
      <span className="inline-flex items-center gap-1">
        <Icon name="send" className="h-3.5 w-3.5" /> {out.length} sent
      </span>
      <span className="inline-flex items-center gap-1">
        <Icon name="eye" className="h-3.5 w-3.5" /> {opens} opens
        {last ? ` · last ${ago(last)}` : ''}
      </span>
      <span className="inline-flex items-center gap-1">
        <Icon name="cursor" className="h-3.5 w-3.5" /> {clicks} click
        {clicks === 1 ? '' : 's'}
      </span>
      {replied && <Badge tone="sage">Replied</Badge>}
      {lead.email_status !== 'ok' && <Badge tone="clay">{lead.email_status === 'bounced' ? 'Bounced' : 'Unsubscribed'}</Badge>}
    </div>
  )
}

type Item =
  | { kind: 'act'; at: string; title: string; who: string; note: string }
  | { kind: 'email'; at: string; email: Email }
  | { kind: 'event'; at: string; title: string; note: string }

export function LeadTimeline({ lead, filter = 'all' }: { lead: Lead; filter?: 'all' | 'calls' | 'emails' | 'notes' }) {
  const { data, addNote } = useData()
  const [note, setNote] = useState('')
  const [more, setMore] = useState(false)
  const items = useMemo(() => {
    const out: Item[] = []
    // Call length per dial, matched by outcome and time.
    const myCalls = data.calls.filter((c) => c.lead_id === lead.id)
    const callFor = (outcome: string, at: string) =>
      myCalls.find((c) => c.direction === 'out' && c.outcome === outcome && Math.abs(new Date(c.created_at).getTime() - new Date(at).getTime()) < 15 * 60e3)
    if (filter !== 'emails')
      for (const a of data.activities)
        if (a.lead_id === lead.id && (filter === 'all' || (filter === 'notes' ? a.outcome === 'note' : a.outcome !== 'note' && a.outcome !== 'email'))) {
          const c = callFor(a.outcome, a.created_at)
          const extra = c && c.duration_sec ? ` · ${fmtDur(c.duration_sec)}${c.recording_url ? ' · recorded' : ''}` : ''
          out.push({
            kind: 'act',
            at: a.created_at,
            title: OUTCOME_LABEL[a.outcome] + extra,
            who: a.user_name,
            note: a.note,
          })
        }
    if (filter === 'all' || filter === 'calls')
      for (const c of myCalls)
        if (c.direction === 'in')
          out.push({
            kind: 'act',
            at: c.started_at,
            title: c.status === 'missed' ? `Missed call · ${c.source}` : `Inbound call · ${c.source} · ${fmtDur(c.duration_sec)}`,
            who: c.user_name || 'Phone',
            note: '',
          })
    if (filter === 'all' || filter === 'emails') {
      for (const e of data.emails) if (e.lead_id === lead.id && e.status !== 'draft') out.push({ kind: 'email', at: e.sent_at || e.created_at, email: e })
      for (const ev of data.email_events)
        if (ev.lead_id === lead.id && (ev.type === 'click' || ev.type === 'bounce' || ev.type === 'unsubscribe'))
          out.push({
            kind: 'event',
            at: ev.created_at,
            title: EVENT_LABEL[ev.type],
            note: ev.url,
          })
    }
    return out.sort((a, b) => b.at.localeCompare(a.at))
  }, [data.activities, data.emails, data.email_events, data.calls, lead.id, filter])
  const open = data.tasks.filter((c) => c.lead_id === lead.id && !c.done_at)

  return (
    <div>
      {open.map((c) => (
        <div key={c.id} className="mb-3 flex items-center gap-2 rounded-lg bg-sand-50 px-3 py-2 text-sm text-sand-700 ring-1 ring-inset ring-sand-400/30">
          <Icon name="bell" />
          <span>
            {c.kind === 'callback' ? 'Callback' : 'Task'} {when(c.due_at)} · {c.owner} · {c.reason}
          </span>
        </div>
      ))}
      {filter !== 'emails' && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (note.trim()) addNote(lead, note.trim()).then(() => setNote(''))
          }}
          className="mb-3 flex gap-2"
        >
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note…" className={inputCls} />
          <Button type="submit" disabled={!note.trim()}>
            Add
          </Button>
        </form>
      )}
      <ol>
        {items.length === 0 && <li className="py-3 text-sm text-ink-400">Nothing here yet.</li>}
        {items.slice(0, more ? 300 : 20).map((it, i) => (
          <li key={i} className="relative flex gap-3 pb-3.5 pl-0.5">
            <span className="absolute left-[7px] top-5 h-[calc(100%-12px)] w-px bg-line" />
            <span
              className={`relative mt-1 grid h-3.5 w-3.5 shrink-0 place-items-center rounded-full ring-4 ring-white ${it.kind === 'email' ? 'bg-accent-200' : it.kind === 'event' ? 'bg-sand-400' : 'bg-ink-300'}`}
            />
            <div className="min-w-0 flex-1">
              {it.kind === 'email' ? (
                <EmailRow e={it.email} />
              ) : (
                <>
                  <div className="flex flex-wrap items-baseline gap-x-2 text-sm">
                    <span className="font-medium text-ink-900">{it.title}</span>
                    <span className="text-xs text-ink-400">
                      {it.kind === 'act' ? `${it.who} · ` : ''}
                      {ago(it.at)}
                    </span>
                  </div>
                  {it.note && <div className="mt-0.5 truncate text-sm text-ink-500">{it.note}</div>}
                </>
              )}
            </div>
          </li>
        ))}
      </ol>
      {items.length > 20 && !more && (
        <button onClick={() => setMore(true)} className="mt-1 text-xs font-medium text-ink-500 hover:text-ink-900">
          Show {items.length - 20} older
        </button>
      )}
    </div>
  )
}

function EmailRow({ e }: { e: Email }) {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <button onClick={() => setOpen(!open)} className="flex w-full flex-wrap items-baseline gap-x-2 text-left text-sm">
        <span className="font-medium text-ink-900">
          {e.direction === 'in' ? 'Reply received' : e.status === 'bounced' ? 'Email bounced' : e.status === 'approved' ? 'Email queued' : 'Email sent'}
        </span>
        <span className="text-xs text-ink-400">{ago(e.sent_at || e.created_at)}</span>
      </button>
      <div className="mt-0.5 truncate text-sm text-ink-700">{e.subject}</div>
      {e.direction === 'out' && e.status === 'sent' && (
        <div className="mt-1 flex flex-wrap gap-1.5">
          <Badge tone={e.opens ? 'violet' : 'stone'} dot={false}>
            <Icon name="eye" className="h-3 w-3" /> {e.opens ? `Opened ${e.opens}×` : 'Not opened'}
          </Badge>
          {e.clicks > 0 && (
            <Badge tone="sand" dot={false}>
              <Icon name="cursor" className="h-3 w-3" /> Clicked
            </Badge>
          )}
          {e.replied_at && (
            <Badge tone="sage" dot={false}>
              <Icon name="reply" className="h-3 w-3" /> Replied
            </Badge>
          )}
        </div>
      )}
      {open && <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-wash p-3 font-sans text-sm leading-relaxed text-ink-700 ring-1 ring-inset ring-line">{e.body}</pre>}
    </div>
  )
}

export function LeadEditor({ lead }: { lead: Lead }) {
  const { data, me, updateLead, setStage, confirmBooking } = useData()
  const callers = Array.from(new Set([...data.settings.callers, me.name]))
  const sel = (label: string, el: JSX.Element) => (
    <div className="text-xs font-medium text-ink-700">
      <div className="mb-1">{label}</div>
      {el}
    </div>
  )
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {sel(
        'Call status',
        <Select
          label="Call status"
          value={lead.status}
          onChange={(v) => updateLead(lead.id, { status: v as Status })}
          options={Object.entries(STATUS_LABEL) as [string, string][]}
          className="w-full"
        />,
      )}
      {sel(
        'Deal stage',
        <Select
          label="Deal stage"
          value={lead.stage || ''}
          onChange={(v) => setStage(lead, (v || null) as Stage | null)}
          options={[['', 'Not in pipeline'], ...(Object.entries(STAGE_LABEL) as [string, string][])]}
          className="w-full"
        />,
      )}
      {sel(
        'Owner',
        <Select
          label="Owner"
          value={lead.owner || ''}
          onChange={(v) => updateLead(lead.id, { owner: v || null })}
          options={[['', 'Unassigned'], ...callers.map((c) => [c, c] as [string, string])]}
          className="w-full"
        />,
      )}
      {sel(
        'Pain',
        <Select
          label="Pain"
          value={lead.pain}
          onChange={(v) => updateLead(lead.id, { pain: v as Pain })}
          options={Object.entries(PAIN_LABEL) as [string, string][]}
          className="w-full"
        />,
      )}
      {sel(
        'Segment',
        <Select
          label="Segment"
          value={lead.segment}
          onChange={(v) => updateLead(lead.id, { segment: v as Segment })}
          options={Object.entries(SEGMENT_LABEL) as [string, string][]}
          className="w-full"
        />,
      )}
      {sel(
        'Deal value',
        <input
          aria-label="Deal value"
          type="number"
          defaultValue={lead.deal_value || ''}
          key={lead.id}
          onBlur={(e) => updateLead(lead.id, { deal_value: Number(e.target.value) || 0 })}
          className="h-8 w-full rounded-lg border border-line px-2 text-xs"
          placeholder="$"
        />,
      )}
      {lead.status === 'booked' && (
        <div className="col-span-2 sm:col-span-3">
          <Button variant="primary" onClick={() => confirmBooking(lead)}>
            <Icon name="check" /> He replied YES: mark confirmed
          </Button>
        </div>
      )}
    </div>
  )
}

export function ComposeModal({ lead, open, onClose }: { lead: Lead; open: boolean; onClose(): void }) {
  const { data, me, draftEmail } = useData()
  const [tplId, setTplId] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [branded, setBranded] = useState(true)
  const tpls = data.templates.filter((t) => t.kind !== 'text')
  useEffect(() => {
    if (open) {
      setTplId('')
      setSubject('')
      setBody(`Hi ${lead.first_name || 'there'},\n\n\n\n${me.name === 'K' ? 'Kendall' : me.name}`)
    }
  }, [open, lead.id, lead.first_name, me.name])
  const fill = (s: string) =>
    s
      .replaceAll('{first}', lead.first_name || 'there')
      .replaceAll('{company}', lead.company)
      .replaceAll('{city}', lead.city)
  const canSend = !!lead.email && lead.email_status === 'ok'

  async function submit() {
    await draftEmail(lead, subject.trim(), body, branded)
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={`Email ${lead.first_name || lead.company}`} wide>
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-xs text-ink-500">
          <span>
            From <b className="font-medium text-ink-700">{data.settings.sender}</b>
          </span>
          <span>· To {lead.email || <i>no email on file</i>}</span>
          {data.settings.cc && <span>· CC {data.settings.cc}</span>}
        </div>
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <Select
            label="Template"
            value={tplId}
            onChange={(v) => {
              setTplId(v)
              const t = tpls.find((x) => x.id === v)
              if (t) {
                setSubject(fill(t.subject))
                setBody(fill(t.body))
                setBranded(t.kind === 'branded')
              }
            }}
            options={[['', 'Start from a template…'], ...tpls.map((t) => [t.id, t.name] as [string, string])]}
            className="h-9 w-full"
          />
          <label className="flex items-center gap-2 text-xs text-ink-700">
            <input type="checkbox" checked={branded} onChange={(e) => setBranded(e.target.checked)} /> Branded look
          </label>
        </div>
        <Field label="Subject">
          <input value={subject} onChange={(e) => setSubject(e.target.value)} className={inputCls} placeholder="Title Case Subject" />
        </Field>
        <Field label="Message" hint="Opens and clicks are tracked. Every email waits in Approvals until K approves it.">
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={9} className={inputCls} />
        </Field>
        <div className="flex justify-end gap-2">
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!canSend || !subject.trim()} onClick={submit}>
            <Icon name="approve" /> Send to Approvals
          </Button>
        </div>
      </div>
    </Modal>
  )
}
