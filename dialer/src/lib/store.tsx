import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { backend, type Change, type Rows, type Session, type Snapshot, type Table } from './backend'
import type { Activity, Call, CallStatus, Email, EmailEvent, Lead, Meeting, MeetingStatus, Outcome, Settings, Stage, Task } from './types'
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
  save<K extends Table>(table: K, row: Rows[K]): Promise<void>
  remove(table: Table, id: string): Promise<void>
  logOutcome(lead: Lead, outcome: Outcome, extra?: OutcomeExtra): Promise<void>
  confirmBooking(lead: Lead): Promise<void>
  addNote(lead: Lead, text: string): Promise<void>
  updateLead(id: string, patch: Partial<Lead>): Promise<void>
  setStage(lead: Lead, stage: Stage | null): Promise<void>
  setMeetingStatus(m: Meeting, status: MeetingStatus): Promise<void>
  completeTask(t: Task): Promise<void>
  rescheduleTask(t: Task, due_at: string): Promise<void>
  importLeads(rows: Lead[]): Promise<void>
  draftEmail(lead: Lead, subject: string, body: string, branded: boolean): Promise<void>
  approveEmails(ids: string[]): Promise<void>
  enroll(leadIds: string[], sequenceId: string): Promise<void>
  saveSettings(s: Settings): Promise<void>
  signOut(): Promise<void>
  // Calls: one row per dial. startCall opens it, endCall stamps the length,
  // logOutcome attaches the result (or creates the row if the dial happened off-app).
  startCall(lead: Lead, via: Call['via']): Promise<Call>
  endCall(id: string, connectedSec: number): Promise<void>
  contactFromCall(call: Call): Promise<string>
}

// What a call's status should read once its outcome is known.
export function callStatusFor(outcome: Outcome | null, connected: boolean): CallStatus {
  if (outcome === 'no_answer') return 'no_answer'
  if (outcome === 'voicemail') return 'voicemail'
  if (outcome === 'bad_number') return 'failed'
  if (outcome) return 'completed'
  return connected ? 'completed' : 'no_answer'
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
  return {
    ...s,
    [c.table]: upsert(s[c.table] as { id: string }[], c.row as { id: string }, c.deleted),
  }
}

const now = () => new Date().toISOString()

export function DataProvider({ me, children, onSignOut }: { me: Session; children: ReactNode; onSignOut(): void }) {
  const [data, setData] = useState<Snapshot | null>(null)
  const [error, setError] = useState<string | null>(null)
  const ref = useRef<Snapshot | null>(null)
  ref.current = data

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
      backend
        .load()
        .then(setData)
        .catch(() => {})
    }
  }, [])

  const commit = useCallback(
    (inserts: Change[], updates: Change[]) =>
      run([...inserts, ...updates], async () => {
        for (const c of inserts) await backend.insert(c.table, [c.row as any])
        for (const c of updates) {
          if (c.deleted) await backend.remove(c.table, c.row.id)
          else await backend.update(c.table, c.row.id, c.row as any)
        }
      }),
    [run],
  )

  const isNew = (table: Table, id: string) => !(ref.current?.[table] as { id: string }[] | undefined)?.some((x) => x.id === id)

  const save = useCallback<Ctx['save']>(
    async (table, row) => {
      const c = { table, row } as Change
      await (isNew(table, row.id) ? commit([c], []) : commit([], [c]))
    },
    [commit],
  )

  const remove = useCallback<Ctx['remove']>(
    async (table, id) => {
      const row = (ref.current?.[table] as { id: string }[]).find((x) => x.id === id)
      if (row) await commit([], [{ table, row, deleted: true } as Change])
    },
    [commit],
  )

  const act = (lead_id: string, outcome: Outcome, note = ''): Activity => ({
    id: uid(),
    lead_id,
    user_name: me.name,
    outcome,
    note,
    created_at: now(),
  })

  const logOutcome = useCallback<Ctx['logOutcome']>(
    async (lead, outcome, extra = {}) => {
      const def = OUTCOMES.find((o) => o.key === outcome)
      const t = now()
      const open = (ref.current?.tasks || []).filter((c) => c.lead_id === lead.id && c.kind === 'callback' && !c.done_at)
      const patch: Partial<Lead> = {
        status: def?.status ?? 'attempting',
        last_outcome: outcome,
        last_called_at: t,
        attempts: (lead.attempts || 0) + 1,
        updated_at: t,
      }
      if (extra.callback) patch.owner = extra.callback.owner
      const inserts: Change[] = []
      if (outcome === 'booked') {
        patch.meeting_at = extra.meeting_at || null
        patch.why_now = extra.why_now || ''
        patch.owner = lead.owner || me.name
        patch.stage = 'booked'
        patch.deal_value = lead.deal_value || 14000
        if (extra.meeting_at) {
          const m: Meeting = {
            id: uid(),
            lead_id: lead.id,
            owner: patch.owner!,
            starts_at: extra.meeting_at,
            minutes: 30,
            status: 'scheduled',
            why_now: extra.why_now || '',
            source: 'dialer',
            created_at: t,
          }
          inserts.push({ table: 'meetings', row: m })
        }
      }
      const a = act(
        lead.id,
        outcome,
        [extra.callback ? `Call back ${new Date(extra.callback.due_at).toLocaleString()} (${extra.callback.reason})` : '', extra.note || ''].filter(Boolean).join(' · '),
      )
      inserts.push({ table: 'activities', row: a })
      if (extra.callback) {
        const cb: Task = {
          id: uid(),
          lead_id: lead.id,
          kind: 'callback',
          owner: extra.callback.owner,
          due_at: extra.callback.due_at,
          reason: extra.callback.reason,
          done_at: null,
          created_by: me.name,
          created_at: t,
        }
        inserts.push({ table: 'tasks', row: cb })
      }
      const updates: Change[] = [
        { table: 'leads', row: { ...lead, ...patch } },
        ...open.map((c) => ({
          table: 'tasks' as const,
          row: { ...c, done_at: t },
        })),
      ]
      // Tie the outcome to this dial's call row, or record the dial if it happened outside the app.
      if (OUTCOMES.some((o) => o.key === outcome)) {
        const since = new Date(Date.now() - 2 * 3600e3).toISOString()
        const call = (ref.current?.calls || [])
          .filter((c) => c.lead_id === lead.id && c.direction === 'out' && c.user_name === me.name && !c.outcome && c.created_at >= since)
          .sort((a, b) => b.created_at.localeCompare(a.created_at))[0]
        if (call) {
          updates.push({
            table: 'calls',
            row: {
              ...call,
              outcome,
              status: call.status === 'live' ? 'live' : callStatusFor(outcome, call.duration_sec > 0),
            },
          })
        } else {
          const line = (ref.current?.numbers || []).find((n) => n.kind === 'line' && n.owner === me.name && n.active)
          inserts.push({
            table: 'calls',
            row: {
              id: uid(),
              lead_id: lead.id,
              direction: 'out',
              user_name: me.name,
              from_number: line?.number || '',
              to_number: lead.phone,
              number_id: line?.id || null,
              source: 'Cold calling',
              status: callStatusFor(outcome, false),
              started_at: t,
              duration_sec: 0,
              recording_url: '',
              outcome,
              via: 'cell',
              provider_id: null,
              created_at: t,
            },
          })
        }
      }
      await commit(inserts, updates)
    },
    [me.name, commit],
  )

  const confirmBooking = useCallback<Ctx['confirmBooking']>(
    async (lead) => {
      const t = now()
      const m = (ref.current?.meetings || []).filter((x) => x.lead_id === lead.id && x.status === 'scheduled')
      await commit(
        [
          {
            table: 'activities',
            row: act(lead.id, 'confirmed', 'Replied YES'),
          },
        ],
        [
          {
            table: 'leads',
            row: {
              ...lead,
              status: 'confirmed',
              stage: 'confirmed',
              updated_at: t,
            },
          },
          ...m.map((x) => ({
            table: 'meetings' as const,
            row: { ...x, status: 'confirmed' as const },
          })),
        ],
      )
    },
    [me.name, commit],
  )

  const addNote = useCallback<Ctx['addNote']>(async (lead, text) => commit([{ table: 'activities', row: act(lead.id, 'note', text) }], []), [me.name, commit])

  const updateLead = useCallback<Ctx['updateLead']>(
    async (id, patch) => {
      const lead = ref.current?.leads.find((l) => l.id === id)
      if (lead) await commit([], [{ table: 'leads', row: { ...lead, ...patch, updated_at: now() } }])
    },
    [commit],
  )

  const setStage = useCallback<Ctx['setStage']>(
    async (lead, stage) => {
      if (lead.stage === stage) return
      await commit(
        [
          {
            table: 'activities',
            row: act(lead.id, 'stage', stage ? `Moved to ${stage}` : 'Removed from pipeline'),
          },
        ],
        [{ table: 'leads', row: { ...lead, stage, updated_at: now() } }],
      )
    },
    [me.name, commit],
  )

  const setMeetingStatus = useCallback<Ctx['setMeetingStatus']>(
    async (m, status) => {
      const lead = ref.current?.leads.find((l) => l.id === m.lead_id)
      const stage: Stage | null = status === 'showed' ? 'showed' : status === 'no_show' ? 'no_show' : status === 'confirmed' ? 'confirmed' : (lead?.stage ?? null)
      const updates: Change[] = [{ table: 'meetings', row: { ...m, status } }]
      if (lead && stage !== lead.stage)
        updates.push({
          table: 'leads',
          row: {
            ...lead,
            stage,
            status: status === 'confirmed' ? 'confirmed' : lead.status,
            updated_at: now(),
          },
        })
      await commit(
        [
          {
            table: 'activities',
            row: act(m.lead_id, 'stage', `Meeting marked ${status.replace('_', '-')}`),
          },
        ],
        updates,
      )
    },
    [me.name, commit],
  )

  const completeTask = useCallback<Ctx['completeTask']>(async (t) => commit([], [{ table: 'tasks', row: { ...t, done_at: now() } }]), [commit])
  const rescheduleTask = useCallback<Ctx['rescheduleTask']>(async (t, due_at) => commit([], [{ table: 'tasks', row: { ...t, due_at } }]), [commit])

  const importLeads = useCallback<Ctx['importLeads']>(
    async (rows) =>
      commit(
        rows.map((row) => ({ table: 'leads' as const, row })),
        [],
      ),
    [commit],
  )

  const draftEmail = useCallback<Ctx['draftEmail']>(
    async (lead, subject, body, branded) => {
      const s = ref.current!.settings
      const e: Email = {
        id: uid(),
        lead_id: lead.id,
        direction: 'out',
        from_addr: s.sender,
        to_addr: lead.email,
        cc: s.cc,
        subject,
        body,
        branded,
        status: 'draft',
        sequence_id: null,
        step: null,
        campaign_id: null,
        variant: null,
        sent_at: null,
        opens: 0,
        clicks: 0,
        first_open_at: null,
        last_open_at: null,
        replied_at: null,
        created_by: me.name,
        created_at: now(),
      }
      await commit([{ table: 'emails', row: e }], [])
    },
    [me.name, commit],
  )

  // Approving queues the email for the sender. In demo mode it "sends" right away
  // so the tracking views have something to show.
  const approveEmails = useCallback<Ctx['approveEmails']>(
    async (ids) => {
      const t = now()
      const list = (ref.current?.emails || []).filter((e) => ids.includes(e.id) && e.status === 'draft')
      const demo = backend.mode === 'demo'
      const updates: Change[] = list.map((e) => ({
        table: 'emails',
        row: {
          ...e,
          status: demo ? 'sent' : 'approved',
          sent_at: demo ? t : null,
        },
      }))
      const inserts: Change[] = demo
        ? list.flatMap((e) => [
            {
              table: 'email_events' as const,
              row: {
                id: uid(),
                email_id: e.id,
                lead_id: e.lead_id,
                type: 'sent',
                url: '',
                created_at: t,
              } as EmailEvent,
            },
            {
              table: 'activities' as const,
              row: act(e.lead_id, 'email', `Sent "${e.subject}"`),
            },
          ])
        : []
      await commit(inserts, updates)
    },
    [me.name, commit],
  )

  const enroll = useCallback<Ctx['enroll']>(
    async (leadIds, sequenceId) => {
      const leads = (ref.current?.leads || []).filter((l) => leadIds.includes(l.id) && l.email && l.email_status === 'ok')
      await commit(
        [],
        leads.map((l) => ({
          table: 'leads' as const,
          row: {
            ...l,
            sequence_id: sequenceId,
            sequence_step: 0,
            sequence_state: 'active' as const,
            updated_at: now(),
          },
        })),
      )
    },
    [commit],
  )

  const saveSettings = useCallback<Ctx['saveSettings']>(async (s) => {
    setData((d) => (d ? { ...d, settings: s } : d))
    await backend.saveSettings(s)
  }, [])

  const startCall = useCallback<Ctx['startCall']>(
    async (lead, via) => {
      const t = now()
      const line = (ref.current?.numbers || []).find((n) => n.kind === 'line' && n.owner === me.name && n.active)
      const c: Call = {
        id: uid(),
        lead_id: lead.id,
        direction: 'out',
        user_name: me.name,
        from_number: line?.number || '',
        to_number: lead.phone,
        number_id: line?.id || null,
        source: 'Cold calling',
        status: 'live',
        started_at: t,
        duration_sec: 0,
        recording_url: '',
        outcome: null,
        via,
        provider_id: null,
        created_at: t,
      }
      await commit([{ table: 'calls', row: c }], [])
      return c
    },
    [me.name, commit],
  )

  const endCall = useCallback<Ctx['endCall']>(
    async (id, connectedSec) => {
      const c = (ref.current?.calls || []).find((x) => x.id === id)
      if (!c) return
      const dur = Math.max(c.duration_sec, Math.round(connectedSec))
      await commit(
        [],
        [
          {
            table: 'calls',
            row: {
              ...c,
              duration_sec: dur,
              status: callStatusFor(c.outcome, dur > 0),
            },
          },
        ],
      )
    },
    [commit],
  )

  // An unknown number called in: make it a contact and link its calls.
  const contactFromCall = useCallback<Ctx['contactFromCall']>(
    async (call) => {
      const t = now()
      const lead: Lead = {
        id: uid(),
        ghl_id: null,
        first_name: '',
        last_name: '',
        company: `Caller ${call.from_number}`,
        phone: call.from_number,
        email: '',
        city: '',
        state: '',
        website: '',
        pain: 'unknown',
        segment: 'growing',
        status: 'new',
        stage: null,
        deal_value: 0,
        owner: me.name,
        tags: ['inbound-call'],
        notes: '',
        source: `Inbound call · ${call.source}`,
        attempts: 0,
        last_outcome: null,
        last_called_at: null,
        meeting_at: null,
        why_now: '',
        sequence_id: null,
        sequence_step: 0,
        sequence_state: null,
        email_status: 'ok',
        created_at: t,
        updated_at: t,
      }
      const same = (ref.current?.calls || []).filter((c) => !c.lead_id && (c.from_number === call.from_number || c.to_number === call.from_number))
      await commit(
        [{ table: 'leads', row: lead }],
        same.map((c) => ({
          table: 'calls' as const,
          row: { ...c, lead_id: lead.id },
        })),
      )
      return lead.id
    },
    [me.name, commit],
  )

  const signOut = useCallback(async () => {
    await backend.signOut()
    onSignOut()
  }, [onSignOut])

  const leadById = useMemo(() => new Map((data?.leads || []).map((l) => [l.id, l])), [data?.leads])

  if (!data) {
    return (
      <div className="grid min-h-screen place-items-center bg-canvas text-sm text-ink-500">
        {error ? <p className="max-w-sm text-center text-clay-600">{error}</p> : 'Loading…'}
      </div>
    )
  }

  const value: Ctx = {
    me,
    data,
    leadById,
    error,
    clearError: () => setError(null),
    save,
    remove,
    logOutcome,
    confirmBooking,
    addNote,
    updateLead,
    setStage,
    setMeetingStatus,
    completeTask,
    rescheduleTask,
    importLeads,
    draftEmail,
    approveEmails,
    enroll,
    saveSettings,
    signOut,
    startCall,
    endCall,
    contactFromCall,
  }
  return <DataCtx.Provider value={value}>{children}</DataCtx.Provider>
}
