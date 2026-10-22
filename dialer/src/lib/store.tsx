import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { backend, type Change, type Session, type Snapshot } from './backend'
import type { Activity, Callback, Lead, Outcome, Settings } from './types'
import { OUTCOMES } from './constants'
import { uid } from './format'

export interface OutcomeExtra {
  note?: string
  callback?: { due_at: string; reason: string; owner: string }
  meeting_at?: string
  why_now?: string
}

interface Ctx {
  me: Session
  data: Snapshot
  leadById: Map<string, Lead>
  error: string | null
  clearError(): void
  logOutcome(lead: Lead, outcome: Outcome, extra?: OutcomeExtra): Promise<void>
  confirmBooking(lead: Lead): Promise<void>
  addNote(lead: Lead, text: string): Promise<void>
  updateLead(id: string, patch: Partial<Lead>): Promise<void>
  completeCallback(cb: Callback): Promise<void>
  rescheduleCallback(cb: Callback, due_at: string): Promise<void>
  importLeads(rows: Lead[]): Promise<void>
  saveSettings(s: Settings): Promise<void>
  signOut(): Promise<void>
}

const DataCtx = createContext<Ctx | null>(null)

export function useData(): Ctx {
  const c = useContext(DataCtx)
  if (!c) throw new Error('useData outside provider')
  return c
}

function upsert<T extends { id: string }>(list: T[], row: T, deleted?: boolean): T[] {
  const i = list.findIndex((x) => x.id === row.id)
  if (deleted) return i < 0 ? list : list.filter((x) => x.id !== row.id)
  if (i < 0) return [...list, row]
  const next = list.slice()
  next[i] = { ...next[i], ...row }
  return next
}

function applyChange(s: Snapshot, c: Change): Snapshot {
  if (c.table === 'leads') return { ...s, leads: upsert(s.leads, c.row, c.deleted) }
  if (c.table === 'activities') return { ...s, activities: upsert(s.activities, c.row, c.deleted) }
  return { ...s, callbacks: upsert(s.callbacks, c.row, c.deleted) }
}

export function DataProvider({ me, children, onSignOut }: { me: Session; children: ReactNode; onSignOut(): void }) {
  const [data, setData] = useState<Snapshot | null>(null)
  const [error, setError] = useState<string | null>(null)
  const dataRef = useRef<Snapshot | null>(null)
  dataRef.current = data

  useEffect(() => {
    let alive = true
    backend
      .load()
      .then((s) => alive && setData(s))
      .catch((e) => alive && setError(`Could not load data: ${e.message || e}`))
    const off = backend.subscribe((c) => setData((s) => (s ? applyChange(s, c) : s)))
    return () => {
      alive = false
      off()
    }
  }, [])

  // Optimistic local apply, then persist. On failure, surface the error and reload.
  const run = useCallback(async (changes: Change[], persist: () => Promise<void>) => {
    setData((s) => (s ? changes.reduce(applyChange, s) : s))
    try {
      await persist()
    } catch (e: any) {
      setError(`Save failed: ${e?.message || e}. Reloading.`)
      backend.load().then(setData).catch(() => {})
    }
  }, [])

  const now = () => new Date().toISOString()

  const logOutcome = useCallback<Ctx['logOutcome']>(
    async (lead, outcome, extra = {}) => {
      const def = OUTCOMES.find((o) => o.key === outcome)
      const t = now()
      const open = (dataRef.current?.callbacks || []).filter((c) => c.lead_id === lead.id && !c.done_at)
      const status = def?.status ?? 'attempting'
      const patch: Partial<Lead> = {
        status,
        last_outcome: outcome,
        last_called_at: t,
        attempts: (lead.attempts || 0) + 1,
        updated_at: t,
      }
      if (extra.callback) patch.owner = extra.callback.owner
      if (outcome === 'booked') {
        patch.meeting_at = extra.meeting_at || null
        patch.why_now = extra.why_now || ''
        patch.owner = lead.owner || me.name
      }
      const act: Activity = {
        id: uid(),
        lead_id: lead.id,
        user_name: me.name,
        outcome,
        note: [extra.callback ? `Call back ${new Date(extra.callback.due_at).toLocaleString()} (${extra.callback.reason})` : '', extra.note || '']
          .filter(Boolean)
          .join(' · '),
        created_at: t,
      }
      const closed = open.map((c) => ({ ...c, done_at: t }))
      const cb: Callback | null = extra.callback
        ? { id: uid(), lead_id: lead.id, owner: extra.callback.owner, due_at: extra.callback.due_at, reason: extra.callback.reason, done_at: null, created_by: me.name, created_at: t }
        : null
      const changes: Change[] = [
        { table: 'leads', row: { ...lead, ...patch } },
        { table: 'activities', row: act },
        ...closed.map((row) => ({ table: 'callbacks' as const, row })),
        ...(cb ? [{ table: 'callbacks' as const, row: cb }] : []),
      ]
      await run(changes, async () => {
        await backend.updateLead(lead.id, patch)
        await backend.insertActivity(act)
        for (const c of closed) await backend.updateCallback(c.id, { done_at: t })
        if (cb) await backend.insertCallback(cb)
      })
    },
    [me.name, run],
  )

  const confirmBooking = useCallback<Ctx['confirmBooking']>(
    async (lead) => {
      const t = now()
      const act: Activity = { id: uid(), lead_id: lead.id, user_name: me.name, outcome: 'confirmed', note: 'Replied YES', created_at: t }
      await run(
        [{ table: 'leads', row: { ...lead, status: 'confirmed', updated_at: t } }, { table: 'activities', row: act }],
        async () => {
          await backend.updateLead(lead.id, { status: 'confirmed', updated_at: t })
          await backend.insertActivity(act)
        },
      )
    },
    [me.name, run],
  )

  const addNote = useCallback<Ctx['addNote']>(
    async (lead, text) => {
      const act: Activity = { id: uid(), lead_id: lead.id, user_name: me.name, outcome: 'note', note: text, created_at: now() }
      await run([{ table: 'activities', row: act }], () => backend.insertActivity(act))
    },
    [me.name, run],
  )

  const updateLead = useCallback<Ctx['updateLead']>(
    async (id, patch) => {
      const lead = dataRef.current?.leads.find((l) => l.id === id)
      if (!lead) return
      const p = { ...patch, updated_at: now() }
      await run([{ table: 'leads', row: { ...lead, ...p } }], () => backend.updateLead(id, p))
    },
    [run],
  )

  const completeCallback = useCallback<Ctx['completeCallback']>(
    async (cb) => {
      const t = now()
      await run([{ table: 'callbacks', row: { ...cb, done_at: t } }], () => backend.updateCallback(cb.id, { done_at: t }))
    },
    [run],
  )

  const rescheduleCallback = useCallback<Ctx['rescheduleCallback']>(
    async (cb, due_at) => {
      await run([{ table: 'callbacks', row: { ...cb, due_at } }], () => backend.updateCallback(cb.id, { due_at }))
    },
    [run],
  )

  const importLeads = useCallback<Ctx['importLeads']>(
    async (rows) => {
      await run(
        rows.map((row) => ({ table: 'leads' as const, row })),
        () => backend.insertLeads(rows),
      )
    },
    [run],
  )

  const saveSettings = useCallback<Ctx['saveSettings']>(async (s) => {
    setData((d) => (d ? { ...d, settings: s } : d))
    await backend.saveSettings(s)
  }, [])

  const signOut = useCallback(async () => {
    await backend.signOut()
    onSignOut()
  }, [onSignOut])

  const leadById = useMemo(() => new Map((data?.leads || []).map((l) => [l.id, l])), [data?.leads])

  if (!data) {
    return (
      <div className="grid min-h-screen place-items-center bg-canvas text-sm text-ink-500">
        {error ? <p className="max-w-sm text-center text-rose-600">{error}</p> : 'Loading leads…'}
      </div>
    )
  }

  const value: Ctx = {
    me,
    data,
    leadById,
    error,
    clearError: () => setError(null),
    logOutcome,
    confirmBooking,
    addNote,
    updateLead,
    completeCallback,
    rescheduleCallback,
    importLeads,
    saveSettings,
    signOut,
  }
  return <DataCtx.Provider value={value}>{children}</DataCtx.Provider>
}
