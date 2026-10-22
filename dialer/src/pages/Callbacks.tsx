import { useState } from 'react'
import { Button, Card, Empty, PageHeader, PainBadge, Select } from '../components/ui'
import { when } from '../lib/format'
import { useData } from '../lib/store'

type Tab = 'overdue' | 'today' | 'upcoming' | 'done'

export function Callbacks({ openLead, callNow }: { openLead(id: string): void; callNow(id: string): void }) {
  const { me, data, leadById, completeCallback, rescheduleCallback } = useData()
  const [tab, setTab] = useState<Tab>('overdue')
  const [who, setWho] = useState('mine')
  const now = new Date()
  const eod = new Date()
  eod.setHours(23, 59, 59, 999)

  const base = data.callbacks.filter((c) => who === 'all' || c.owner === me.name)
  const groups: Record<Tab, typeof base> = {
    overdue: base.filter((c) => !c.done_at && new Date(c.due_at) <= now),
    today: base.filter((c) => !c.done_at && new Date(c.due_at) > now && new Date(c.due_at) <= eod),
    upcoming: base.filter((c) => !c.done_at && new Date(c.due_at) > eod),
    done: base.filter((c) => c.done_at).sort((a, b) => b.done_at!.localeCompare(a.done_at!)).slice(0, 50),
  }
  const rows = tab === 'done' ? groups.done : [...groups[tab]].sort((a, b) => a.due_at.localeCompare(b.due_at))

  const TABS: [Tab, string][] = [
    ['overdue', 'Overdue'],
    ['today', 'Later today'],
    ['upcoming', 'Upcoming'],
    ['done', 'Done'],
  ]

  return (
    <div>
      <PageHeader
        title="Callbacks"
        sub="Every 'call me back' with a time and a reason. You get a ping when one comes due."
        actions={
          <Select
            value={who}
            onChange={setWho}
            options={[
              ['mine', 'Mine'],
              ['all', 'Everyone'],
            ]}
          />
        }
      />
      <div className="mb-4 inline-flex rounded-lg bg-zinc-100 p-1">
        {TABS.map(([k, l]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${tab === k ? 'bg-white text-ink-900 shadow-card' : 'text-ink-500 hover:text-ink-900'}`}
          >
            {l}
            {k !== 'done' && groups[k].length > 0 && (
              <span className={`ml-1.5 rounded-full px-1.5 text-[11px] ${k === 'overdue' ? 'bg-amber-100 text-amber-800' : 'bg-zinc-200 text-ink-700'}`}>{groups[k].length}</span>
            )}
          </button>
        ))}
      </div>
      <Card>
        {rows.length === 0 ? (
          <Empty title={tab === 'overdue' ? 'Nothing overdue' : 'Nothing here'} sub={tab === 'overdue' ? 'Every promised callback is handled.' : undefined} />
        ) : (
          <ul>
            {rows.map((c) => {
              const l = leadById.get(c.lead_id)
              if (!l) return null
              return (
                <li key={c.id} className="flex flex-wrap items-center gap-3 border-t border-line px-4 py-3 first:border-t-0 sm:flex-nowrap">
                  <div className={`w-36 shrink-0 text-sm font-semibold ${tab === 'overdue' ? 'text-amber-700' : 'text-ink-900'}`}>{when(c.done_at || c.due_at)}</div>
                  <button onClick={() => openLead(l.id)} className="min-w-0 flex-1 text-left">
                    <div className="truncate text-sm font-medium text-ink-900">{l.company}</div>
                    <div className="truncate text-xs text-ink-500">
                      {c.reason} · {c.owner}
                    </div>
                  </button>
                  <PainBadge pain={l.pain} />
                  {!c.done_at && (
                    <div className="flex gap-1.5">
                      <Button size="sm" onClick={() => rescheduleCallback(c, new Date(Date.now() + 3600e3).toISOString())}>
                        +1 hour
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => completeCallback(c)}>
                        Clear
                      </Button>
                      <Button size="sm" variant="primary" onClick={() => callNow(l.id)}>
                        Call
                      </Button>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </Card>
    </div>
  )
}
