import { useEffect, useMemo, useState } from 'react'
import { Button, Card, Empty, Icon, PageHeader, PainBadge, Select } from '../components/ui'
import { OutcomeBar } from '../components/OutcomeBar'
import { useCall } from '../components/CallBar'
import { EmailPulse, LeadHeader, LeadTimeline } from '../components/LeadPanel'
import { DIALABLE, OUTCOME_LABEL, PAIN_LABEL } from '../lib/constants'
import { ago, prettyPhone } from '../lib/format'
import type { Lead } from '../lib/types'
import { useData } from '../lib/store'

const COOLDOWN_MS = 2 * 3600e3 // don't redial the same number within 2 hours

export function Dial({ focusId, clearFocus }: { focusId: string; clearFocus(): void }) {
  const { me, data, leadById } = useData()
  const { call } = useCall()
  const [queue, setQueue] = useState('dialable')
  const [pain, setPain] = useState('all')
  const [who, setWho] = useState('mine')
  const [skipped, setSkipped] = useState<Set<string>>(new Set())
  const [session, setSession] = useState(0)
  const [currentId, setCurrentId] = useState<string>('')

  const dueIds = useMemo(() => {
    const now = new Date().toISOString()
    return new Map(
      data.tasks
        .filter((c) => c.lead_id && c.kind === 'callback' && !c.done_at && c.due_at <= now && (who === 'all' || c.owner === me.name))
        .map((c) => [c.lead_id as string, c.due_at]),
    )
  }, [data.tasks, who, me.name])

  const list = useMemo(() => {
    const now = Date.now()
    const ok = (l: Lead) => {
      if (skipped.has(l.id) || !l.phone) return false
      if (pain !== 'all' && l.pain !== pain) return false
      if (who === 'mine' && l.owner && l.owner !== me.name) return false
      if (queue === 'due') return dueIds.has(l.id)
      if (dueIds.has(l.id)) return true // due callbacks always ride at the top
      if (queue === 'dialable' && !DIALABLE.includes(l.status)) return false
      if (queue !== 'dialable' && l.status !== queue) return false
      if (l.status === 'callback') return false // future callbacks wait for their time
      if (l.last_called_at && now - new Date(l.last_called_at).getTime() < COOLDOWN_MS) return false
      return true
    }
    return data.leads.filter(ok).sort((a, b) => {
      const da = dueIds.get(a.id)
      const db = dueIds.get(b.id)
      if (da || db) return da && db ? da.localeCompare(db) : da ? -1 : 1
      if (a.attempts !== b.attempts) return a.attempts - b.attempts
      return (a.last_called_at || '').localeCompare(b.last_called_at || '')
    })
  }, [data.leads, queue, pain, who, me.name, skipped, dueIds])

  // Focus a lead sent from Today/Callbacks, otherwise keep the current one until an outcome is logged.
  useEffect(() => {
    if (focusId && leadById.has(focusId)) {
      setCurrentId(focusId)
      clearFocus()
    }
  }, [focusId, leadById, clearFocus])
  useEffect(() => {
    if (!currentId && list.length) setCurrentId(list[0].id)
  }, [currentId, list])

  const current = currentId ? leadById.get(currentId) : undefined
  const next = list.filter((l) => l.id !== currentId).slice(0, 6)

  function advance() {
    setSession((n) => n + 1)
    const n = list.find((l) => l.id !== currentId)
    setCurrentId(n ? n.id : '')
  }
  function skip() {
    if (!current) return
    setSkipped((s) => new Set(s).add(current.id))
    setCurrentId('')
  }

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName) || document.querySelector('[role=dialog]')) return
      if (e.key === 's' || e.key === 'ArrowRight') skip()
      if (e.key === 'c' && current) call(current)
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  })

  return (
    <div>
      <PageHeader
        title="Dial"
        sub={`${list.length} in queue · ${session} logged this session${dueIds.size ? ` · ${dueIds.size} callback${dueIds.size === 1 ? '' : 's'} due` : ''}`}
        actions={
          <>
            <Select
              value={queue}
              onChange={(v) => (setQueue(v), setCurrentId(''))}
              options={[
                ['dialable', 'All dialable'],
                ['due', 'Callbacks due'],
                ['new', 'New only'],
                ['attempting', 'Attempting only'],
              ]}
            />
            <Select value={pain} onChange={(v) => (setPain(v), setCurrentId(''))} options={[['all', 'Any pain'], ...(Object.entries(PAIN_LABEL) as [string, string][])]} />
            <Select
              value={who}
              onChange={(v) => (setWho(v), setCurrentId(''))}
              options={[
                ['mine', `Mine + unassigned`],
                ['all', 'Everyone'],
              ]}
            />
          </>
        }
      />

      {!current ? (
        <Card>
          <Empty
            title="Queue is empty"
            sub="Nothing left that matches these filters. Numbers dialed in the last 2 hours sit out, and future callbacks wait for their time."
            action={skipped.size ? <Button onClick={() => setSkipped(new Set())}>Bring back {skipped.size} skipped</Button> : undefined}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
          <div className="space-y-5 xl:col-span-2">
            <Card className="p-5">
              {dueIds.has(current.id) && (
                <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-sand-50 px-2.5 py-1 text-xs font-semibold text-sand-700 ring-1 ring-inset ring-sand-400/40">
                  <Icon name="bell" className="h-3.5 w-3.5" /> Callback due
                </div>
              )}
              <LeadHeader lead={current} big />
              <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-xs text-ink-500">
                <span>
                  {current.attempts} attempt{current.attempts === 1 ? '' : 's'}
                </span>
                <span>Last touch {ago(current.last_called_at)}</span>
                {current.last_outcome && <span>Last result: {OUTCOME_LABEL[current.last_outcome]}</span>}
              </div>
              <div className="mt-2">
                <EmailPulse lead={current} />
              </div>
              <div className="mt-5 border-t border-line pt-5">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-medium uppercase tracking-wide text-ink-400">How did it go?</span>
                  <button onClick={skip} className="inline-flex items-center gap-1 text-xs text-ink-500 hover:text-ink-900">
                    Skip <Icon name="skip" className="h-3.5 w-3.5" />
                  </button>
                </div>
                <OutcomeBar lead={current} onLogged={advance} hotkeys />
                <p className="mt-3 hidden text-xs text-ink-400 sm:block">Keys: C call · 1–8 outcome · S skip</p>
              </div>
            </Card>
            <Card className="p-5">
              <h3 className="mb-3 text-sm font-semibold text-ink-900">Timeline</h3>
              <LeadTimeline lead={current} />
            </Card>
          </div>
          <Card className="h-fit">
            <div className="border-b border-line px-4 py-3 text-sm font-semibold text-ink-900">Up next</div>
            {next.length === 0 && <div className="px-4 py-6 text-sm text-ink-400">Nothing after this one.</div>}
            <ul>
              {next.map((l) => (
                <li key={l.id}>
                  <button onClick={() => setCurrentId(l.id)} className="flex w-full items-center gap-3 border-t border-line px-4 py-2.5 text-left first:border-t-0 hover:bg-wash">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-ink-900">{l.company}</div>
                      <div className="truncate text-xs text-ink-500">
                        {prettyPhone(l.phone)} · {l.city || '—'}
                      </div>
                    </div>
                    {dueIds.has(l.id) ? <Icon name="bell" className="h-4 w-4 text-sand-600" /> : <PainBadge pain={l.pain} />}
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}
    </div>
  )
}
