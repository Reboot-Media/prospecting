import { useMemo, useState } from 'react'
import { Badge, Button, Card, CardHead, Field, Icon, Meter, PageHeader, Select, StatStrip, Td, Th, inputCls, pct } from '../components/ui'
import { PAIN_LABEL } from '../lib/constants'
import { startOfToday, uid } from '../lib/format'
import { emailStats } from '../lib/metrics'
import { useData } from '../lib/store'
import type { Sequence, SequenceStep } from '../lib/types'

const LANE_LABEL: Record<Sequence['lane'], string> = { ...PAIN_LABEL, shark: 'Shark', commercial: 'Commercial' }

export function Sequences() {
  const { data, save } = useData()
  const [open, setOpen] = useState('')
  const today = startOfToday().toISOString()
  const sentToday = data.emails.filter((e) => e.direction === 'out' && e.sent_at && e.sent_at >= today).length
  const cap = data.settings.daily_email_cap
  const all = emailStats(data.emails.filter((e) => e.sequence_id))
  const bounceRate = all.sent ? (all.bounced / all.sent) * 100 : 0
  const seq = data.sequences.find((s) => s.id === open)

  if (seq) return <SequenceDetail seq={seq} back={() => setOpen('')} />

  return (
    <div>
      <PageHeader
        title="Sequences"
        sub="Cold email lanes. One per pain. Replies stop the sequence for that roofer."
        actions={
          <Button
            variant="primary"
            onClick={() => {
              const s: Sequence = { id: uid(), name: 'New sequence', lane: 'never-ads', status: 'paused', steps: [{ day: 0, subject: '', body: '', branded: false }], created_at: new Date().toISOString() }
              save('sequences', s).then(() => setOpen(s.id))
            }}
          >
            <Icon name="plus" /> New sequence
          </Button>
        }
      />
      <div className="mb-5">
        <StatStrip
          items={[
            { label: 'Sent today', icon: 'send', value: `${sentToday} / ${cap}`, sub: 'Daily cap, first emails and follow-ups share it' },
            { label: 'Open rate', icon: 'eye', value: pct(all.opened, all.delivered), sub: 'Apple Mail inflates this' },
            { label: 'Reply rate', icon: 'reply', value: pct(all.replied, all.delivered), sub: `${all.replied} replies` },
            { label: 'Bounce rate', icon: 'alert', value: pct(all.bounced, all.sent), sub: `Auto-pause above ${data.settings.bounce_pause_pct}%`, delta: { text: bounceRate > data.settings.bounce_pause_pct ? 'over' : 'healthy', good: bounceRate <= data.settings.bounce_pause_pct } },
          ]}
        />
      </div>
      <div className="mb-5">
        <div className="mb-1 flex justify-between text-xs text-ink-500">
          <span>Today's sending window, weekdays 8–11 AM</span>
          <span className="tabular">
            {sentToday} of {cap}
          </span>
        </div>
        <Meter value={sentToday} max={cap} tone="sage" />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {data.sequences.map((s) => {
          const st = emailStats(data.emails.filter((e) => e.sequence_id === s.id))
          const enrolled = data.leads.filter((l) => l.sequence_id === s.id)
          return (
            <Card key={s.id} className="p-4">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <button onClick={() => setOpen(s.id)} className="text-left text-sm font-semibold text-ink-900 hover:underline">
                    {s.name}
                  </button>
                  <div className="text-xs text-ink-500">
                    {LANE_LABEL[s.lane]} · {s.steps.length} steps over {s.steps[s.steps.length - 1]?.day || 0} days
                  </div>
                </div>
                <Badge tone={s.status === 'active' ? 'sage' : 'stone'}>{s.status === 'active' ? 'Running' : 'Paused'}</Badge>
              </div>
              <div className="mt-4 grid grid-cols-5 gap-2 text-center">
                {[
                  ['Enrolled', enrolled.length],
                  ['Sent', st.sent],
                  ['Opened', pct(st.opened, st.delivered)],
                  ['Clicked', pct(st.clicked, st.delivered)],
                  ['Replied', pct(st.replied, st.delivered)],
                ].map(([k, v]) => (
                  <div key={k as string} className="rounded-lg bg-wash py-2 ring-1 ring-inset ring-line">
                    <div className="tabular text-sm font-semibold text-ink-900">{v}</div>
                    <div className="text-[10px] text-ink-500">{k}</div>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-xs text-ink-500">
                  {enrolled.filter((l) => l.sequence_state === 'active').length} active · {enrolled.filter((l) => l.sequence_state === 'replied').length} replied · {st.bounced} bounced
                </span>
                <div className="flex gap-1.5">
                  <Button size="sm" onClick={() => save('sequences', { ...s, status: s.status === 'active' ? 'paused' : 'active' })}>
                    <Icon name={s.status === 'active' ? 'pause' : 'play'} /> {s.status === 'active' ? 'Pause' : 'Run'}
                  </Button>
                  <Button size="sm" onClick={() => setOpen(s.id)}>
                    Edit
                  </Button>
                </div>
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

function SequenceDetail({ seq, back }: { seq: Sequence; back(): void }) {
  const { data, save, remove } = useData()
  const [draft, setDraft] = useState<Sequence>(seq)
  const [saved, setSaved] = useState(false)
  const [armDelete, setArmDelete] = useState(false)
  const stepStats = useMemo(() => draft.steps.map((_, i) => emailStats(data.emails.filter((e) => e.sequence_id === seq.id && e.step === i))), [data.emails, seq.id, draft.steps])
  const setStep = (i: number, p: Partial<SequenceStep>) => setDraft((d) => ({ ...d, steps: d.steps.map((s, k) => (k === i ? { ...s, ...p } : s)) }))

  return (
    <div className="max-w-4xl">
      <button onClick={back} className="mb-3 inline-flex items-center gap-1 text-xs text-ink-500 hover:text-ink-900">
        <Icon name="left" className="h-3.5 w-3.5" /> Sequences
      </button>
      <PageHeader
        title={draft.name || 'Untitled'}
        sub="Use {first}, {company} and {city}. Email 1 stays plain text, follow-ups use the branded look."
        actions={
          <>
            {saved && <span className="text-xs text-sage-700">Saved</span>}
            <Button
              variant="primary"
              onClick={() =>
                save('sequences', draft).then(() => {
                  setSaved(true)
                  setTimeout(() => setSaved(false), 1500)
                })
              }
            >
              Save
            </Button>
          </>
        }
      />
      <Card className="mb-4 grid grid-cols-1 gap-3 p-4 sm:grid-cols-3">
        <Field label="Name">
          <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className={inputCls} />
        </Field>
        <Field label="Lane">
          <Select value={draft.lane} onChange={(v) => setDraft({ ...draft, lane: v as Sequence['lane'] })} options={Object.entries(LANE_LABEL) as [string, string][]} className="h-9 w-full" />
        </Field>
        <Field label="Status">
          <Select value={draft.status} onChange={(v) => setDraft({ ...draft, status: v as Sequence['status'] })} options={[['active', 'Running'], ['paused', 'Paused']]} className="h-9 w-full" />
        </Field>
      </Card>
      <div className="space-y-3">
        {draft.steps.map((s, i) => (
          <Card key={i}>
            <CardHead
              title={`Email ${i + 1}`}
              sub={`Day ${s.day} · sent ${stepStats[i]?.sent || 0} · opened ${pct(stepStats[i]?.opened || 0, stepStats[i]?.delivered || 0)} · replied ${pct(stepStats[i]?.replied || 0, stepStats[i]?.delivered || 0)}`}
              actions={
                draft.steps.length > 1 && (
                  <Button size="sm" variant="ghost" aria-label={`Remove email ${i + 1}`} onClick={() => setDraft((d) => ({ ...d, steps: d.steps.filter((_, k) => k !== i) }))}>
                    <Icon name="trash" />
                  </Button>
                )
              }
            />
            <div className="grid grid-cols-1 gap-3 px-4 pb-4 sm:grid-cols-[90px_1fr_auto]">
              <Field label="Day">
                <input type="number" min={0} value={s.day} onChange={(e) => setStep(i, { day: Number(e.target.value) || 0 })} className={inputCls} />
              </Field>
              <Field label="Subject">
                <input value={s.subject} onChange={(e) => setStep(i, { subject: e.target.value })} className={inputCls} />
              </Field>
              <label className="flex items-end gap-2 pb-2 text-xs text-ink-700">
                <input type="checkbox" checked={s.branded} onChange={(e) => setStep(i, { branded: e.target.checked })} /> Branded
              </label>
              <div className="sm:col-span-3">
                <textarea aria-label={`Email ${i + 1} body`} value={s.body} onChange={(e) => setStep(i, { body: e.target.value })} rows={6} className={inputCls} />
              </div>
            </div>
          </Card>
        ))}
      </div>
      <div className="mt-3 flex justify-between">
        <Button onClick={() => setDraft((d) => ({ ...d, steps: [...d.steps, { day: (d.steps[d.steps.length - 1]?.day || 0) + 4, subject: '', body: '', branded: true }] }))}>
          <Icon name="plus" /> Add email
        </Button>
        <Button
          variant="danger"
          onClick={() => {
            if (!armDelete) return setArmDelete(true)
            remove('sequences', seq.id).then(back)
          }}
        >
          {armDelete ? 'Click again to delete' : 'Delete sequence'}
        </Button>
      </div>
      <Card className="mt-5 overflow-x-auto">
        <CardHead title="Step results" />
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line">
              <Th>Step</Th>
              <Th className="text-right">Sent</Th>
              <Th className="text-right">Opened</Th>
              <Th className="text-right">Clicked</Th>
              <Th className="text-right">Replied</Th>
              <Th className="text-right">Bounced</Th>
            </tr>
          </thead>
          <tbody>
            {stepStats.map((st, i) => (
              <tr key={i} className="border-t border-line first:border-t-0">
                <Td className="font-medium text-ink-900">Email {i + 1}</Td>
                <Td className="tabular text-right">{st.sent}</Td>
                <Td className="tabular text-right">{pct(st.opened, st.delivered)}</Td>
                <Td className="tabular text-right">{pct(st.clicked, st.delivered)}</Td>
                <Td className="tabular text-right">{pct(st.replied, st.delivered)}</Td>
                <Td className="tabular text-right">{st.bounced}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
