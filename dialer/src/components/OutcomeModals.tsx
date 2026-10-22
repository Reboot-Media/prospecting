import { useEffect, useState } from 'react'
import { Button, Field, Icon, Modal, Select, inputCls } from './ui'
import { CALLBACK_REASONS } from '../lib/constants'
import { fullName, nextWeekdayAt, toLocalInput, whenSpoken } from '../lib/format'
import type { Lead } from '../lib/types'
import { useData } from '../lib/store'

function quickTimes(): [string, Date][] {
  const inHour = new Date(Date.now() + 60 * 60e3)
  inHour.setMinutes(Math.ceil(inHour.getMinutes() / 15) * 15, 0, 0)
  const pm = new Date()
  pm.setHours(15, 0, 0, 0)
  const out: [string, Date][] = [['In 1 hour', inHour]]
  if (pm.getTime() > Date.now() + 30 * 60e3) out.push(['Today 3 PM', pm])
  out.push(['Tomorrow 8 AM', nextWeekdayAt(8)], ['Tomorrow 9 AM', nextWeekdayAt(9)], ['Next week', nextWeekdayAt(9, 7)])
  return out
}

export function CallbackModal({ lead, open, onClose, onDone }: { lead: Lead; open: boolean; onClose(): void; onDone(): void }) {
  const { me, data, logOutcome } = useData()
  const [due, setDue] = useState('')
  const [reason, setReason] = useState('')
  const [owner, setOwner] = useState(me.name)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setDue('')
      setReason('')
      setOwner(lead.owner || me.name)
    }
  }, [open, lead.id, lead.owner, me.name])

  const dueDate = due ? new Date(due) : null
  const valid = !!dueDate && !isNaN(dueDate.getTime()) && reason.trim().length > 1
  const callers = Array.from(new Set([...data.settings.callers, me.name]))

  async function save() {
    if (!valid || !dueDate) return
    setSaving(true)
    await logOutcome(lead, 'callback', {
      callback: { due_at: dueDate.toISOString(), reason: reason.trim(), owner },
    })
    setSaving(false)
    onDone()
  }

  return (
    <Modal open={open} onClose={onClose} title={`Call back ${lead.first_name || lead.company}`}>
      <div className="space-y-4">
        <Field label="When">
          <div className="mb-2 flex flex-wrap gap-1.5">
            {quickTimes().map(([label, d]) => {
              const v = toLocalInput(d)
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => setDue(v)}
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${due === v ? 'bg-ink-900 text-white ring-ink-900' : 'bg-white text-ink-700 ring-line hover:bg-wash'}`}
                >
                  {label}
                </button>
              )
            })}
          </div>
          <input type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Reason (what he said)">
          <div className="mb-2 flex flex-wrap gap-1.5">
            {CALLBACK_REASONS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setReason(r)}
                className={`rounded-full px-2.5 py-1 text-xs ring-1 ring-inset ${reason === r ? 'bg-ink-900 text-white ring-ink-900' : 'bg-white text-ink-700 ring-line hover:bg-wash'}`}
              >
                {r}
              </button>
            ))}
          </div>
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. on a roof until 3" className={inputCls} />
        </Field>
        <Field label="Who calls back">
          <Select value={owner} onChange={setOwner} options={callers.map((c) => [c, c])} className="w-full" />
        </Field>
        <div className="flex justify-end gap-2 pt-1">
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!valid || saving} onClick={save}>
            <Icon name="bell" /> Set callback
          </Button>
        </div>
      </div>
    </Modal>
  )
}

export function fillTemplate(tpl: string, lead: Lead, me: string, meetingIso: string, why: string): string {
  return tpl
    .split('{first}')
    .join(lead.first_name || 'there')
    .split('{me}')
    .join(me === 'K' ? 'Kendall' : me)
    .split('{when}')
    .join(meetingIso ? whenSpoken(meetingIso) : '[time]')
    .split('{why}')
    .join(why.trim() || 'where jobs are leaking')
    .split('{company}')
    .join(lead.company)
}

export function smsHref(phone: string, body: string): string {
  // "?&body=" is read by both iOS/macOS Messages and Android.
  return `sms:${phone}?&body=${encodeURIComponent(body)}`
}

export function BookedModal({ lead, open, onClose, onDone }: { lead: Lead; open: boolean; onClose(): void; onDone(): void }) {
  const { me, data, logOutcome } = useData()
  const [meeting, setMeeting] = useState('')
  const [why, setWhy] = useState('')
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (open) {
      setMeeting(toLocalInput(nextWeekdayAt(9)))
      setWhy('')
      setCopied(false)
    }
  }, [open, lead.id])

  const meetingIso = meeting ? new Date(meeting).toISOString() : ''
  const text = fillTemplate(data.settings.booking_text, lead, me.name, meetingIso, why)
  const valid = !!meetingIso && why.trim().length > 2

  async function save(sendText: boolean) {
    if (!valid) return
    setSaving(true)
    await logOutcome(lead, 'booked', {
      meeting_at: meetingIso,
      why_now: why.trim(),
      note: `Meeting ${whenSpoken(meetingIso)}. Why now: ${why.trim()}`,
    })
    setSaving(false)
    if (sendText) window.location.href = smsHref(lead.phone, text)
    onDone()
  }

  return (
    <Modal open={open} onClose={onClose} title={`Booked: ${fullName(lead) || lead.company}`}>
      <div className="space-y-4">
        <Field label="Meeting time">
          <input type="datetime-local" value={meeting} onChange={(e) => setMeeting(e.target.value)} className={inputCls} />
        </Field>
        <Field label='His words from "Why now?"' hint="Goes into the text word for word.">
          <input value={why} onChange={(e) => setWhy(e.target.value)} placeholder="e.g. phones go quiet every winter" className={inputCls} autoFocus />
        </Field>
        <div>
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs font-medium text-ink-700">Confirmation text</span>
            <button
              className="text-xs text-ink-500 hover:text-ink-900"
              onClick={() =>
                navigator.clipboard
                  ?.writeText(text)
                  .then(() => setCopied(true))
                  .catch(() => {})
              }
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <div className="rounded-lg bg-wash p-3 text-sm leading-relaxed text-ink-700 ring-1 ring-inset ring-line">{text}</div>
          <p className="mt-1.5 text-xs text-ink-400">Stays "Booked" until he texts back YES. Then mark it Confirmed.</p>
        </div>
        <div className="flex flex-wrap justify-end gap-2 pt-1">
          <Button onClick={() => save(false)} disabled={!valid || saving}>
            Save only
          </Button>
          <Button variant="primary" onClick={() => save(true)} disabled={!valid || saving}>
            <Icon name="message" /> Save and text him
          </Button>
        </div>
      </div>
    </Modal>
  )
}
