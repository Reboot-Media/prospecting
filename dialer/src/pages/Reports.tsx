import { useMemo, useState } from 'react'
import { fmtDur } from '../components/CallBar'
import { Avatar, Card, CardHead, DotBars, PageHeader, Select, Tabs, Td, Th, pct } from '../components/ui'
import { OUTCOME_LABEL, OUTCOMES, PAIN_LABEL } from '../lib/constants'
import { CONVO_OUTCOMES, emailStats, isDial, money, perDay } from '../lib/metrics'
import { useData } from '../lib/store'
import type { Pain } from '../lib/types'

function Bar({ label, value, max, sub, tone = 'bg-accent-400' }: { label: string; value: number; max: number; sub?: string; tone?: string }) {
  const w = max ? Math.max(2, (value / max) * 100) : 0
  return (
    <div className="grid grid-cols-[120px_1fr_64px] items-center gap-3 text-sm sm:grid-cols-[150px_1fr_90px]">
      <span className="truncate text-ink-700">{label}</span>
      <div className="h-5 overflow-hidden rounded-md bg-wash ring-1 ring-inset ring-line">
        <div
          className={`h-full rounded-md ${tone}`}
          style={{
            width: `${w}%`,
            backgroundImage: 'repeating-linear-gradient(135deg, rgba(255,255,255,.28) 0 2px, transparent 2px 6px)',
          }}
        />
      </div>
      <span className="tabular text-right text-ink-900">
        {value}
        {sub && <span className="ml-1.5 text-xs text-ink-400">{sub}</span>}
      </span>
    </div>
  )
}

export function Reports() {
  const { data } = useData()
  const [days, setDays] = useState<'7' | '30' | '90'>('30')
  const [who, setWho] = useState('all')
  const since = new Date(Date.now() - Number(days) * 864e5).toISOString()

  const r = useMemo(() => {
    const acts = data.activities.filter((a) => a.created_at >= since && (who === 'all' || a.user_name === who))
    const dials = acts.filter(isDial).length
    const convos = acts.filter((a) => CONVO_OUTCOMES.has(a.outcome)).length
    const meets = data.meetings.filter((m) => m.created_at >= since && (who === 'all' || m.owner === who))
    const booked = meets.length
    const confirmed = meets.filter((m) => m.status !== 'scheduled' && m.status !== 'canceled').length
    const showed = meets.filter((m) => m.status === 'showed').length
    const signed = data.leads.filter((l) => l.stage === 'won' && l.updated_at >= since && (who === 'all' || l.owner === who)).length
    const outcomes = OUTCOMES.map((o) => ({
      key: o.key,
      n: acts.filter((a) => a.outcome === o.key).length,
    }))
    return { dials, convos, booked, confirmed, showed, signed, outcomes }
  }, [data, since, who])

  const lanes: (Pain | 'campaign')[] = ['never-ads', 'ads-stopped', 'ads-running', 'campaign']
  const laneRows = lanes.map((lane) => {
    const mails = data.emails.filter((e) => (e.sent_at || '') >= since && (lane === 'campaign' ? e.campaign_id : data.sequences.find((s) => s.id === e.sequence_id)?.lane === lane))
    const st = emailStats(mails)
    const ids = new Set(mails.map((e) => e.lead_id))
    const booked = data.meetings.filter((m) => ids.has(m.lead_id) && m.created_at >= since).length
    return { lane, st, booked }
  })
  const chart = perDay(
    data.activities.filter((a) => who === 'all' || a.user_name === who),
    Number(days) > 30 ? 30 : Number(days),
    isDial,
  )
  // Calls: connect rate by hour of day, and inbound by source.
  const calls = data.calls.filter((c) => c.started_at >= since && c.status !== 'live')
  const hours = (() => {
    const m = new Map<number, { dials: number; convos: number }>()
    for (const c of calls) {
      if (c.direction !== 'out' || (who !== 'all' && c.user_name !== who)) continue
      const h = new Date(c.started_at).getHours()
      const x = m.get(h) || { dials: 0, convos: 0 }
      x.dials++
      if (c.status === 'completed' && c.duration_sec >= 30) x.convos++
      m.set(h, x)
    }
    const list = [...m.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([h, x]) => ({
        h,
        ...x,
        label: new Date(2000, 0, 1, h).toLocaleTimeString([], {
          hour: 'numeric',
        }),
        best: false,
      }))
    const rate = (x: { dials: number; convos: number }) => (x.dials >= 10 ? x.convos / x.dials : 0)
    const top = [...list].sort((a, b) => rate(b) - rate(a)).slice(0, 2)
    top.forEach((t) => rate(t) > 0 && (t.best = true))
    return list
  })()
  const inbound = (() => {
    const m = new Map<
      string,
      {
        source: string
        calls: number
        answered: number
        missed: number
        talk: number
        leads: Set<string>
      }
    >()
    for (const c of calls) {
      if (c.direction !== 'in') continue
      const k = c.source || 'Unknown'
      const x = m.get(k) || {
        source: k,
        calls: 0,
        answered: 0,
        missed: 0,
        talk: 0,
        leads: new Set<string>(),
      }
      x.calls++
      if (c.status === 'completed') x.answered++
      if (c.status === 'missed') x.missed++
      x.talk += c.duration_sec
      if (c.lead_id) x.leads.add(c.lead_id)
      m.set(k, x)
    }
    return [...m.values()]
      .map((x) => ({
        ...x,
        pipeline: [...x.leads].filter((id) => data.leads.find((l) => l.id === id)?.stage).length,
      }))
      .sort((a, b) => b.calls - a.calls)
  })()
  const pipeline = data.leads.filter((l) => l.stage && !['won', 'lost', 'no_show'].includes(l.stage)).reduce((a, l) => a + (l.deal_value || 0), 0)

  return (
    <div className="space-y-5">
      <PageHeader
        title="Reports"
        sub="Where jobs come from and where they leak."
        actions={
          <>
            <Select label="Caller" value={who} onChange={setWho} options={[['all', 'Whole team'], ...data.settings.callers.map((c) => [c, c] as [string, string])]} />
            <Tabs
              value={days}
              onChange={setDays}
              items={[
                { key: '7', label: '7 days' },
                { key: '30', label: '30 days' },
                { key: '90', label: '90 days' },
              ]}
            />
          </>
        }
      />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Card>
          <CardHead title="Calling funnel" sub="Dial to signed, with the step-to-step rate" />
          <div className="space-y-2.5 px-4 pb-4">
            <Bar label="Dials" value={r.dials} max={r.dials} />
            <Bar label="Conversations" value={r.convos} max={r.dials} sub={pct(r.convos, r.dials)} />
            <Bar label="Booked" value={r.booked} max={r.dials} sub={pct(r.booked, r.convos)} tone="bg-accent-500" />
            <Bar label="Confirmed (YES)" value={r.confirmed} max={r.dials} sub={pct(r.confirmed, r.booked)} tone="bg-mist-400" />
            <Bar label="Showed" value={r.showed} max={r.dials} sub={pct(r.showed, r.confirmed)} tone="bg-sand-400" />
            <Bar label="Signed" value={r.signed} max={r.dials} sub={pct(r.signed, r.showed)} tone="bg-sage-400" />
            <p className="pt-1 text-xs text-ink-400">Your Jul–Oct baseline: 1,225 dials → 24 booked (2.0%) → 7–9 showed → 0 signed. Open pipeline now {money(pipeline)}.</p>
          </div>
        </Card>
        <Card>
          <CardHead title="Dials per day" sub={who === 'all' ? 'Whole team' : who} />
          <div className="px-4 pb-4">
            <DotBars data={chart} />
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Card>
          <CardHead title="Best hours to call" sub="Share of dials that turned into a conversation (30s+), by hour" />
          <div className="space-y-2 px-4 pb-4">
            {hours.map((h) => (
              <Bar
                key={h.h}
                label={h.label}
                value={h.convos}
                max={Math.max(1, ...hours.map((x) => x.convos))}
                sub={`${pct(h.convos, h.dials)} of ${h.dials}`}
                tone={h.best ? 'bg-sage-400' : 'bg-accent-400'}
              />
            ))}
            {!hours.length && <p className="text-sm text-ink-400">No dials in this range yet.</p>}
          </div>
        </Card>
        <Card className="overflow-x-auto">
          <CardHead title="Inbound calls by source" sub="Which number, page or ad made the phone ring" />
          <table className="w-full min-w-[480px] text-sm">
            <thead>
              <tr className="border-y border-line bg-panel">
                <Th>Source</Th>
                <Th className="text-right">Calls</Th>
                <Th className="text-right">Answered</Th>
                <Th className="text-right">Missed</Th>
                <Th className="text-right">Talk time</Th>
                <Th className="text-right">In pipeline</Th>
              </tr>
            </thead>
            <tbody>
              {inbound.map((x) => (
                <tr key={x.source} className="border-t border-line first:border-t-0">
                  <Td className="font-medium text-ink-900">{x.source}</Td>
                  <Td className="tabular text-right">{x.calls}</Td>
                  <Td className="tabular text-right">{pct(x.answered, x.calls)}</Td>
                  <Td className={`tabular text-right ${x.missed ? 'text-clay-700' : ''}`}>{x.missed}</Td>
                  <Td className="tabular text-right">{fmtDur(x.talk)}</Td>
                  <Td className="tabular text-right font-medium">{x.pipeline}</Td>
                </tr>
              ))}
              {!inbound.length && (
                <tr>
                  <Td className="text-ink-400">No inbound calls in this range.</Td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      </div>

      <Card className="overflow-x-auto">
        <CardHead title="Email by lane" sub="Tracked opens, clicks, replies and bookings per pain lane" />
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-y border-line bg-panel">
              <Th>Lane</Th>
              <Th className="text-right">Sent</Th>
              <Th className="text-right">Opened</Th>
              <Th className="text-right">Clicked</Th>
              <Th className="text-right">Replied</Th>
              <Th className="text-right">Bounced</Th>
              <Th className="text-right">Booked</Th>
            </tr>
          </thead>
          <tbody>
            {laneRows.map(({ lane, st, booked }) => (
              <tr key={lane} className="border-t border-line first:border-t-0">
                <Td className="font-medium text-ink-900">{lane === 'campaign' ? 'Campaigns (blasts)' : PAIN_LABEL[lane]}</Td>
                <Td className="tabular text-right">{st.sent}</Td>
                <Td className="tabular text-right">{pct(st.opened, st.delivered)}</Td>
                <Td className="tabular text-right">{pct(st.clicked, st.delivered)}</Td>
                <Td className="tabular text-right">{pct(st.replied, st.delivered)}</Td>
                <Td className={`tabular text-right ${st.sent && st.bounced / st.sent > data.settings.bounce_pause_pct / 100 ? 'text-clay-600' : ''}`}>
                  {pct(st.bounced, st.sent)}
                </Td>
                <Td className="tabular text-right font-medium">{booked}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Card>
          <CardHead title="Call outcomes" />
          <div className="space-y-2 px-4 pb-4">
            {r.outcomes.map((o) => (
              <Bar
                key={o.key}
                label={OUTCOME_LABEL[o.key]}
                value={o.n}
                max={Math.max(...r.outcomes.map((x) => x.n))}
                sub={pct(o.n, r.dials)}
                tone={CONVO_OUTCOMES.has(o.key) ? 'bg-accent-400' : 'bg-ink-300'}
              />
            ))}
          </div>
        </Card>
        <Card>
          <CardHead title="Callers" />
          <table className="w-full text-sm">
            <thead>
              <tr className="border-y border-line bg-panel">
                <Th>Caller</Th>
                <Th className="text-right">Dials</Th>
                <Th className="text-right">Convos</Th>
                <Th className="text-right">Booked</Th>
                <Th className="text-right">Book rate</Th>
                <Th className="text-right">Talk time</Th>
              </tr>
            </thead>
            <tbody>
              {data.settings.callers.map((c) => {
                const a = data.activities.filter((x) => x.user_name === c && x.created_at >= since)
                const d = a.filter(isDial).length
                const cv = a.filter((x) => CONVO_OUTCOMES.has(x.outcome)).length
                const b = data.meetings.filter((m) => m.owner === c && m.created_at >= since).length
                const talk = calls.filter((x) => x.user_name === c).reduce((sum, x) => sum + x.duration_sec, 0)
                return (
                  <tr key={c} className="border-t border-line first:border-t-0">
                    <Td>
                      <span className="flex items-center gap-2 font-medium text-ink-900">
                        <Avatar name={c} className="h-6 w-6 text-[9px]" /> {c}
                      </span>
                    </Td>
                    <Td className="tabular text-right">{d}</Td>
                    <Td className="tabular text-right">{cv}</Td>
                    <Td className="tabular text-right">{b}</Td>
                    <Td className="tabular text-right">{pct(b, d)}</Td>
                    <Td className="tabular text-right">{fmtDur(talk)}</Td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  )
}
