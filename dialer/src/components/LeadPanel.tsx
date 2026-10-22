import { useState } from 'react'
import { Button, Icon, PainBadge, Select, StatusBadge, inputCls } from './ui'
import { OUTCOME_LABEL, PAIN_LABEL, STATUS_LABEL } from '../lib/constants'
import { ago, fullName, prettyPhone, when } from '../lib/format'
import type { Lead, Pain, Status } from '../lib/types'
import { useData } from '../lib/store'
import { fillTemplate, smsHref } from './OutcomeModals'

export function LeadHeader({ lead, big }: { lead: Lead; big?: boolean }) {
  const { me, data } = useData()
  const text = lead.meeting_at ? fillTemplate(data.settings.booking_text, lead, me.name, lead.meeting_at, lead.why_now) : ''
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={lead.status} />
        <PainBadge pain={lead.pain} />
        {lead.owner && <span className="text-xs text-ink-500">· Owner {lead.owner}</span>}
      </div>
      <h2 className={`mt-2 font-semibold tracking-tight text-ink-900 ${big ? 'text-2xl' : 'text-lg'}`}>{lead.company}</h2>
      <div className="mt-0.5 text-sm text-ink-500">
        {[fullName(lead), [lead.city, lead.state].filter(Boolean).join(', ')].filter(Boolean).join(' · ') || 'No contact name'}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <a href={`tel:${lead.phone}`} className="inline-flex h-10 items-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700">
          <Icon name="phone" /> {prettyPhone(lead.phone)}
        </a>
        {lead.status === 'booked' && text && (
          <a href={smsHref(lead.phone, text)} className="inline-flex h-10 items-center gap-2 rounded-lg bg-white px-3.5 text-sm font-medium text-ink-900 ring-1 ring-inset ring-line hover:bg-zinc-50">
            <Icon name="message" /> Resend confirmation
          </a>
        )}
        {lead.website && (
          <a href={/^https?:/.test(lead.website) ? lead.website : `https://${lead.website}`} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center rounded-lg px-3 text-sm text-ink-700 ring-1 ring-inset ring-line hover:bg-zinc-50">
            Website
          </a>
        )}
      </div>
      {lead.meeting_at && (lead.status === 'booked' || lead.status === 'confirmed') && (
        <div className="mt-3 rounded-lg bg-violet-50 px-3 py-2 text-sm text-violet-900">
          Meeting {when(lead.meeting_at)}
          {lead.why_now && <span className="text-violet-700"> · "{lead.why_now}"</span>}
        </div>
      )}
    </div>
  )
}

export function LeadHistory({ lead }: { lead: Lead }) {
  const { data, addNote } = useData()
  const [note, setNote] = useState('')
  const acts = data.activities.filter((a) => a.lead_id === lead.id).sort((a, b) => b.created_at.localeCompare(a.created_at))
  const open = data.callbacks.filter((c) => c.lead_id === lead.id && !c.done_at)
  return (
    <div>
      {open.map((c) => (
        <div key={c.id} className="mb-3 flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <Icon name="bell" />
          <span>
            Callback {when(c.due_at)} · {c.owner} · {c.reason}
          </span>
        </div>
      ))}
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
      <ol className="space-y-0">
        {acts.length === 0 && <li className="py-3 text-sm text-ink-400">No calls logged yet.</li>}
        {acts.map((a) => (
          <li key={a.id} className="flex gap-3 border-t border-line py-2.5 first:border-t-0">
            <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-ink-300" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-2 text-sm">
                <span className="font-medium text-ink-900">{OUTCOME_LABEL[a.outcome]}</span>
                <span className="text-xs text-ink-400">
                  {a.user_name} · {ago(a.created_at)}
                </span>
              </div>
              {a.note && <div className="mt-0.5 text-sm text-ink-500">{a.note}</div>}
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}

export function LeadEditor({ lead }: { lead: Lead }) {
  const { data, me, updateLead, confirmBooking } = useData()
  const callers = Array.from(new Set([...data.settings.callers, me.name]))
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <label className="text-xs font-medium text-ink-700">
        Status
        <Select
          value={lead.status}
          onChange={(v) => updateLead(lead.id, { status: v as Status })}
          options={Object.entries(STATUS_LABEL) as [string, string][]}
          className="mt-1 w-full"
        />
      </label>
      <label className="text-xs font-medium text-ink-700">
        Pain
        <Select value={lead.pain} onChange={(v) => updateLead(lead.id, { pain: v as Pain })} options={Object.entries(PAIN_LABEL) as [string, string][]} className="mt-1 w-full" />
      </label>
      <label className="text-xs font-medium text-ink-700">
        Owner
        <Select value={lead.owner || ''} onChange={(v) => updateLead(lead.id, { owner: v || null })} options={[['', 'Unassigned'], ...callers.map((c) => [c, c] as [string, string])]} className="mt-1 w-full" />
      </label>
      {lead.status === 'booked' && (
        <div className="sm:col-span-3">
          <Button variant="primary" onClick={() => confirmBooking(lead)}>
            <Icon name="check" /> He replied YES: mark confirmed
          </Button>
        </div>
      )}
    </div>
  )
}
