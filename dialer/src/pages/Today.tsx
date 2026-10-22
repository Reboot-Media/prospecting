import { Button, Card, Empty, Icon, PainBadge, Stat, StatusBadge } from '../components/ui'
import { OUTCOMES, OUTCOME_LABEL } from '../lib/constants'
import { ago, isSameDay, startOfToday, when } from '../lib/format'
import { useData } from '../lib/store'

const CONVO = new Set(OUTCOMES.filter((o) => o.conversation).map((o) => o.key))
const DIALS = new Set(OUTCOMES.map((o) => o.key))

export function Today({ openLead, callNow }: { openLead(id: string): void; callNow(id: string): void }) {
  const { me, data, leadById } = useData()
  const today = startOfToday().toISOString()
  const todays = data.activities.filter((a) => a.created_at >= today && DIALS.has(a.outcome))
  const by = (name: string) => todays.filter((a) => a.user_name === name)
  const stats = (list: typeof todays) => ({
    dials: list.length,
    convos: list.filter((a) => CONVO.has(a.outcome)).length,
    booked: list.filter((a) => a.outcome === 'booked').length,
  })
  const mine = stats(by(me.name))
  const endOfDay = new Date()
  endOfDay.setHours(23, 59, 59, 999)
  const due = data.callbacks
    .filter((c) => !c.done_at && c.owner === me.name && new Date(c.due_at) <= endOfDay)
    .sort((a, b) => a.due_at.localeCompare(b.due_at))
  const overdue = due.filter((c) => new Date(c.due_at) <= new Date()).length
  const meetings = data.leads
    .filter((l) => (l.status === 'booked' || l.status === 'confirmed') && l.meeting_at && new Date(l.meeting_at).getTime() > Date.now() - 2 * 3600e3)
    .sort((a, b) => a.meeting_at!.localeCompare(b.meeting_at!))
  const recent = [...data.activities].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 8)
  const callers = Array.from(new Set([...data.settings.callers, ...todays.map((a) => a.user_name)]))
  const hour = new Date().getHours()

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-ink-900">
            Good {hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening'}, {me.name}
          </h1>
          <p className="mt-0.5 text-sm text-ink-500">
            {new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date())}
          </p>
        </div>
        <Button variant="primary" onClick={() => callNow('')}>
          <Icon name="phone" /> Start dialing
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Stat icon="phone" label="My dials today" value={mine.dials} sub="Goal 100" />
        <Stat icon="users" label="Owner conversations" value={mine.convos} sub={mine.dials ? `${Math.round((mine.convos / mine.dials) * 100)}% of dials` : '—'} />
        <Stat icon="calendar" label="Booked today" value={mine.booked} sub={mine.dials ? `${((mine.booked / mine.dials) * 100).toFixed(1)}% of dials` : '—'} />
        <Stat icon="bell" label="Callbacks due today" value={due.length} sub={overdue ? <span className="font-medium text-amber-700">{overdue} overdue</span> : 'None overdue'} />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-5">
        <Card className="xl:col-span-3">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <h2 className="text-sm font-semibold text-ink-900">My callbacks due today</h2>
            <span className="text-xs text-ink-500">{due.length}</span>
          </div>
          {due.length === 0 ? (
            <Empty title="No callbacks due" sub='When someone says "call me back", set it from the Dial screen and it lands here.' />
          ) : (
            <ul>
              {due.map((c) => {
                const l = leadById.get(c.lead_id)
                if (!l) return null
                const late = new Date(c.due_at) <= new Date()
                return (
                  <li key={c.id} className="flex items-center gap-3 border-t border-line px-4 py-3 first:border-t-0">
                    <div className={`w-24 shrink-0 text-xs font-semibold ${late ? 'text-amber-700' : 'text-ink-700'}`}>{when(c.due_at).replace('Today ', '')}</div>
                    <button onClick={() => openLead(l.id)} className="min-w-0 flex-1 text-left">
                      <div className="truncate text-sm font-medium text-ink-900">{l.company}</div>
                      <div className="truncate text-xs text-ink-500">{c.reason}</div>
                    </button>
                    <Button size="sm" variant={late ? 'primary' : 'secondary'} onClick={() => callNow(l.id)}>
                      Call
                    </Button>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>

        <Card className="xl:col-span-2">
          <div className="border-b border-line px-4 py-3">
            <h2 className="text-sm font-semibold text-ink-900">Team today</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-ink-500">
                <th className="px-4 py-2 font-medium">Caller</th>
                <th className="px-2 py-2 text-right font-medium">Dials</th>
                <th className="px-2 py-2 text-right font-medium">Convos</th>
                <th className="px-4 py-2 text-right font-medium">Booked</th>
              </tr>
            </thead>
            <tbody>
              {callers.map((c) => {
                const s = stats(by(c))
                return (
                  <tr key={c} className="border-t border-line">
                    <td className="px-4 py-2.5 font-medium text-ink-900">{c}</td>
                    <td className="px-2 py-2.5 text-right tabular-nums">{s.dials}</td>
                    <td className="px-2 py-2.5 text-right tabular-nums">{s.convos}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{s.booked}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Card>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-5">
        <Card className="xl:col-span-3">
          <div className="border-b border-line px-4 py-3">
            <h2 className="text-sm font-semibold text-ink-900">Upcoming meetings</h2>
          </div>
          {meetings.length === 0 ? (
            <Empty title="No meetings booked yet" />
          ) : (
            <ul>
              {meetings.map((l) => (
                <li key={l.id} className="flex items-center gap-3 border-t border-line px-4 py-3 first:border-t-0">
                  <div className="w-32 shrink-0 text-xs font-semibold text-ink-700">{when(l.meeting_at)}</div>
                  <button onClick={() => openLead(l.id)} className="min-w-0 flex-1 text-left">
                    <div className="truncate text-sm font-medium text-ink-900">{l.company}</div>
                    <div className="truncate text-xs text-ink-500">{l.why_now || '—'}</div>
                  </button>
                  <StatusBadge status={l.status} />
                </li>
              ))}
            </ul>
          )}
          {meetings.some((l) => l.status === 'booked') && (
            <p className="border-t border-line px-4 py-2.5 text-xs text-ink-500">"Booked" means no YES yet. Call anyone still unconfirmed by end of day.</p>
          )}
        </Card>
        <Card className="xl:col-span-2">
          <div className="border-b border-line px-4 py-3">
            <h2 className="text-sm font-semibold text-ink-900">Recent activity</h2>
          </div>
          <ul>
            {recent.map((a) => {
              const l = leadById.get(a.lead_id)
              return (
                <li key={a.id} className="flex items-center gap-3 border-t border-line px-4 py-2.5 first:border-t-0">
                  <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-zinc-100 text-[11px] font-semibold text-ink-700">{a.user_name.slice(0, 2)}</div>
                  <button onClick={() => l && openLead(l.id)} className="min-w-0 flex-1 text-left">
                    <div className="truncate text-sm text-ink-900">
                      <span className="font-medium">{OUTCOME_LABEL[a.outcome]}</span> · {l?.company || 'Lead'}
                    </div>
                    <div className="text-xs text-ink-400">{isSameDay(new Date(a.created_at), new Date()) ? ago(a.created_at) : when(a.created_at)}</div>
                  </button>
                  {l && <PainBadge pain={l.pain} />}
                </li>
              )
            })}
          </ul>
        </Card>
      </div>
    </div>
  )
}
