import { useMemo, useState } from 'react'
import { Avatar, Badge, Button, Card, CardHead, Empty, Icon, Tabs } from '../components/ui'
import { ComposeModal, EmailPulse, LeadEditor, LeadHeader, LeadTimeline } from '../components/LeadPanel'
import { OutcomeBar } from '../components/OutcomeBar'
import { FORM_LABEL, MEETING_LABEL, MEETING_TONE, SEGMENT_LABEL } from '../lib/constants'
import { ago, when } from '../lib/format'
import { useData } from '../lib/store'
import type { Lead } from '../lib/types'

// The road from first dial to signed client, Clearbill-style.
function steps(l: Lead, firstCall: string | null, firstConvo: string | null) {
  const order = ['booked', 'confirmed', 'showed', 'proposal', 'won']
  const reached = (s: string) => (l.stage ? order.indexOf(l.stage === 'no_show' ? 'confirmed' : l.stage === 'lost' ? 'booked' : l.stage) >= order.indexOf(s) : false)
  return [
    { label: 'Added', done: true, sub: ago(l.created_at) },
    { label: 'Dialed', done: l.attempts > 0, sub: firstCall ? ago(firstCall) : '' },
    { label: 'Conversation', done: !!firstConvo || reached('booked'), sub: firstConvo ? ago(firstConvo) : '' },
    { label: 'Booked', done: reached('booked'), sub: l.meeting_at ? when(l.meeting_at) : '' },
    { label: 'Confirmed', done: reached('confirmed'), sub: l.stage === 'no_show' ? 'No-show' : '' },
    { label: 'Showed', done: reached('showed'), sub: '' },
    { label: 'Proposal', done: reached('proposal'), sub: '' },
    { label: 'Signed', done: l.stage === 'won', sub: l.stage === 'lost' ? 'Lost' : '' },
  ]
}

export function Contact({ id, back, callNow }: { id: string; back(): void; callNow(id: string): void }) {
  const { me, data, leadById, updateLead, save } = useData()
  const lead = leadById.get(id)
  const [tab, setTab] = useState<'all' | 'calls' | 'emails' | 'notes'>('all')
  const [compose, setCompose] = useState(false)
  const [tag, setTag] = useState('')

  const acts = useMemo(() => data.activities.filter((a) => a.lead_id === id).sort((a, b) => a.created_at.localeCompare(b.created_at)), [data.activities, id])
  if (!lead)
    return (
      <Card>
        <Empty title="Contact not found" action={<Button onClick={back}>Back to contacts</Button>} />
      </Card>
    )

  const firstCall = acts.find((a) => ['no_answer', 'voicemail', 'gatekeeper', 'callback', 'booked', 'not_interested'].includes(a.outcome))?.created_at || null
  const firstConvo = acts.find((a) => ['callback', 'booked', 'not_interested'].includes(a.outcome))?.created_at || null
  const st = steps(lead, firstCall, firstConvo)
  const meetings = data.meetings.filter((m) => m.lead_id === id).sort((a, b) => b.starts_at.localeCompare(a.starts_at))
  const seq = data.sequences.find((s) => s.id === lead.sequence_id)
  const emails = data.emails.filter((e) => e.lead_id === id && e.direction === 'out' && e.status !== 'draft').sort((a, b) => (b.sent_at || '').localeCompare(a.sent_at || ''))
  const forms = data.forms.filter((f) => f.lead_id === id)

  return (
    <div>
      <button onClick={back} className="mb-3 inline-flex items-center gap-1 text-xs text-ink-500 hover:text-ink-900">
        <Icon name="left" className="h-3.5 w-3.5" /> Contacts
      </button>
      <div className="flex flex-wrap items-start gap-4">
        <Avatar name={lead.company} className="h-12 w-12 text-sm" />
        <div className="min-w-0 flex-1">
          <LeadHeader lead={lead} big />
          <div className="mt-3">
            <EmailPulse lead={lead} />
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setCompose(true)} disabled={!lead.email}>
            <Icon name="mail" /> Email
          </Button>
          <Button variant="primary" onClick={() => callNow(lead.id)} disabled={!lead.phone}>
            <Icon name="phone" /> Open in dialer
          </Button>
        </div>
      </div>

      <Card className="mt-5 overflow-x-auto p-4">
        <ol className="flex min-w-[640px] items-start">
          {st.map((s, i) => (
            <li key={s.label} className="relative flex-1">
              <div className="flex items-center">
                <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[10px] ${s.done ? 'bg-ink-900 text-white' : 'bg-white text-ink-300 ring-1 ring-inset ring-line'}`}>
                  {s.done ? <Icon name="check" className="h-3.5 w-3.5" /> : i + 1}
                </span>
                {i < st.length - 1 && <span className={`mx-1 h-px flex-1 ${st[i + 1].done ? 'bg-ink-900' : 'border-t border-dashed border-ink-300'}`} />}
              </div>
              <div className="mt-2 pr-2 text-xs font-medium text-ink-900">{s.label}</div>
              <div className="truncate pr-2 text-[11px] text-ink-400">{s.sub}</div>
            </li>
          ))}
        </ol>
      </Card>

      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-3">
        <div className="space-y-5 xl:col-span-2">
          <Card className="p-4">
            <div className="mb-3 text-xs font-medium uppercase tracking-wider text-ink-400">Log a call</div>
            <OutcomeBar lead={lead} onLogged={() => {}} />
          </Card>
          <Card className="p-4">
            <div className="mb-3 text-xs font-medium uppercase tracking-wider text-ink-400">Details</div>
            <LeadEditor lead={lead} />
          </Card>
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
              <span className="text-sm font-semibold text-ink-900">Activity</span>
              <Tabs
                value={tab}
                onChange={setTab}
                items={[
                  { key: 'all', label: 'All' },
                  { key: 'calls', label: 'Calls' },
                  { key: 'emails', label: 'Emails' },
                  { key: 'notes', label: 'Notes' },
                ]}
              />
            </div>
            <div className="p-4">
              <LeadTimeline lead={lead} filter={tab} />
            </div>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHead title="Email tracking" sub={emails.length ? `${emails.length} sent` : 'Nothing sent yet'} />
            <ul className="px-2 pb-2">
              {emails.slice(0, 6).map((e) => (
                <li key={e.id} className="rounded-lg px-2 py-2 hover:bg-wash">
                  <div className="truncate text-sm text-ink-900">{e.subject}</div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-ink-500">
                    <span>{ago(e.sent_at)}</span>
                    {e.status === 'bounced' ? (
                      <span className="text-clay-600">bounced</span>
                    ) : (
                      <>
                        <span className={e.opens ? 'text-accent-600' : ''}>{e.opens ? `opened ${e.opens}×` : 'not opened'}</span>
                        {e.clicks > 0 && <span className="text-sand-700">clicked</span>}
                        {e.replied_at && <span className="text-sage-700">replied</span>}
                      </>
                    )}
                  </div>
                </li>
              ))}
              {emails.length === 0 && <li className="px-2 pb-2 text-sm text-ink-500">Opens, clicks and replies show here once emails go out.</li>}
            </ul>
          </Card>

          <Card>
            <CardHead
              title="Sequence"
              sub={seq ? seq.name : 'Not enrolled'}
              actions={
                seq &&
                lead.sequence_state && (
                  <Button size="sm" onClick={() => updateLead(lead.id, { sequence_state: lead.sequence_state === 'paused' ? 'active' : 'paused' })}>
                    <Icon name={lead.sequence_state === 'paused' ? 'play' : 'pause'} /> {lead.sequence_state === 'paused' ? 'Resume' : 'Pause'}
                  </Button>
                )
              }
            />
            {seq && (
              <div className="px-4 pb-4">
                <div className="flex gap-1">
                  {seq.steps.map((_, i) => (
                    <span key={i} className={`h-1.5 flex-1 rounded-full ${i < lead.sequence_step ? 'bg-accent-500' : 'bg-wash ring-1 ring-inset ring-line'}`} />
                  ))}
                </div>
                <div className="mt-2 text-xs text-ink-500">
                  Step {Math.min(lead.sequence_step, seq.steps.length)} of {seq.steps.length} · {lead.sequence_state}
                </div>
              </div>
            )}
          </Card>

          <Card>
            <CardHead title="Meetings" sub={meetings.length ? `${meetings.length} total` : 'None yet'} />
            <ul className="px-4 pb-3">
              {meetings.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-2 border-t border-line py-2 text-sm first:border-t-0">
                  <span className="text-ink-700">{when(m.starts_at)}</span>
                  <Badge tone={MEETING_TONE[m.status]}>{MEETING_LABEL[m.status]}</Badge>
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <CardHead title="Tags" sub={`${SEGMENT_LABEL[lead.segment]} · from ${lead.source}`} />
            <div className="flex flex-wrap gap-1.5 px-4 pb-3">
              {lead.tags.map((t) => (
                <span key={t} className="inline-flex items-center gap-1 rounded-md bg-wash px-2 py-0.5 text-xs text-ink-700 ring-1 ring-inset ring-line">
                  {t}
                  <button aria-label={`Remove ${t}`} onClick={() => updateLead(lead.id, { tags: lead.tags.filter((x) => x !== t) })} className="text-ink-400 hover:text-ink-900">
                    <Icon name="x" className="h-3 w-3" />
                  </button>
                </span>
              ))}
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  const t = tag.trim().toLowerCase()
                  if (t && !lead.tags.includes(t)) updateLead(lead.id, { tags: [...lead.tags, t] })
                  setTag('')
                }}
              >
                <input value={tag} onChange={(e) => setTag(e.target.value)} placeholder="+ tag" className="h-6 w-20 rounded-md border border-dashed border-line px-1.5 text-xs outline-none focus:border-ink-400" />
              </form>
            </div>
          </Card>

          {forms.length > 0 && (
            <Card>
              <CardHead title="Website forms" />
              <ul className="px-4 pb-3 text-sm">
                {forms.map((f) => (
                  <li key={f.id} className="flex justify-between border-t border-line py-2 first:border-t-0">
                    <span className="text-ink-700">{FORM_LABEL[f.form]}</span>
                    <span className="text-xs text-ink-400">{ago(f.created_at)}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card>
            <CardHead title="Quick task" />
            <div className="flex flex-wrap gap-1.5 px-4 pb-4">
              {[
                ['Follow up tomorrow', 1],
                ['Check back in a week', 7],
                ['After storm season', 60],
              ].map(([label, days]) => (
                <Button
                  key={label as string}
                  size="sm"
                  onClick={() => {
                    const d = new Date()
                    d.setDate(d.getDate() + (days as number))
                    d.setHours(9, 0, 0, 0)
                    save('tasks', { id: crypto.randomUUID(), lead_id: lead.id, kind: 'follow_up', owner: lead.owner || data.settings.callers[0], due_at: d.toISOString(), reason: label as string, done_at: null, created_by: me.name, created_at: new Date().toISOString() })
                  }}
                >
                  {label}
                </Button>
              ))}
            </div>
          </Card>
        </div>
      </div>
      <ComposeModal lead={lead} open={compose} onClose={() => setCompose(false)} />
    </div>
  )
}
