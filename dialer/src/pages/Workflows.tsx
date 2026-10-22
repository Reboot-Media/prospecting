import { useEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from 'react'
import { Badge, Button, Card, CardHead, Empty, Field, Icon, Modal, PageHeader, SearchInput, Select, StatStrip, Tabs, Td, Th, inputCls, type IconName } from '../components/ui'
import { FORM_LABEL, MEETING_LABEL, OUTCOMES, PAIN_LABEL, SEGMENT_LABEL, STAGE_LABEL, STAGES, STATUS_LABEL } from '../lib/constants'
import {
  COND_FIELDS,
  STEP_TYPES,
  TRIGGERS,
  WAIT_EVENT_LABEL,
  countSteps,
  describeCondition,
  describeStep,
  findStep,
  insertAt,
  mapSteps,
  moveStep,
  newStep,
  removeStep,
  triggerLabel,
  type Condition,
  type FlowRun,
  type Slot,
  type Step,
  type StepType,
  type TriggerType,
  type Workflow,
} from '../lib/flow'
import { ago, fullName, uid, when } from '../lib/format'
import { recipes } from '../lib/recipes'
import { useData } from '../lib/store'
import type { Tone } from '../lib/constants'

const STATUS_TONE_WF: Record<Workflow['status'], Tone> = { active: 'sage', draft: 'stone', paused: 'sand' }
const STATUS_LABEL_WF: Record<Workflow['status'], string> = { active: 'On', draft: 'Draft', paused: 'Paused' }
const RUN_TONE: Record<FlowRun['status'], Tone> = { active: 'violet', waiting: 'mist', done: 'sage', stopped: 'stone', failed: 'clay' }
const RUN_LABEL: Record<FlowRun['status'], string> = { active: 'Running', waiting: 'Waiting', done: 'Finished', stopped: 'Stopped', failed: 'Failed' }

const STEP_ICON: Record<StepType, IconName> = {
  email: 'mail',
  text: 'message',
  task: 'task',
  notify: 'bell',
  tag: 'tag',
  field: 'sliders',
  sequence: 'flow',
  webhook: 'link',
  wait: 'clock',
  wait_for: 'reply',
  branch: 'split',
  end: 'stop',
}
const GROUP_TONE: Record<string, string> = {
  Send: 'bg-accent-50 text-accent-700',
  Do: 'bg-sage-50 text-sage-700',
  Wait: 'bg-sand-50 text-sand-700',
  Logic: 'bg-mist-50 text-mist-700',
}
const groupOf = (t: StepType) => STEP_TYPES.find((x) => x.type === t)!.group
const labelOf = (t: StepType) => STEP_TYPES.find((x) => x.type === t)!.label

/* ================================================================ list === */

export function Workflows({ open }: { open(id: string): void }) {
  const { data, save, me } = useData()
  const [picker, setPicker] = useState(false)
  const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString()

  const stats = useMemo(() => {
    const m = new Map<string, { live: number; done: number; last: string }>()
    for (const r of data.flow_runs) {
      const s = m.get(r.workflow_id) || { live: 0, done: 0, last: '' }
      if (r.status === 'active' || r.status === 'waiting') s.live++
      if (r.status === 'done') s.done++
      if (r.created_at > s.last) s.last = r.created_at
      m.set(r.workflow_id, s)
    }
    return m
  }, [data.flow_runs])

  const create = async (draft?: ReturnType<typeof recipes>[number]) => {
    const t = new Date().toISOString()
    const wf: Workflow = {
      id: uid(),
      name: draft?.name || 'New workflow',
      description: draft?.description || '',
      status: 'draft',
      trigger: draft?.trigger || { type: 'call_outcome', value: '', conditions: [] },
      steps: draft?.steps || [],
      reentry: draft?.reentry ?? false,
      stop_on_reply: draft?.stop_on_reply ?? true,
      created_by: me.name,
      created_at: t,
      updated_at: t,
    }
    await save('workflows', wf)
    setPicker(false)
    open(wf.id)
  }

  const live = data.flow_runs.filter((r) => r.status === 'active' || r.status === 'waiting').length
  const fromFlows = data.tasks.filter((t) => !t.done_at && t.created_by.startsWith('Workflow')).length
  const drafts = data.emails.filter((e) => e.status === 'draft' && e.created_by.startsWith('Workflow')).length

  return (
    <div>
      <PageHeader
        title="Workflows"
        sub="When something happens, do the next thing automatically. Build them by dragging steps."
        actions={
          <Button variant="primary" onClick={() => setPicker(true)}>
            <Icon name="plus" /> New workflow
          </Button>
        }
      />
      <div className="mb-5">
        <StatStrip
          items={[
            { label: 'Workflows on', icon: 'bolt', value: data.workflows.filter((w) => w.status === 'active').length, sub: `${data.workflows.length} total` },
            { label: 'Contacts in a workflow', icon: 'users', value: live, sub: 'running or waiting' },
            { label: 'Finished this week', icon: 'check', value: data.flow_runs.filter((r) => r.status === 'done' && r.updated_at >= weekAgo).length, sub: 'reached the end' },
            { label: 'Waiting on you', icon: 'task', value: fromFlows + drafts, sub: `${fromFlows} tasks · ${drafts} emails to approve` },
          ]}
        />
      </div>

      <Card>
        <CardHead title="Your workflows" sub="Switch one on and it starts with the next contact that matches." />
        {data.workflows.length === 0 ? (
          <Empty title="No workflows yet" sub="Start from one of the recipes below." />
        ) : (
          <>
            <ul className="divide-y divide-line border-t border-line sm:hidden">
              {data.workflows.map((w) => {
                const s = stats.get(w.id)
                return (
                  <li key={w.id}>
                    <button onClick={() => open(w.id)} className="w-full px-4 py-3 text-left">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate font-medium text-ink-900">{w.name}</span>
                        <Badge tone={STATUS_TONE_WF[w.status]}>{STATUS_LABEL_WF[w.status]}</Badge>
                      </div>
                      <div className="mt-0.5 text-xs text-ink-500">
                        {triggerLabel(w.trigger.type)} · {countSteps(w.steps)} steps · {s?.live || 0} in it now
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-y border-line">
                    <Th>Workflow</Th>
                    <Th>When</Th>
                    <Th className="text-right">Steps</Th>
                    <Th className="text-right">In it now</Th>
                    <Th className="text-right">Finished</Th>
                    <Th>Last started</Th>
                    <Th>Status</Th>
                  </tr>
                </thead>
                <tbody>
                  {data.workflows
                    .slice()
                    .sort((a, b) => (a.status === b.status ? a.name.localeCompare(b.name) : a.status === 'active' ? -1 : b.status === 'active' ? 1 : 0))
                    .map((w) => {
                      const s = stats.get(w.id)
                      return (
                        <tr key={w.id} onClick={() => open(w.id)} className="cursor-pointer border-b border-line last:border-0 hover:bg-wash/60">
                          <Td>
                            <div className="font-medium text-ink-900">{w.name}</div>
                            <div className="max-w-md truncate text-xs text-ink-400">{w.description}</div>
                          </Td>
                          <Td className="text-ink-700">
                            {triggerLabel(w.trigger.type)}
                            {w.trigger.value && <span className="text-ink-400"> · {valueLabel(w.trigger.type, w.trigger.value)}</span>}
                          </Td>
                          <Td className="tabular text-right">{countSteps(w.steps)}</Td>
                          <Td className="tabular text-right">{s?.live || 0}</Td>
                          <Td className="tabular text-right">{s?.done || 0}</Td>
                          <Td className="text-ink-500">{s?.last ? ago(s.last) : '–'}</Td>
                          <Td>
                            <Badge tone={STATUS_TONE_WF[w.status]}>{STATUS_LABEL_WF[w.status]}</Badge>
                          </Td>
                        </tr>
                      )
                    })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>

      <h2 className="mb-3 mt-8 text-sm font-semibold text-ink-900">Recipes for how you sell</h2>
      <RecipeGrid pick={create} />

      <Modal open={picker} onClose={() => setPicker(false)} title="New workflow" wide>
        <button onClick={() => create()} className="mb-4 flex w-full items-center gap-3 rounded-xl border border-dashed border-line p-4 text-left hover:bg-wash">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-wash text-ink-700">
            <Icon name="plus" />
          </span>
          <span>
            <span className="block text-sm font-semibold text-ink-900">Start from scratch</span>
            <span className="block text-xs text-ink-500">Pick a trigger and drag in steps.</span>
          </span>
        </button>
        <RecipeGrid pick={create} compact />
      </Modal>
    </div>
  )
}

function RecipeGrid({ pick, compact }: { pick(r: ReturnType<typeof recipes>[number]): void; compact?: boolean }) {
  const list = useMemo(() => recipes(uid), [])
  return (
    <div className={`grid gap-3 ${compact ? 'sm:grid-cols-2' : 'sm:grid-cols-2 xl:grid-cols-3'}`}>
      {list.map((r) => (
        <button key={r.name} onClick={() => pick(r)} className="flex flex-col rounded-xl bg-white p-4 text-left shadow-card ring-1 ring-transparent transition hover:ring-accent-400/40">
          <span className="flex items-center gap-2 text-xs font-medium text-ink-500">
            <Icon name="bolt" className="h-3.5 w-3.5 text-accent-600" />
            {triggerLabel(r.trigger.type)}
            {r.trigger.value && ` · ${valueLabel(r.trigger.type, r.trigger.value)}`}
          </span>
          <span className="mt-1.5 text-sm font-semibold text-ink-900">{r.name}</span>
          <span className="mt-1 text-xs leading-relaxed text-ink-500">{r.description}</span>
          <span className="mt-3 text-xs text-ink-400">{countSteps(r.steps)} steps · opens as a draft</span>
        </button>
      ))}
    </div>
  )
}

/* ============================================================= builder === */

type Drag = { kind: 'new'; type: StepType } | { kind: 'move'; id: string } | null

export function WorkflowBuilder({ id, back, openContact }: { id: string; back(): void; openContact(id: string): void }) {
  const { data, save, remove } = useData()
  const saved = data.workflows.find((w) => w.id === id)
  const [draft, setDraft] = useState<Workflow | null>(saved || null)
  const [key, setKey] = useState(id)
  const [sel, setSel] = useState<string | null>(null)
  const [tab, setTab] = useState<'build' | 'history'>('build')
  const [drag, setDrag] = useState<Drag>(null)
  const [adding, setAdding] = useState<Slot | null>(null)
  const [zoom, setZoom] = useState(1)
  const [saving, setSaving] = useState(false)
  const canvas = useRef<HTMLDivElement>(null)
  // Open with the trigger in view: wide branches would otherwise start scrolled left.
  useEffect(() => {
    const el = canvas.current
    if (el) el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2
  }, [id, tab])
  if (saved && (key !== id || !draft)) {
    setKey(id)
    setDraft(saved)
  }
  if (!saved || !draft) return <Empty title="Workflow not found" action={<Button onClick={back}>Back to workflows</Button>} />

  const dirty = JSON.stringify(draft) !== JSON.stringify(saved)
  const runs = data.flow_runs.filter((r) => r.workflow_id === id)
  const atStep = new Map<string, number>()
  for (const r of runs) if ((r.status === 'waiting' || r.status === 'active') && r.cursor) atStep.set(r.cursor, (atStep.get(r.cursor) || 0) + 1)

  const set = (p: Partial<Workflow>) => setDraft({ ...draft, ...p })
  const setSteps = (steps: Step[]) => set({ steps })
  const persist = async (p: Partial<Workflow> = {}) => {
    setSaving(true)
    const next = { ...draft, ...p, updated_at: new Date().toISOString() }
    setDraft(next)
    await save('workflows', next)
    setSaving(false)
  }

  const place = (slot: Slot, d: Drag) => {
    if (!d) return
    if (d.kind === 'new') {
      const s = newStep(d.type, uid())
      setSteps(insertAt(draft.steps, slot, s))
      setSel(s.id)
    } else setSteps(moveStep(draft.steps, d.id, slot))
    setDrag(null)
  }

  const selected = sel && sel !== 'trigger' ? findStep(draft.steps, sel) : null
  const problems = check(draft)

  const editor = sel === 'trigger' ? (
    <TriggerEditor wf={draft} set={set} />
  ) : selected ? (
    <StepEditor
      key={selected.id}
      step={selected}
      change={(s) => setSteps(mapSteps(draft.steps, (x) => (x.id === s.id ? s : x)))}
      del={() => {
        setSteps(removeStep(draft.steps, selected.id))
        setSel(null)
      }}
    />
  ) : (
    <WorkflowSettings wf={draft} set={set} runs={runs} />
  )

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button onClick={back} className="rounded-md p-1.5 text-ink-500 hover:bg-wash" aria-label="Back to workflows">
          <Icon name="left" />
        </button>
        <input value={draft.name} onChange={(e) => set({ name: e.target.value })} aria-label="Workflow name" className="order-first min-w-0 basis-full rounded-md sm:order-none sm:basis-auto sm:flex-1 border border-transparent bg-transparent px-1.5 py-1 text-lg font-semibold tracking-tight text-ink-900 hover:border-line focus:border-ink-300 focus:outline-none sm:text-xl" />
        <Badge tone={STATUS_TONE_WF[draft.status]}>{STATUS_LABEL_WF[draft.status]}</Badge>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" disabled={!dirty || saving} onClick={() => persist()}>
            {saving ? 'Saving…' : dirty ? 'Save' : 'Saved'}
          </Button>
          {draft.status === 'active' ? (
            <Button size="sm" onClick={() => persist({ status: 'paused' })}>
              <Icon name="pause" className="h-3.5 w-3.5" /> Pause
            </Button>
          ) : (
            <Button size="sm" variant="primary" disabled={problems.length > 0} title={problems[0]} onClick={() => persist({ status: 'active' })}>
              <Icon name="play" className="h-3.5 w-3.5" /> Turn on
            </Button>
          )}
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <Tabs
          value={tab}
          onChange={setTab}
          items={[
            { key: 'build', label: 'Builder' },
            { key: 'history', label: 'Contacts', count: runs.length },
          ]}
        />
        {problems.length > 0 && draft.status !== 'active' && (
          <span className="flex items-center gap-1.5 text-xs text-sand-700">
            <Icon name="alert" className="h-3.5 w-3.5" /> {problems[0]}
          </span>
        )}
      </div>

      {tab === 'history' ? (
        <RunHistory wf={draft} runs={runs} openContact={openContact} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[200px_minmax(0,1fr)_300px]">
          {/* palette */}
          <aside className="hidden lg:block">
            <div className="sticky top-16 space-y-4">
              {(['Send', 'Do', 'Wait', 'Logic'] as const).map((g) => (
                <div key={g}>
                  <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-400">{g}</div>
                  <div className="space-y-1">
                    {STEP_TYPES.filter((t) => t.group === g).map((t) => (
                      <div
                        key={t.type}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData('text/plain', t.type)
                          e.dataTransfer.effectAllowed = 'copy'
                          setDrag({ kind: 'new', type: t.type })
                        }}
                        onDragEnd={() => setDrag(null)}
                        title={t.hint}
                        className="flex cursor-grab items-center gap-2 rounded-lg bg-white px-2 py-1.5 text-xs font-medium text-ink-700 shadow-card ring-1 ring-line/60 hover:ring-ink-300 active:cursor-grabbing"
                      >
                        <span className={`grid h-6 w-6 place-items-center rounded-md ${GROUP_TONE[g]}`}>
                          <Icon name={STEP_ICON[t.type]} className="h-3.5 w-3.5" />
                        </span>
                        {t.label}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              <p className="text-[11px] leading-relaxed text-ink-400">Drag a step onto a + in the flow, or click a + to pick one. Drag a step's handle to move it.</p>
            </div>
          </aside>

          {/* canvas */}
          <div className="relative min-w-0 overflow-hidden rounded-xl bg-wash ring-1 ring-inset ring-line">
            <div className="absolute right-2 top-2 z-10 flex items-center gap-1 rounded-lg bg-white p-0.5 shadow-card">
              <button className="rounded-md px-2 py-1 text-xs text-ink-700 hover:bg-wash" onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.1).toFixed(1)))} aria-label="Zoom out">
                −
              </button>
              <span className="tabular w-9 text-center text-[11px] text-ink-500">{Math.round(zoom * 100)}%</span>
              <button className="rounded-md px-2 py-1 text-xs text-ink-700 hover:bg-wash" onClick={() => setZoom((z) => Math.min(1.3, +(z + 0.1).toFixed(1)))} aria-label="Zoom in">
                +
              </button>
            </div>
            <div ref={canvas} className="max-h-[calc(100vh-14rem)] min-h-[520px] overflow-auto bg-[radial-gradient(circle,rgba(0,0,0,0.09)_1px,transparent_1px)] [background-size:18px_18px]" onClick={() => setSel(null)}>
              <div className="mx-auto w-max px-6 pb-16 pt-10" style={{ zoom }}>
                <div className="flex flex-col items-center">
                  <TriggerCard wf={draft} selected={sel === 'trigger'} onClick={() => setSel('trigger')} />
                  <Lane steps={draft.steps} parent={null} arm={null} ctx={{ sel, setSel, drag, setDrag, place, add: setAdding, atStep, del: (sid) => setSteps(removeStep(draft.steps, sid)) }} />
                  <div className="mt-1 rounded-full bg-white px-3 py-1 text-[11px] font-medium text-ink-400 shadow-card">End</div>
                </div>
              </div>
            </div>
          </div>

          {/* editor */}
          <aside className="hidden lg:block">
            <div className="sticky top-16 max-h-[calc(100vh-5rem)] overflow-y-auto rounded-xl bg-white p-4 shadow-card">{editor}</div>
          </aside>
        </div>
      )}

      {/* small screens: editor in a sheet */}
      <div className="lg:hidden">
        <Modal open={tab === 'build' && !!sel} onClose={() => setSel(null)} title={sel === 'trigger' ? 'Trigger' : selected ? labelOf(selected.type) : 'Step'}>
          {editor}
        </Modal>
      </div>

      <Modal open={!!adding} onClose={() => setAdding(null)} title="Add a step" wide>
        <div className="grid gap-2 sm:grid-cols-2">
          {STEP_TYPES.map((t) => (
            <button
              key={t.type}
              onClick={() => {
                if (adding) place(adding, { kind: 'new', type: t.type })
                setAdding(null)
              }}
              className="flex items-start gap-3 rounded-xl p-3 text-left ring-1 ring-inset ring-line hover:bg-wash"
            >
              <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${GROUP_TONE[t.group]}`}>
                <Icon name={STEP_ICON[t.type]} />
              </span>
              <span>
                <span className="block text-sm font-medium text-ink-900">{t.label}</span>
                <span className="block text-xs text-ink-500">{t.hint}</span>
              </span>
            </button>
          ))}
        </div>
      </Modal>

      <div className="mt-6 flex justify-end">
        <button
          className="text-xs text-clay-700 underline"
          onClick={async () => {
            if (!confirm(`Delete "${draft.name}"? Contacts in it stop where they are.`)) return
            await remove('workflows', draft.id)
            back()
          }}
        >
          Delete workflow
        </button>
      </div>
    </div>
  )
}

// What blocks turning a workflow on.
function check(wf: Workflow): string[] {
  const out: string[] = []
  if (!wf.steps.length) out.push('Add at least one step')
  const walk = (steps: Step[]) => {
    for (const s of steps) {
      if (s.type === 'email' && (!s.subject.trim() || !s.body.trim())) out.push('An email step needs a subject and body')
      if (s.type === 'tag' && !s.tag.trim()) out.push('A tag step needs a tag')
      if (s.type === 'field' && !s.value) out.push('An update step needs a value')
      if (s.type === 'webhook' && !/^https:\/\//.test(s.url)) out.push('A URL step needs an https address')
      if (s.type === 'branch' && !s.conditions.length) out.push('An if / else needs a condition')
      if (s.type === 'branch' || s.type === 'wait_for') {
        walk(s.yes)
        walk(s.no)
      }
    }
  }
  walk(wf.steps)
  if (['tag_added', 'tag_removed'].includes(wf.trigger.type) && !wf.trigger.value) out.push('Pick the tag that starts it')
  return out
}

interface LaneCtx {
  sel: string | null
  setSel(id: string): void
  drag: Drag
  setDrag(d: Drag): void
  place(slot: Slot, d: Drag): void
  add(slot: Slot): void
  atStep: Map<string, number>
  del(id: string): void
}

function Lane({ steps, parent, arm, ctx }: { steps: Step[]; parent: string | null; arm: 'yes' | 'no' | null; ctx: LaneCtx }) {
  return (
    <div className="flex flex-col items-center">
      {steps.map((s, i) => (
        <div key={s.id} className="flex flex-col items-center">
          <Slot slot={{ parent, arm, index: i }} ctx={ctx} />
          <StepCard step={s} ctx={ctx} />
          {(s.type === 'branch' || s.type === 'wait_for') && <Split step={s} ctx={ctx} />}
        </div>
      ))}
      <Slot slot={{ parent, arm, index: steps.length }} ctx={ctx} last />
    </div>
  )
}

function Slot({ slot, ctx, last }: { slot: Slot; ctx: LaneCtx; last?: boolean }) {
  const [over, setOver] = useState(false)
  const active = !!ctx.drag
  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setOver(false)
    ctx.place(slot, ctx.drag)
  }
  return (
    <div
      className="flex flex-col items-center"
      onDragOver={(e) => {
        if (!ctx.drag) return
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
    >
      <div className="h-3 w-px bg-ink-300" />
      {active ? (
        <div className={`my-0.5 grid h-9 w-52 place-items-center rounded-lg border-2 border-dashed text-[11px] font-medium transition ${over ? 'border-accent-600 bg-accent-50 text-accent-700' : 'border-ink-300/70 text-ink-400'}`}>Drop here</div>
      ) : (
        <button
          onClick={(e) => {
            e.stopPropagation()
            ctx.add(slot)
          }}
          aria-label="Add a step here"
          className="grid h-6 w-6 place-items-center rounded-full bg-white text-ink-400 shadow-card ring-1 ring-line transition hover:bg-ink-900 hover:text-white"
        >
          <Icon name="plus" className="h-3.5 w-3.5" />
        </button>
      )}
      {!last && <div className="h-3 w-px bg-ink-300" />}
    </div>
  )
}

function TriggerCard({ wf, selected, onClick }: { wf: Workflow; selected: boolean; onClick(): void }) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      className={`w-64 rounded-xl bg-ink-900 p-3 text-left text-white shadow-panel ring-2 transition ${selected ? 'ring-accent-400' : 'ring-transparent hover:ring-white/30'}`}
    >
      <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-white/50">
        <Icon name="bolt" className="h-3.5 w-3.5 text-sand-400" /> When this happens
      </div>
      <div className="mt-1 text-sm font-semibold">
        {triggerLabel(wf.trigger.type)}
        {wf.trigger.value && <span className="font-normal text-white/70"> · {valueLabel(wf.trigger.type, wf.trigger.value)}</span>}
      </div>
      {wf.trigger.conditions.length > 0 && <div className="mt-1 text-xs text-white/60">Only if {wf.trigger.conditions.map(describeCondition).join(' and ')}</div>}
    </button>
  )
}

function StepCard({ step, ctx }: { step: Step; ctx: LaneCtx }) {
  const g = groupOf(step.type)
  const n = ctx.atStep.get(step.id) || 0
  const selected = ctx.sel === step.id
  return (
    <div
      onClick={(e) => {
        e.stopPropagation()
        ctx.setSel(step.id)
      }}
      className={`group relative w-64 cursor-pointer rounded-xl bg-white p-3 shadow-card ring-2 transition ${selected ? 'ring-accent-600' : 'ring-transparent hover:ring-ink-300/60'} ${ctx.drag?.kind === 'move' && ctx.drag.id === step.id ? 'opacity-40' : ''}`}
    >
      <div className="flex items-start gap-2.5">
        <span
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData('text/plain', step.id)
            e.dataTransfer.effectAllowed = 'move'
            ctx.setDrag({ kind: 'move', id: step.id })
          }}
          onDragEnd={() => ctx.setDrag(null)}
          title="Drag to move"
          className={`grid h-8 w-8 shrink-0 cursor-grab place-items-center rounded-lg active:cursor-grabbing ${GROUP_TONE[g]}`}
        >
          <Icon name={STEP_ICON[step.type]} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-medium uppercase tracking-wide text-ink-400">{labelOf(step.type)}</div>
          <div className="mt-0.5 line-clamp-2 text-sm text-ink-900">{describeStep(step)}</div>
        </div>
      </div>
      {n > 0 && (
        <div className="mt-2 inline-flex items-center gap-1 rounded-md bg-mist-50 px-1.5 py-0.5 text-[11px] font-medium text-mist-700">
          <Icon name="users" className="h-3 w-3" /> {n} here now
        </div>
      )}
      <button
        onClick={(e) => {
          e.stopPropagation()
          ctx.del(step.id)
        }}
        aria-label="Delete step"
        className="absolute right-1.5 top-1.5 rounded-md p-1 text-ink-300 opacity-0 transition hover:bg-clay-50 hover:text-clay-700 group-hover:opacity-100"
      >
        <Icon name="trash" className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

function Split({ step, ctx }: { step: Extract<Step, { type: 'branch' | 'wait_for' }>; ctx: LaneCtx }) {
  const labels = step.type === 'branch' ? ['Yes', 'No'] : [`Got ${WAIT_EVENT_LABEL[step.event]}`, 'Timed out']
  return (
    <div className="flex flex-col items-center">
      <div className="h-3 w-px bg-ink-300" />
      <div className="relative flex gap-6">
        {/* the bar joining the two arms */}
        <div className="absolute left-[25%] right-[25%] top-0 h-px bg-ink-300" />
        {(['yes', 'no'] as const).map((arm, i) => (
          <div key={arm} className="flex min-w-[16rem] flex-1 flex-col items-center">
            <div className="h-3 w-px bg-ink-300" />
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${arm === 'yes' ? 'bg-sage-50 text-sage-700' : 'bg-clay-50 text-clay-700'}`}>{labels[i]}</span>
            <Lane steps={step[arm]} parent={step.id} arm={arm} ctx={ctx} />
          </div>
        ))}
      </div>
      <div className="h-3 w-px bg-ink-300" />
    </div>
  )
}

/* ============================================================= editors === */

function valueOptions(t: TriggerType): [string, string][] | 'text' | null {
  switch (t) {
    case 'call_outcome':
      return [['', 'Any outcome'], ...OUTCOMES.map((o) => [o.key, o.label] as [string, string])]
    case 'stage_changed':
      return [['', 'Any stage'], ...STAGES.map((s) => [s, STAGE_LABEL[s]] as [string, string])]
    case 'meeting_status':
      return [['', 'Any change'], ...(['confirmed', 'showed', 'no_show', 'canceled'] as const).map((s) => [s, MEETING_LABEL[s]] as [string, string])]
    case 'form_submitted':
      return [['', 'Any form'], ...Object.entries(FORM_LABEL)]
    case 'tag_added':
    case 'tag_removed':
      return 'text'
    default:
      return null
  }
}

function valueLabel(t: TriggerType, v: string) {
  const o = valueOptions(t)
  if (Array.isArray(o)) return o.find((x) => x[0] === v)?.[1] || v
  return v
}

function TriggerEditor({ wf, set }: { wf: Workflow; set(p: Partial<Workflow>): void }) {
  const opts = valueOptions(wf.trigger.type)
  const t = TRIGGERS.find((x) => x.type === wf.trigger.type)
  const setT = (p: Partial<Workflow['trigger']>) => set({ trigger: { ...wf.trigger, ...p } })
  return (
    <div className="space-y-4">
      <Field label="When this happens" hint={t?.hint}>
        <Select value={wf.trigger.type} onChange={(v) => setT({ type: v as TriggerType, value: '' })} options={TRIGGERS.map((x) => [x.type, x.label])} />
      </Field>
      {opts === 'text' ? (
        <Field label="Tag">
          <input className={inputCls} value={wf.trigger.value} onChange={(e) => setT({ value: e.target.value.trim() })} placeholder="e.g. hot" />
        </Field>
      ) : (
        opts && (
          <Field label={t?.valueLabel || 'Which one'}>
            <Select value={wf.trigger.value} onChange={(v) => setT({ value: v })} options={opts} />
          </Field>
        )
      )}
      <div>
        <div className="mb-1 text-xs font-medium text-ink-700">Only for contacts where</div>
        <Conditions list={wf.trigger.conditions} change={(conditions) => setT({ conditions })} empty="Everyone" />
      </div>
    </div>
  )
}

function WorkflowSettings({ wf, set, runs }: { wf: Workflow; set(p: Partial<Workflow>): void; runs: FlowRun[] }) {
  const live = runs.filter((r) => r.status === 'active' || r.status === 'waiting').length
  return (
    <div className="space-y-4">
      <div>
        <div className="text-sm font-semibold text-ink-900">Workflow settings</div>
        <div className="text-xs text-ink-500">Click the trigger or any step to edit it.</div>
      </div>
      <Field label="What it is for">
        <textarea className={`${inputCls} min-h-[70px]`} value={wf.description} onChange={(e) => set({ description: e.target.value })} />
      </Field>
      <label className="flex items-start gap-2 text-sm text-ink-700">
        <input type="checkbox" className="mt-1" checked={wf.reentry} onChange={(e) => set({ reentry: e.target.checked })} />
        <span>
          Let a contact go through more than once
          <span className="block text-xs text-ink-400">Off: each roofer runs it one time ever.</span>
        </span>
      </label>
      <label className="flex items-start gap-2 text-sm text-ink-700">
        <input type="checkbox" className="mt-1" checked={wf.stop_on_reply} onChange={(e) => set({ stop_on_reply: e.target.checked })} />
        <span>
          Stop when they reply to an email
          <span className="block text-xs text-ink-400">Unless the step is waiting for that reply.</span>
        </span>
      </label>
      <div className="rounded-lg bg-wash p-3 text-xs text-ink-700">
        <div className="flex justify-between">
          <span>In it now</span>
          <span className="tabular font-medium">{live}</span>
        </div>
        <div className="mt-1 flex justify-between">
          <span>Finished</span>
          <span className="tabular font-medium">{runs.filter((r) => r.status === 'done').length}</span>
        </div>
        <div className="mt-1 flex justify-between">
          <span>Steps</span>
          <span className="tabular font-medium">{countSteps(wf.steps)}</span>
        </div>
      </div>
      <p className="text-xs leading-relaxed text-ink-400">
        Emails go out through Resend from your address with Ali on CC, inside the weekday 8–11 AM window and the daily cap. They wait in Approvals unless the step says send on its own. Merge fields: {'{first} {company} {city} {owner} {booking_link}'}.
      </p>
    </div>
  )
}

function StepEditor({ step, change, del }: { step: Step; change(s: Step): void; del(): void }) {
  const { data } = useData()
  const set = (p: Partial<Step>) => change({ ...step, ...p } as Step)
  const callers: [string, string][] = [['', "Contact's owner"], ...data.settings.callers.map((c) => [c, c] as [string, string])]
  let body: ReactNode = null
  switch (step.type) {
    case 'wait':
      body = (
        <>
          <div className="flex gap-2">
            <input type="number" min={1} className={`${inputCls} w-24`} value={step.amount} onChange={(e) => set({ amount: Math.max(1, Number(e.target.value) || 1) })} aria-label="How long" />
            <Select value={step.unit} onChange={(v) => set({ unit: v as 'days' })} options={[['minutes', 'minutes'], ['hours', 'hours'], ['days', 'days']]} />
          </div>
          <Field label="Then continue">
            <Select value={step.window} onChange={(v) => set({ window: v as 'any' })} options={[['any', 'Right away, any time'], ['business', 'In working hours (Mon–Fri 8–6 Central)'], ['email', 'In the email window (Mon–Fri 8–11 Central)']]} />
          </Field>
        </>
      )
      break
    case 'wait_for':
      body = (
        <>
          <Field label="Wait for">
            <Select value={step.event} onChange={(v) => set({ event: v as 'email_replied' })} options={Object.entries(WAIT_EVENT_LABEL).map(([k, v]) => [k, v.replace(/^an? /, '')])} />
          </Field>
          <Field label="Give up after (days)">
            <input type="number" min={1} className={inputCls} value={step.days} onChange={(e) => set({ days: Math.max(1, Number(e.target.value) || 1) })} />
          </Field>
          <p className="text-xs text-ink-400">If it happens in time, they take the left path. If not, the right path.</p>
        </>
      )
      break
    case 'email':
      body = (
        <>
          <Field label="Subject">
            <input className={inputCls} value={step.subject} onChange={(e) => set({ subject: e.target.value })} />
          </Field>
          <Field label="Body" hint="Short: the video, one tease, the booking link.">
            <textarea className={`${inputCls} min-h-[160px] font-mono text-xs`} value={step.body} onChange={(e) => set({ body: e.target.value })} />
          </Field>
          {data.templates.length > 0 && (
            <Field label="Start from a template">
              <Select
                value=""
                onChange={(v) => {
                  const t = data.templates.find((x) => x.id === v)
                  if (t) set({ subject: t.subject, body: t.body, branded: t.kind === 'branded' })
                }}
                options={[['', 'Pick one…'], ...data.templates.filter((t) => t.kind !== 'text').map((t) => [t.id, t.name] as [string, string])]}
              />
            </Field>
          )}
          <label className="flex items-center gap-2 text-sm text-ink-700">
            <input type="checkbox" checked={step.branded} onChange={(e) => set({ branded: e.target.checked })} /> Purple and white branded shell
          </label>
          <label className="flex items-start gap-2 text-sm text-ink-700">
            <input type="checkbox" className="mt-1" checked={step.auto_send} onChange={(e) => set({ auto_send: e.target.checked })} />
            <span>
              Send without my approval
              <span className="block text-xs text-ink-400">Off: it waits in Approvals for your OK.</span>
            </span>
          </label>
        </>
      )
      break
    case 'text':
      body = (
        <Field label="Message" hint="Until the phone carrier is connected this becomes a text task with the words ready to send.">
          <textarea className={`${inputCls} min-h-[100px]`} value={step.body} onChange={(e) => set({ body: e.target.value })} />
        </Field>
      )
      break
    case 'task':
      body = (
        <>
          <Field label="Kind">
            <Select value={step.kind} onChange={(v) => set({ kind: v as 'callback' })} options={[['callback', 'Callback'], ['follow_up', 'Follow-up'], ['todo', 'To-do']]} />
          </Field>
          <Field label="For">
            <Select value={step.owner} onChange={(v) => set({ owner: v })} options={callers} />
          </Field>
          <Field label="Due">
            <Select
              value={String(step.due_minutes)}
              onChange={(v) => set({ due_minutes: Number(v) })}
              options={[
                ['0', 'Now'],
                ['5', 'In 5 minutes'],
                ['15', 'In 15 minutes'],
                ['30', 'In 30 minutes'],
                ['60', 'In 1 hour'],
                ['240', 'In 4 hours'],
                ['1440', 'Tomorrow'],
                ['4320', 'In 3 days'],
              ]}
            />
          </Field>
          <Field label="Reason">
            <input className={inputCls} value={step.reason} onChange={(e) => set({ reason: e.target.value })} />
          </Field>
        </>
      )
      break
    case 'notify':
      body = (
        <>
          <Field label="Who">
            <Select value={step.to} onChange={(v) => set({ to: v })} options={callers} />
          </Field>
          <Field label="Message">
            <input className={inputCls} value={step.text} onChange={(e) => set({ text: e.target.value })} />
          </Field>
        </>
      )
      break
    case 'tag':
      body = (
        <>
          <Select value={step.mode} onChange={(v) => set({ mode: v as 'add' })} options={[['add', 'Add tag'], ['remove', 'Remove tag']]} />
          <Field label="Tag">
            <input className={inputCls} value={step.tag} onChange={(e) => set({ tag: e.target.value.trim() })} list="wf-tags" placeholder="e.g. hot-lead" />
            <datalist id="wf-tags">
              {[...new Set(data.leads.flatMap((l) => l.tags))].slice(0, 60).map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </Field>
        </>
      )
      break
    case 'field': {
      const opts: Record<string, [string, string][]> = {
        status: Object.entries(STATUS_LABEL),
        stage: [['none', 'Out of pipeline'], ...STAGES.map((s) => [s, STAGE_LABEL[s]] as [string, string])],
        owner: data.settings.callers.map((c) => [c, c]),
        pain: Object.entries(PAIN_LABEL),
        segment: Object.entries(SEGMENT_LABEL),
      }
      body = (
        <>
          <Field label="Field">
            <Select value={step.field} onChange={(v) => set({ field: v as 'status', value: '' })} options={[['status', 'Call status'], ['stage', 'Pipeline stage'], ['owner', 'Owner'], ['pain', 'Pain'], ['segment', 'Segment']]} />
          </Field>
          <Field label="Set to">
            <Select value={step.value} onChange={(v) => set({ value: v })} options={[['', 'Pick…'], ...opts[step.field]]} />
          </Field>
        </>
      )
      break
    }
    case 'sequence':
      body = (
        <>
          <Select value={step.mode} onChange={(v) => set({ mode: v as 'enroll' })} options={[['enroll', 'Start a sequence'], ['stop', 'Stop their sequence']]} />
          {step.mode === 'enroll' && (
            <Field label="Sequence">
              <Select value={step.sequence_id} onChange={(v) => set({ sequence_id: v })} options={[['', 'The lane for their pain'], ...data.sequences.map((s) => [s.id, s.name] as [string, string])]} />
            </Field>
          )}
        </>
      )
      break
    case 'webhook':
      body = (
        <Field label="URL" hint="We POST the contact as JSON. Live mode only.">
          <input className={inputCls} value={step.url} onChange={(e) => set({ url: e.target.value.trim() })} placeholder="https://" />
        </Field>
      )
      break
    case 'branch':
      body = (
        <>
          <Select value={step.match} onChange={(v) => set({ match: v as 'all' })} options={[['all', 'All of these are true'], ['any', 'Any of these is true']]} />
          <Conditions list={step.conditions} change={(conditions) => set({ conditions })} empty="Add a condition" />
        </>
      )
      break
    case 'end':
      body = <p className="text-sm text-ink-500">The contact leaves the workflow here.</p>
  }
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className={`grid h-7 w-7 place-items-center rounded-lg ${GROUP_TONE[groupOf(step.type)]}`}>
          <Icon name={STEP_ICON[step.type]} className="h-3.5 w-3.5" />
        </span>
        <span className="text-sm font-semibold text-ink-900">{labelOf(step.type)}</span>
      </div>
      {body}
      <div className="border-t border-line pt-3">
        <Button size="sm" variant="danger" onClick={del}>
          <Icon name="trash" className="h-3.5 w-3.5" /> Delete step
        </Button>
      </div>
    </div>
  )
}

function Conditions({ list, change, empty }: { list: Condition[]; change(l: Condition[]): void; empty: string }) {
  const { data } = useData()
  const enumOpts = (f: Condition['field']): [string, string][] => {
    if (f === 'pain') return Object.entries(PAIN_LABEL)
    if (f === 'segment') return Object.entries(SEGMENT_LABEL)
    if (f === 'status') return Object.entries(STATUS_LABEL)
    if (f === 'stage') return [['none', 'Not in pipeline'], ...STAGES.map((s) => [s, STAGE_LABEL[s]] as [string, string])]
    return []
  }
  const upd = (i: number, p: Partial<Condition>) => change(list.map((c, j) => (j === i ? { ...c, ...p } : c)))
  return (
    <div className="space-y-2">
      {list.length === 0 && <div className="text-xs text-ink-400">{empty}</div>}
      {list.map((c, i) => {
        const f = COND_FIELDS.find((x) => x.field === c.field)!
        return (
          <div key={i} className="space-y-1.5 rounded-lg bg-wash p-2">
            <div className="flex gap-1.5">
              <Select
                value={c.field}
                onChange={(v) => {
                  const nf = COND_FIELDS.find((x) => x.field === v)!
                  upd(i, { field: v as Condition['field'], op: nf.kind === 'number' ? 'gte' : 'is', value: nf.kind === 'bool' ? 'yes' : nf.kind === 'enum' ? enumOpts(nf.field)[0][0] : '' })
                }}
                options={COND_FIELDS.map((x) => [x.field, x.label])}
              />
              <button onClick={() => change(list.filter((_, j) => j !== i))} aria-label="Remove condition" className="rounded-md px-1.5 text-ink-400 hover:text-clay-700">
                <Icon name="x" className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="flex gap-1.5">
              {f.kind === 'bool' ? (
                <Select value={c.value} onChange={(v) => upd(i, { value: v })} options={[['yes', 'Yes'], ['no', 'No']]} />
              ) : f.kind === 'number' ? (
                <>
                  <Select value={c.op} onChange={(v) => upd(i, { op: v as 'gte' })} options={[['gte', 'at least'], ['lte', 'at most']]} />
                  <input type="number" className={`${inputCls} w-20`} value={c.value} onChange={(e) => upd(i, { value: e.target.value })} />
                </>
              ) : (
                <>
                  <Select value={c.op} onChange={(v) => upd(i, { op: v as 'is' })} options={f.kind === 'tag' ? [['is', 'has'], ['is_not', 'does not have']] : [['is', 'is'], ['is_not', 'is not']]} />
                  {f.kind === 'enum' ? (
                    <Select value={c.value} onChange={(v) => upd(i, { value: v })} options={enumOpts(c.field)} />
                  ) : (
                    <input
                      className={inputCls}
                      value={c.value}
                      onChange={(e) => upd(i, { value: e.target.value })}
                      list={f.kind === 'tag' ? 'wf-cond-tags' : undefined}
                      placeholder={c.field === 'owner' ? data.settings.callers.join(' or ') : ''}
                    />
                  )}
                </>
              )}
            </div>
          </div>
        )
      })}
      <datalist id="wf-cond-tags">
        {[...new Set(data.leads.flatMap((l) => l.tags))].slice(0, 60).map((t) => (
          <option key={t} value={t} />
        ))}
      </datalist>
      <Button size="sm" onClick={() => change([...list, { field: 'pain', op: 'is', value: 'never-ads' }])}>
        <Icon name="plus" className="h-3.5 w-3.5" /> Condition
      </Button>
    </div>
  )
}

/* ============================================================= history === */

function RunHistory({ wf, runs, openContact }: { wf: Workflow; runs: FlowRun[]; openContact(id: string): void }) {
  const { leadById, stopRuns, skipWait } = useData()
  const [filter, setFilter] = useState<'live' | 'all' | 'done' | 'stopped'>('live')
  const [openId, setOpenId] = useState('')
  const [adding, setAdding] = useState(false)
  const shown = runs
    .filter((r) => (filter === 'live' ? r.status === 'active' || r.status === 'waiting' : filter === 'done' ? r.status === 'done' : filter === 'stopped' ? r.status === 'stopped' || r.status === 'failed' : true))
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
  const stepName = (id: string | null) => {
    const s = id ? findStep(wf.steps, id) : null
    return s ? describeStep(s) : '–'
  }
  return (
    <Card>
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
        <Tabs
          value={filter}
          onChange={setFilter}
          items={[
            { key: 'live', label: 'In it now', count: runs.filter((r) => r.status === 'active' || r.status === 'waiting').length },
            { key: 'done', label: 'Finished', count: runs.filter((r) => r.status === 'done').length },
            { key: 'stopped', label: 'Stopped', count: runs.filter((r) => r.status === 'stopped' || r.status === 'failed').length },
            { key: 'all', label: 'All', count: runs.length },
          ]}
        />
        <Button size="sm" className="ml-auto" onClick={() => setAdding(true)} disabled={wf.status !== 'active'} title={wf.status !== 'active' ? 'Turn the workflow on first' : ''}>
          <Icon name="plus" className="h-3.5 w-3.5" /> Add contacts
        </Button>
      </div>
      {shown.length === 0 ? (
        <Empty title="Nobody here" sub={wf.status === 'active' ? 'Contacts show up as soon as the trigger fires.' : 'Turn the workflow on to start.'} />
      ) : (
        <ul className="divide-y divide-line">
          {shown.slice(0, 100).map((r) => {
            const l = leadById.get(r.lead_id)
            const isOpen = openId === r.id
            return (
              <li key={r.id} className="px-4 py-3">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <button onClick={() => setOpenId(isOpen ? '' : r.id)} className="min-w-0 flex-1 text-left">
                    <div className="truncate text-sm font-medium text-ink-900">{l?.company || 'Deleted contact'}</div>
                    <div className="truncate text-xs text-ink-500">
                      {l ? fullName(l) : ''} · started {ago(r.created_at)}
                      {r.status === 'waiting' && r.wake_at ? ` · next ${when(r.wake_at)}` : ''}
                    </div>
                  </button>
                  <div className="hidden max-w-xs truncate text-xs text-ink-500 md:block">{r.status === 'done' ? 'Reached the end' : stepName(r.cursor)}</div>
                  <Badge tone={RUN_TONE[r.status]}>{r.waiting_for ? `Waiting for ${WAIT_EVENT_LABEL[r.waiting_for as keyof typeof WAIT_EVENT_LABEL] || 'event'}` : RUN_LABEL[r.status]}</Badge>
                  {r.status === 'waiting' && (
                    <Button size="sm" variant="ghost" onClick={() => skipWait(r.id)}>
                      Skip wait
                    </Button>
                  )}
                  {(r.status === 'waiting' || r.status === 'active') && (
                    <Button size="sm" variant="ghost" onClick={() => stopRuns([r.id])}>
                      Stop
                    </Button>
                  )}
                </div>
                {isOpen && (
                  <div className="mt-2 rounded-lg bg-wash p-3">
                    <ol className="space-y-1 text-xs">
                      {r.log.map((e, i) => (
                        <li key={i} className="flex gap-3">
                          <span className="tabular w-28 shrink-0 text-ink-400">{when(e.at)}</span>
                          <span className="text-ink-700">{e.text.startsWith('Waiting until ') ? `Waiting until ${when(e.text.slice(14))}` : e.text}</span>
                        </li>
                      ))}
                    </ol>
                    {l && (
                      <button className="mt-2 text-xs text-accent-700 underline" onClick={() => openContact(l.id)}>
                        Open contact
                      </button>
                    )}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
      <AddContacts wf={wf} open={adding} close={() => setAdding(false)} />
    </Card>
  )
}

function AddContacts({ wf, open, close }: { wf: Workflow; open: boolean; close(): void }) {
  const { data, enrollWorkflow } = useData()
  const [q, setQ] = useState('')
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [done, setDone] = useState('')
  const list = useMemo(() => {
    const s = q.trim().toLowerCase()
    return data.leads.filter((l) => !s || `${l.company} ${fullName(l)} ${l.city} ${l.tags.join(' ')}`.toLowerCase().includes(s)).slice(0, 60)
  }, [q, data.leads])
  return (
    <Modal open={open} onClose={close} title={`Add contacts to ${wf.name}`} wide>
      <SearchInput value={q} onChange={setQ} placeholder="Company, name, city or tag" />
      <ul className="mt-3 max-h-80 divide-y divide-line overflow-y-auto rounded-lg ring-1 ring-inset ring-line">
        {list.map((l) => (
          <li key={l.id}>
            <label className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-wash">
              <input
                type="checkbox"
                checked={picked.has(l.id)}
                onChange={(e) => {
                  const n = new Set(picked)
                  e.target.checked ? n.add(l.id) : n.delete(l.id)
                  setPicked(n)
                }}
              />
              <span className="min-w-0 flex-1 truncate">
                <span className="font-medium text-ink-900">{l.company}</span>
                <span className="text-ink-400"> · {l.city}</span>
              </span>
            </label>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex items-center justify-end gap-2">
        {done && <span className="mr-auto text-xs text-sage-700">{done}</span>}
        <Button onClick={() => setPicked(new Set(list.map((l) => l.id)))}>Select all shown</Button>
        <Button
          variant="primary"
          disabled={!picked.size}
          onClick={async () => {
            const n = await enrollWorkflow([...picked], wf.id)
            setDone(`${n} added${n < picked.size ? ` (${picked.size - n} already in it)` : ''}`)
            setPicked(new Set())
          }}
        >
          Add {picked.size || ''}
        </Button>
      </div>
    </Modal>
  )
}
