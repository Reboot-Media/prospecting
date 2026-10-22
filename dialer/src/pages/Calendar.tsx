import { useMemo, useState } from 'react'
import { Avatar, Badge, Button, Card, Icon, PageHeader, Tabs } from '../components/ui'
import { MEETING_LABEL, MEETING_TONE } from '../lib/constants'
import { fullName, isSameDay, prettyPhone, when } from '../lib/format'
import { useData } from '../lib/store'
import { fillTemplate, smsHref } from '../components/OutcomeModals'
import type { Meeting } from '../lib/types'

const START = 8
const END = 18
const ROW = 52 // px per hour

function monday(d: Date) {
  const x = new Date(d)
  const day = (x.getDay() + 6) % 7
  x.setDate(x.getDate() - day)
  x.setHours(0, 0, 0, 0)
  return x
}

export function Calendar({ openContact }: { openContact(id: string): void }) {
  const { me, data, leadById, setMeetingStatus } = useData()
  const [week, setWeek] = useState(() => monday(new Date()))
  const [view, setView] = useState<'week' | 'list'>(() => (typeof window !== 'undefined' && window.innerWidth < 768 ? 'list' : 'week'))
  const [sel, setSel] = useState('')

  const days = Array.from({ length: 5 }, (_, i) => {
    const d = new Date(week)
    d.setDate(week.getDate() + i)
    return d
  })
  const end = new Date(week)
  end.setDate(week.getDate() + 7)
  const inWeek = useMemo(() => data.meetings.filter((m) => m.status !== 'canceled' && m.starts_at >= week.toISOString() && m.starts_at < end.toISOString()), [data.meetings, week]) // eslint-disable-line react-hooks/exhaustive-deps
  const nowIso = new Date().toISOString()
  const next = data.meetings.filter((m) => m.starts_at >= nowIso && m.status !== 'canceled').sort((a, b) => a.starts_at.localeCompare(b.starts_at))[0]
  const focus = data.meetings.find((m) => m.id === sel) || next
  const fl = focus ? leadById.get(focus.lead_id) : undefined
  const range = `${days[0].toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${days[4].toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
  const shift = (n: number) => setWeek((w) => new Date(w.getTime() + n * 7 * 864e5))

  const block = (m: Meeting) => {
    const d = new Date(m.starts_at)
    const top = (d.getHours() + d.getMinutes() / 60 - START) * ROW
    const l = leadById.get(m.lead_id)
    const tone = {
      scheduled: 'bg-sand-50 ring-sand-400/40',
      confirmed: 'bg-sage-50 ring-sage-400/40',
      showed: 'bg-accent-50 ring-accent-400/30',
      no_show: 'bg-clay-50 ring-clay-400/40',
      canceled: 'bg-wash ring-line',
    }[m.status]
    return (
      <button
        key={m.id}
        onClick={() => setSel(m.id)}
        style={{ top, height: Math.max(ROW * (m.minutes / 60) - 4, 34) }}
        className={`absolute inset-x-1 overflow-hidden rounded-lg px-2 py-1 text-left ring-1 ring-inset ${tone} ${focus?.id === m.id ? 'outline outline-2 outline-ink-900' : ''}`}
      >
        <div className="truncate text-[11px] font-semibold text-ink-900">{l?.company}</div>
        <div className="truncate text-[10px] text-ink-500">
          {d.toLocaleTimeString(undefined, {
            hour: 'numeric',
            minute: '2-digit',
          })}{' '}
          · {m.owner}
        </div>
      </button>
    )
  }

  return (
    <div>
      <PageHeader
        title="Calendar"
        sub="Every booked call. Mark YES, showed or no-show right here."
        actions={
          <>
            <Tabs
              value={view}
              onChange={setView}
              items={[
                { key: 'week', label: 'Week' },
                { key: 'list', label: 'List' },
              ]}
            />
            <div className="flex items-center gap-1">
              <Button size="sm" onClick={() => shift(-1)} aria-label="Previous week">
                <Icon name="left" />
              </Button>
              <Button size="sm" onClick={() => setWeek(monday(new Date()))}>
                Today
              </Button>
              <Button size="sm" onClick={() => shift(1)} aria-label="Next week">
                <Icon name="chevron" />
              </Button>
            </div>
          </>
        }
      />
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_320px]">
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <span className="text-sm font-semibold text-ink-900">{range}</span>
            <span className="text-xs text-ink-500">{inWeek.length} meetings</span>
          </div>
          {view === 'week' ? (
            <div className="overflow-x-auto">
              <div className="grid min-w-[640px] grid-cols-[48px_repeat(5,1fr)]">
                <div />
                {days.map((d) => (
                  <div
                    key={d.toISOString()}
                    className={`border-b border-l border-line px-2 py-2 text-center text-xs ${isSameDay(d, new Date()) ? 'font-semibold text-ink-900' : 'text-ink-500'}`}
                  >
                    {d.toLocaleDateString(undefined, { weekday: 'short' })} {d.getDate()}
                  </div>
                ))}
                <div className="relative" style={{ height: (END - START) * ROW }}>
                  {Array.from({ length: END - START }, (_, i) => (
                    <div key={i} className="absolute right-2 text-[10px] text-ink-400" style={{ top: i * ROW - 6 }}>
                      {((START + i - 1) % 12) + 1} {START + i < 12 ? 'AM' : 'PM'}
                    </div>
                  ))}
                </div>
                {days.map((d) => (
                  <div key={d.toISOString()} className={`relative border-l border-line ${isSameDay(d, new Date()) ? 'bg-panel' : ''}`} style={{ height: (END - START) * ROW }}>
                    {Array.from({ length: END - START }, (_, i) => (
                      <div key={i} className="absolute inset-x-0 border-t border-line/70" style={{ top: i * ROW }} />
                    ))}
                    {inWeek.filter((m) => isSameDay(new Date(m.starts_at), d)).map(block)}
                    {isSameDay(d, new Date()) && new Date().getHours() >= START && new Date().getHours() < END && (
                      <div
                        className="absolute inset-x-0 z-10 h-px bg-clay-400"
                        style={{
                          top: (new Date().getHours() + new Date().getMinutes() / 60 - START) * ROW,
                        }}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <ul>
              {inWeek.length === 0 && <li className="p-6 text-center text-sm text-ink-500">No meetings this week.</li>}
              {inWeek
                .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
                .map((m) => {
                  const l = leadById.get(m.lead_id)
                  return (
                    <li key={m.id}>
                      <button onClick={() => setSel(m.id)} className="flex w-full items-center gap-3 border-b border-line px-4 py-3 text-left hover:bg-panel">
                        <Avatar name={l?.company || '?'} />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium text-ink-900">{l?.company}</div>
                          <div className="truncate text-xs text-ink-500">
                            {when(m.starts_at)} · {m.owner}
                          </div>
                        </div>
                        <Badge tone={MEETING_TONE[m.status]}>{MEETING_LABEL[m.status]}</Badge>
                      </button>
                    </li>
                  )
                })}
            </ul>
          )}
        </Card>

        <div className="space-y-5">
          <Card className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-semibold text-ink-900">{focus && focus === next && !sel ? 'Next meeting' : 'Meeting'}</span>
              {focus && <Badge tone={MEETING_TONE[focus.status]}>{MEETING_LABEL[focus.status]}</Badge>}
            </div>
            {!focus || !fl ? (
              <p className="text-sm text-ink-500">Nothing booked ahead.</p>
            ) : (
              <div className="space-y-4">
                <div>
                  <button onClick={() => openContact(fl.id)} className="text-base font-semibold text-ink-900 hover:underline">
                    {fl.company}
                  </button>
                  <div className="text-sm text-ink-500">{when(focus.starts_at)} · 30 min</div>
                </div>
                <dl className="space-y-2.5 text-sm">
                  <div>
                    <dt className="text-xs text-ink-400">Why now (his words)</dt>
                    <dd className="text-ink-900">{focus.why_now ? `"${focus.why_now}"` : '–'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-ink-400">Owner</dt>
                    <dd className="text-ink-900">
                      {fullName(fl) || '–'} · {prettyPhone(fl.phone)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-ink-400">Host · booked from</dt>
                    <dd className="text-ink-900">
                      {focus.owner} · {focus.source}
                    </dd>
                  </div>
                </dl>
                <div className="grid grid-cols-2 gap-2">
                  {focus.status === 'scheduled' && (
                    <Button variant="primary" className="col-span-2" onClick={() => setMeetingStatus(focus, 'confirmed')}>
                      <Icon name="check" /> He replied YES
                    </Button>
                  )}
                  {focus.status === 'scheduled' && (
                    <a
                      href={smsHref(fl.phone, fillTemplate(data.settings.booking_text, fl, me.name, focus.starts_at, focus.why_now))}
                      className="col-span-2 inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-white text-sm font-medium text-ink-900 ring-1 ring-inset ring-line hover:bg-wash"
                    >
                      <Icon name="message" /> Resend confirmation text
                    </a>
                  )}
                  <Button onClick={() => setMeetingStatus(focus, 'showed')} disabled={focus.status === 'showed'}>
                    Showed
                  </Button>
                  <Button variant="danger" onClick={() => setMeetingStatus(focus, 'no_show')} disabled={focus.status === 'no_show'}>
                    No-show
                  </Button>
                </div>
              </div>
            )}
          </Card>
          <Card className="p-4">
            <div className="mb-2 text-sm font-semibold text-ink-900">Booking link</div>
            <p className="text-xs text-ink-500">Roofers who book themselves land here once the booking calendar is connected (Integrations).</p>
            <div className="mt-2 truncate rounded-lg bg-wash px-2.5 py-1.5 text-xs text-ink-700 ring-1 ring-inset ring-line">{data.settings.booking_link}</div>
          </Card>
        </div>
      </div>
    </div>
  )
}
