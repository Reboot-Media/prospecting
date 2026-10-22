import { useState } from 'react'
import { Avatar, Badge, Button, Card, Empty, Icon, PageHeader, Select, Tabs, inputCls } from '../components/ui'
import { ago, nextWeekdayAt, prettyPhone, toLocalInput, uid, when } from '../lib/format'
import { useData } from '../lib/store'
import type { Task } from '../lib/types'

type Tab = 'overdue' | 'today' | 'upcoming' | 'done'

export function Tasks({ openContact, callNow }: { openContact(id: string): void; callNow(id: string): void }) {
  const { me, data, leadById, completeTask, rescheduleTask, save } = useData()
  const [who, setWho] = useState('mine')
  const [tab, setTab] = useState<Tab>('overdue')
  const [text, setText] = useState('')
  const [due, setDue] = useState(() => toLocalInput(nextWeekdayAt(9)))

  const nowIso = new Date().toISOString()
  const eod = new Date()
  eod.setHours(23, 59, 59, 999)
  const mine = data.tasks.filter((t) => who === 'all' || t.owner === me.name)
  const groups: Record<Tab, Task[]> = {
    overdue: mine.filter((t) => !t.done_at && t.due_at < nowIso),
    today: mine.filter((t) => !t.done_at && t.due_at >= nowIso && t.due_at <= eod.toISOString()),
    upcoming: mine.filter((t) => !t.done_at && t.due_at > eod.toISOString()),
    done: mine.filter((t) => t.done_at).sort((a, b) => (b.done_at || '').localeCompare(a.done_at || '')),
  }
  const list = tab === 'done' ? groups.done.slice(0, 50) : groups[tab].sort((a, b) => a.due_at.localeCompare(b.due_at))

  return (
    <div className="max-w-4xl">
      <PageHeader
        title="Tasks"
        sub="Callbacks from the dialer plus anything else you need to do. Due ones beep and pop up while the app is open."
        actions={
          <Select
            label="Whose"
            value={who}
            onChange={setWho}
            options={[
              ['mine', 'Mine'],
              ['all', 'Everyone'],
            ]}
          />
        }
      />
      <form
        className="mb-4 flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (!text.trim()) return
          save('tasks', {
            id: uid(),
            lead_id: null,
            kind: 'todo',
            owner: me.name,
            due_at: new Date(due).toISOString(),
            reason: text.trim(),
            done_at: null,
            created_by: me.name,
            created_at: new Date().toISOString(),
          })
          setText('')
        }}
      >
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a task…" className={`${inputCls} min-w-[200px] flex-1`} />
        <input aria-label="Due" type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} className={`${inputCls} w-auto`} />
        <Button type="submit" variant="primary" disabled={!text.trim()}>
          <Icon name="plus" /> Add
        </Button>
      </form>
      <div className="mb-3">
        <Tabs
          value={tab}
          onChange={setTab}
          items={[
            { key: 'overdue', label: 'Overdue', count: groups.overdue.length },
            { key: 'today', label: 'Later today', count: groups.today.length },
            {
              key: 'upcoming',
              label: 'Upcoming',
              count: groups.upcoming.length,
            },
            { key: 'done', label: 'Done', count: groups.done.length },
          ]}
        />
      </div>
      <Card>
        {list.length === 0 ? (
          <Empty title={tab === 'overdue' ? 'Nothing overdue' : 'Nothing here'} sub="Callbacks you set from the dialer show up here with their time." />
        ) : (
          <ul>
            {list.map((t) => {
              const l = t.lead_id ? leadById.get(t.lead_id) : undefined
              const late = !t.done_at && t.due_at < nowIso
              return (
                <li key={t.id} className="flex flex-wrap items-center gap-3 border-t border-line px-4 py-3 first:border-t-0">
                  <button
                    aria-label="Mark done"
                    disabled={!!t.done_at}
                    onClick={() => completeTask(t)}
                    className={`grid h-5 w-5 shrink-0 place-items-center rounded-md ring-1 ring-inset ${t.done_at ? 'bg-ink-900 text-white ring-ink-900' : 'ring-ink-300 hover:bg-wash'}`}
                  >
                    {t.done_at && <Icon name="check" className="h-3 w-3" />}
                  </button>
                  {l ? (
                    <Avatar name={l.company} />
                  ) : (
                    <span className="grid h-7 w-7 place-items-center rounded-full bg-wash text-ink-400 ring-1 ring-inset ring-line">
                      <Icon name="task" className="h-3.5 w-3.5" />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <button
                      onClick={() => l && openContact(l.id)}
                      className={`block truncate text-left text-sm font-medium ${t.done_at ? 'text-ink-400 line-through' : 'text-ink-900'}`}
                    >
                      {l ? l.company : t.reason}
                    </button>
                    <div className="truncate text-xs text-ink-500">
                      {l ? `${t.reason} · ${prettyPhone(l.phone)}` : t.kind === 'todo' ? 'To-do' : ''} · {t.owner}
                    </div>
                  </div>
                  <Badge tone={t.kind === 'callback' ? 'sand' : t.kind === 'follow_up' ? 'mist' : 'stone'}>
                    {t.kind === 'callback' ? 'Callback' : t.kind === 'follow_up' ? 'Follow-up' : 'To-do'}
                  </Badge>
                  <span className={`w-28 text-right text-xs ${late ? 'font-semibold text-clay-600' : 'text-ink-500'}`}>
                    {t.done_at ? `done ${ago(t.done_at)}` : when(t.due_at)}
                  </span>
                  {!t.done_at && (
                    <div className="flex gap-1.5">
                      <Button size="sm" variant="ghost" onClick={() => rescheduleTask(t, new Date(Math.max(Date.now(), new Date(t.due_at).getTime()) + 3600e3).toISOString())}>
                        +1 h
                      </Button>
                      {l?.phone && (
                        <Button size="sm" variant="primary" onClick={() => callNow(l.id)}>
                          <Icon name="phone" className="h-3.5 w-3.5" /> Call
                        </Button>
                      )}
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
