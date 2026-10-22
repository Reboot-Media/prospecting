import { useMemo, useState } from 'react'
import { Avatar, Badge, Card, CardHead, DotBars, Icon, Meter, StatStrip, Tabs, type IconName } from '../components/ui'
import { MEETING_LABEL, MEETING_TONE, OUTCOME_LABEL } from '../lib/constants'
import { ago, startOfToday, when } from '../lib/format'
import { CONVO_OUTCOMES, isDial, perDay } from '../lib/metrics'
import { useData } from '../lib/store'
import { calledBackAfter } from './Calls'
import type { Route } from '../lib/router'

export function Home({ go, openContact, callNow }: { go(r: Route): void; openContact(id: string): void; callNow(id: string): void }) {
  const { me, data, leadById } = useData()
  const [range, setRange] = useState<'14' | '30'>('14')
  const today = startOfToday().toISOString()
  const yesterday = new Date(startOfToday().getTime() - 864e5).toISOString()
  const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString()
  const nowIso = new Date().toISOString()

  const s = useMemo(() => {
    const todays = data.activities.filter((a) => a.created_at >= today)
    const yest = data.activities.filter((a) => a.created_at >= yesterday && a.created_at < today)
    const mine = todays.filter((a) => a.user_name === me.name)
    const week = data.meetings.filter((m) => m.created_at >= weekAgo)
    const pastMeet = data.meetings.filter((m) => m.starts_at < nowIso && m.starts_at >= new Date(Date.now() - 30 * 864e5).toISOString())
    const showed = pastMeet.filter((m) => m.status === 'showed').length
    const judged = pastMeet.filter((m) => m.status === 'showed' || m.status === 'no_show').length
    return {
      dialsMine: mine.filter(isDial).length,
      dialsTeam: todays.filter(isDial).length,
      dialsYest: yest.filter(isDial).length,
      convos: todays.filter((a) => CONVO_OUTCOMES.has(a.outcome)).length,
      booked: week.length,
      showRate: judged ? Math.round((showed / judged) * 100) : 0,
      judged,
    }
  }, [data.activities, data.meetings, me.name, today, yesterday, weekAgo, nowIso])

  const chart = useMemo(() => perDay(data.activities, Number(range), isDial), [data.activities, range])
  const due = data.tasks.filter((t) => !t.done_at && t.owner === me.name && t.due_at <= new Date(Date.now() + 864e5).toISOString()).sort((a, b) => a.due_at.localeCompare(b.due_at))
  const drafts = data.emails.filter((e) => e.status === 'draft').length
  const replies = data.emails.filter((e) => e.direction === 'in' && e.created_at >= weekAgo)
  const hot = useMemo(() => {
    const byLead = new Map<string, number>()
    for (const e of data.emails) if (e.direction === 'out' && e.opens) byLead.set(e.lead_id, (byLead.get(e.lead_id) || 0) + e.opens + e.clicks * 3)
    return [...byLead.entries()]
      .filter(([id]) => {
        const l = leadById.get(id)
        return l && !l.stage && l.sequence_state !== 'replied' && l.status !== 'dnc'
      })
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
  }, [data.emails, leadById])
  const upcoming = data.meetings
    .filter((m) => m.starts_at >= nowIso && m.status !== 'canceled')
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
    .slice(0, 5)
  const goal = data.settings.daily_dial_goal
  const hour = new Date().getHours()
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const pace = Math.round((s.dialsMine / goal) * 100)

  const team = data.settings.callers.map((c) => {
    const a = data.activities.filter((x) => x.user_name === c && x.created_at >= today)
    return {
      name: c,
      dials: a.filter(isDial).length,
      convos: a.filter((x) => CONVO_OUTCOMES.has(x.outcome)).length,
      booked: a.filter((x) => x.outcome === 'booked').length,
    }
  })

  const missed = data.calls
    .filter((c) => c.status === 'missed' && c.started_at >= weekAgo && !calledBackAfter(c, data.calls))
    .sort((a, b) => b.started_at.localeCompare(a.started_at))
  const need: {
    icon: IconName
    title: string
    sub: string
    tone: 'sand' | 'violet' | 'sage' | 'mist' | 'clay'
    onClick(): void
  }[] = [
    ...(missed.length
      ? [
          {
            icon: 'calls' as const,
            title: `${missed.length} missed call${missed.length === 1 ? '' : 's'} to return`,
            sub: `Latest: ${(missed[0].lead_id && leadById.get(missed[0].lead_id)?.company) || 'unknown caller'} via ${missed[0].source} · ${when(missed[0].started_at)}`,
            tone: 'clay' as const,
            onClick: () => go('calls'),
          },
        ]
      : []),
    ...(due.length
      ? [
          {
            icon: 'bell' as const,
            title: `${due.length} callback${due.length === 1 ? '' : 's'} today`,
            sub: due[0] ? `Next: ${leadById.get(due[0].lead_id || '')?.company || due[0].reason} · ${when(due[0].due_at)}` : '',
            tone: 'sand' as const,
            onClick: () => go('tasks'),
          },
        ]
      : []),
    ...(drafts
      ? [
          {
            icon: 'approve' as const,
            title: `${drafts} email${drafts === 1 ? '' : 's'} to approve`,
            sub: 'Nothing sends until you approve',
            tone: 'violet' as const,
            onClick: () => go('approvals'),
          },
        ]
      : []),
    ...(replies.length
      ? [
          {
            icon: 'reply' as const,
            title: `${replies.length} repl${replies.length === 1 ? 'y' : 'ies'} this week`,
            sub: `Latest from ${leadById.get(replies[replies.length - 1].lead_id)?.company || 'a roofer'}`,
            tone: 'sage' as const,
            onClick: () => go('inbox'),
          },
        ]
      : []),
  ]

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight text-ink-900">
            {greet}, {me.name === 'K' ? 'Kendall' : me.name}
          </h1>
          <p className="mt-0.5 text-sm text-ink-500">
            {pace >= 100 ? 'You hit your dials today. Good day.' : `${goal - s.dialsMine} dials to go. ${s.convos} conversations so far.`}
          </p>
        </div>
        <div className="w-full max-w-xs">
          <div className="mb-1 flex justify-between text-xs text-ink-500">
            <span>Your dials today</span>
            <span className="tabular font-medium text-ink-900">
              {s.dialsMine} / {goal}
            </span>
          </div>
          <Meter value={s.dialsMine} max={goal} />
        </div>
      </div>

      <StatStrip
        items={[
          {
            label: 'Team dials today',
            icon: 'phone',
            value: s.dialsTeam,
            sub: `${s.dialsYest} yesterday`,
            delta: s.dialsYest
              ? {
                  text: `${s.dialsTeam >= s.dialsYest ? '↑' : '↓'} ${Math.abs(Math.round(((s.dialsTeam - s.dialsYest) / s.dialsYest) * 100))}%`,
                  good: s.dialsTeam >= s.dialsYest,
                }
              : undefined,
          },
          {
            label: 'Conversations',
            icon: 'message',
            value: s.convos,
            sub: 'Owner on the line today',
          },
          {
            label: 'Booked this week',
            icon: 'calendar',
            value: s.booked,
            sub: 'Meetings set in 7 days',
          },
          {
            label: 'Show rate',
            icon: 'check',
            value: s.judged ? `${s.showRate}%` : '–',
            sub: `Last 30 days · ${s.judged} meetings`,
            delta: s.judged
              ? {
                  text: s.showRate >= 50 ? 'on track' : 'below 50%',
                  good: s.showRate >= 50,
                }
              : undefined,
          },
        ]}
      />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHead
            title="Dials"
            sub={`Team, last ${range} days`}
            actions={
              <Tabs
                value={range}
                onChange={setRange}
                items={[
                  { key: '14', label: '14 days' },
                  { key: '30', label: '30 days' },
                ]}
              />
            }
          />
          <div className="px-4 pb-4">
            <DotBars data={chart} rows={18} height={250} />
          </div>
        </Card>

        <Card>
          <CardHead title="Needs you now" sub={need.length ? `${need.length} thing${need.length === 1 ? '' : 's'}` : 'All clear'} />
          <div className="space-y-1.5 px-3 pb-3">
            {need.length === 0 && <div className="px-1 pb-2 text-sm text-ink-500">Nothing waiting. Go dial.</div>}
            {need.map((n) => (
              <button key={n.title} onClick={n.onClick} className="flex w-full items-center gap-3 rounded-lg p-2 text-left hover:bg-wash">
                <span
                  className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ring-1 ring-inset ${n.tone === 'sand' ? 'bg-sand-50 text-sand-700 ring-sand-400/30' : n.tone === 'clay' ? 'bg-clay-50 text-clay-700 ring-clay-400/30' : n.tone === 'violet' ? 'bg-accent-50 text-accent-700 ring-accent-400/30' : 'bg-sage-50 text-sage-700 ring-sage-400/30'}`}
                >
                  <Icon name={n.icon} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-ink-900">{n.title}</div>
                  <div className="truncate text-xs text-ink-500">{n.sub}</div>
                </div>
                <Icon name="chevron" className="h-4 w-4 text-ink-300" />
              </button>
            ))}
            {hot.length > 0 && (
              <div className="border-t border-line pt-2">
                <div className="px-2 pb-1 text-[11px] font-medium uppercase tracking-wider text-ink-400">Hot from email: call these</div>
                {hot.map(([id, score]) => {
                  const l = leadById.get(id)!
                  return (
                    <button key={id} onClick={() => callNow(id)} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-wash">
                      <span className="min-w-0 flex-1 truncate text-sm text-ink-900">{l.company}</span>
                      <span className="tabular text-xs text-ink-500">{score} pts</span>
                      <Icon name="phone" className="h-3.5 w-3.5 text-sage-600" />
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHead
            title="Upcoming meetings"
            actions={
              <button onClick={() => go('calendar')} className="text-xs text-ink-500 hover:text-ink-900">
                Calendar →
              </button>
            }
          />
          {upcoming.length === 0 ? (
            <div className="px-4 pb-4 text-sm text-ink-500">No meetings booked yet.</div>
          ) : (
            <ul className="px-2 pb-2">
              {upcoming.map((m) => {
                const l = leadById.get(m.lead_id)
                return (
                  <li key={m.id}>
                    <button onClick={() => openContact(m.lead_id)} className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-wash">
                      <Avatar name={l?.company || '?'} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-ink-900">{l?.company}</div>
                        <div className="truncate text-xs text-ink-500">{m.why_now ? `"${m.why_now}"` : l?.city}</div>
                      </div>
                      <span className="hidden text-xs text-ink-500 sm:block">{when(m.starts_at)}</span>
                      <Badge tone={MEETING_TONE[m.status]}>{MEETING_LABEL[m.status]}</Badge>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>
        <Card>
          <CardHead title="Team today" />
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] text-ink-400">
                <th className="px-4 pb-2 text-left font-medium">Caller</th>
                <th className="px-2 pb-2 text-right font-medium">Dials</th>
                <th className="px-2 pb-2 text-right font-medium">Convos</th>
                <th className="px-4 pb-2 text-right font-medium">Booked</th>
              </tr>
            </thead>
            <tbody>
              {team.map((t) => (
                <tr key={t.name} className="border-t border-line">
                  <td className="px-4 py-2.5">
                    <span className="flex items-center gap-2 font-medium text-ink-900">
                      <Avatar name={t.name} className="h-6 w-6 text-[9px]" /> {t.name}
                    </span>
                  </td>
                  <td className="tabular px-2 text-right">{t.dials}</td>
                  <td className="tabular px-2 text-right">{t.convos}</td>
                  <td className="tabular px-4 text-right">{t.booked}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-2 border-t border-line px-4 py-3">
            <div className="mb-2 text-[11px] font-medium uppercase tracking-wider text-ink-400">Latest</div>
            <ul className="space-y-2">
              {data.activities
                .slice()
                .sort((a, b) => b.created_at.localeCompare(a.created_at))
                .slice(0, 5)
                .map((a) => (
                  <li key={a.id} className="flex items-center gap-2 text-xs">
                    <span className="font-medium text-ink-700">{a.user_name}</span>
                    <span className="truncate text-ink-500">
                      {OUTCOME_LABEL[a.outcome]} · {leadById.get(a.lead_id)?.company}
                    </span>
                    <span className="ml-auto shrink-0 text-ink-400">{ago(a.created_at)}</span>
                  </li>
                ))}
            </ul>
          </div>
        </Card>
      </div>
    </div>
  )
}
