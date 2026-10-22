import { useMemo, useState } from 'react'
import { Badge, Button, Card, CardHead, Empty, Field, Icon, Modal, PageHeader, Select, Td, Th, inputCls, pct } from '../components/ui'
import { fmtDur } from '../components/CallBar'
import { backend } from '../lib/backend'
import { CALL_SOURCES } from '../lib/constants'
import { e164, prettyPhone, uid } from '../lib/format'
import type { PhoneNumber } from '../lib/types'
import { useData } from '../lib/store'

// Lines are what K and Ali dial out from. Tracking numbers go on one place each
// (website, Google profile, an ad, the email signature) and ring through to a
// cell, so every inbound call shows where it came from.
export function Numbers() {
  const { data, leadById, save } = useData()
  const [edit, setEdit] = useState<PhoneNumber | null>(null)
  const since = new Date(Date.now() - 30 * 864e5).toISOString()

  const stats = useMemo(() => {
    const m = new Map<
      string,
      {
        calls: number
        answered: number
        missed: number
        talk: number
        booked: number
      }
    >()
    for (const c of data.calls) {
      if (!c.number_id || c.started_at < since) continue
      const s = m.get(c.number_id) || {
        calls: 0,
        answered: 0,
        missed: 0,
        talk: 0,
        booked: 0,
      }
      s.calls++
      if (c.status === 'completed') s.answered++
      if (c.status === 'missed') s.missed++
      s.talk += c.duration_sec
      m.set(c.number_id, s)
    }
    // Booked: roofers who called a tracking number and are now in the pipeline.
    for (const n of data.numbers) {
      if (n.kind !== 'tracking') continue
      const ids = new Set(data.calls.filter((c) => c.number_id === n.id && c.lead_id && c.started_at >= since).map((c) => c.lead_id!))
      const s = m.get(n.id)
      if (s) s.booked = [...ids].filter((id) => leadById.get(id)?.stage).length
    }
    return m
  }, [data.calls, data.numbers, leadById, since])

  const blank = (kind: PhoneNumber['kind']): PhoneNumber => ({
    id: uid(),
    number: '',
    label: '',
    kind,
    source: kind === 'line' ? 'Cold calling' : 'Website',
    owner: data.settings.callers[0] || 'K',
    forward_to: '',
    record: true,
    active: true,
    created_at: new Date().toISOString(),
  })

  const section = (kind: PhoneNumber['kind']) => {
    const list = data.numbers.filter((n) => n.kind === kind)
    return (
      <Card className="mt-5">
        <CardHead
          title={kind === 'line' ? 'Calling lines' : 'Tracking numbers'}
          sub={
            kind === 'line'
              ? 'The number roofers see when K or Ali calls. Calls back to it ring that person.'
              : 'One number per place it appears. Inbound calls get tagged with that source.'
          }
          actions={
            <Button size="sm" onClick={() => setEdit(blank(kind))}>
              <Icon name="plus" /> Add
            </Button>
          }
        />
        {list.length === 0 ? (
          <Empty title="None yet" sub={kind === 'line' ? 'Add one line for K and one for Ali.' : 'Add a number for the website, the Google profile, or an ad.'} />
        ) : (
          <>
            <ul className="sm:hidden">
              {list.map((n) => {
                const s = stats.get(n.id) || { calls: 0, answered: 0, missed: 0, talk: 0, booked: 0 }
                return (
                  <li key={n.id} className="border-t border-line px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-medium text-ink-900">
                          {n.label} {!n.active && <Badge tone="stone">Off</Badge>}
                        </div>
                        <div className="tabular text-sm text-ink-700">{prettyPhone(n.number)}</div>
                        <div className="text-xs text-ink-400">
                          {kind === 'line' ? `${n.source} · ${n.owner}` : `${n.source} · rings ${n.owner}${n.forward_to ? ` at ${prettyPhone(n.forward_to)}` : ''}`}
                          {!n.record && ' · not recorded'}
                        </div>
                      </div>
                      <button onClick={() => setEdit(n)} className="shrink-0 text-xs text-ink-500 underline hover:text-ink-900">
                        Edit
                      </button>
                    </div>
                    <div className="tabular mt-2 text-xs text-ink-500">
                      {s.calls} calls · {pct(s.answered, s.calls)} {kind === 'line' ? 'connected' : 'answered'}
                      {kind === 'tracking' && <span className={s.missed ? 'text-clay-700' : ''}> · {s.missed} missed</span>} · {fmtDur(s.talk)} talk
                      {kind === 'tracking' && ` · ${s.booked} in pipeline`}
                    </div>
                  </li>
                )
              })}
            </ul>
            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-y border-line">
                    <Th>Name</Th>
                    <Th>Number</Th>
                    <Th>{kind === 'line' ? 'Owner' : 'Rings'}</Th>
                    <Th className="text-right">Calls 30d</Th>
                    <Th className="text-right">{kind === 'line' ? 'Connected' : 'Answered'}</Th>
                    {kind === 'tracking' && <Th className="text-right">Missed</Th>}
                    <Th className="text-right">Talk time</Th>
                    {kind === 'tracking' && <Th className="text-right">In pipeline</Th>}
                    <Th />
                  </tr>
                </thead>
                <tbody>
                  {list.map((n) => {
                    const s = stats.get(n.id) || {
                      calls: 0,
                      answered: 0,
                      missed: 0,
                      talk: 0,
                      booked: 0,
                    }
                    return (
                      <tr key={n.id} className="border-b border-line last:border-0">
                        <Td>
                          <div className="font-medium text-ink-900">{n.label}</div>
                          <div className="text-xs text-ink-400">
                            {n.source}
                            {!n.record && ' · not recorded'}
                          </div>
                        </Td>
                        <Td className="tabular whitespace-nowrap text-ink-700">{prettyPhone(n.number)}</Td>
                        <Td className="text-ink-700">{kind === 'line' ? n.owner : `${n.owner}${n.forward_to ? ` · ${prettyPhone(n.forward_to)}` : ''}`}</Td>
                        <Td className="tabular text-right">{s.calls}</Td>
                        <Td className="tabular text-right">{pct(s.answered, s.calls)}</Td>
                        {kind === 'tracking' && <Td className={`tabular text-right ${s.missed ? 'text-clay-700' : ''}`}>{s.missed}</Td>}
                        <Td className="tabular text-right">{fmtDur(s.talk)}</Td>
                        {kind === 'tracking' && <Td className="tabular text-right">{s.booked}</Td>}
                        <Td className="text-right">
                          {!n.active && <Badge tone="stone">Off</Badge>}{' '}
                          <button onClick={() => setEdit(n)} className="text-xs text-ink-500 underline hover:text-ink-900">
                            Edit
                          </button>
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
    )
  }

  return (
    <div>
      <PageHeader title="Phone numbers" sub="Your calling lines and the tracking numbers that tell you where inbound calls come from." />
      <Setup />
      {section('line')}
      {section('tracking')}
      <NumberModal row={edit} close={() => setEdit(null)} save={(n) => save('numbers', n)} callers={data.settings.callers} />
    </div>
  )
}

function Setup() {
  const live = backend.mode === 'live'
  const base = backend.functionsUrl || 'https://<project>.supabase.co/functions/v1'
  return (
    <Card className="p-5">
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-accent-50 text-accent-700">
          <Icon name="phone" />
        </span>
        <div className="min-w-0 text-sm text-ink-700">
          <div className="font-semibold text-ink-900">How calls get tracked</div>
          <ul className="mt-1.5 list-disc space-y-1 pl-4">
            <li>Every dial from the Dial screen becomes a call with its length and result, whether you call from your cell or the browser.</li>
            <li>
              With the phone carrier connected, browser calls are recorded and inbound calls to a tracking number ring the owner's cell. A missed call becomes a callback task.
            </li>
            <li>Numbers are bought in the carrier account, then added here. Point each number's voice webhook at the address below.</li>
          </ul>
          <div className="mt-3 grid gap-1 text-xs">
            <code className="truncate rounded bg-wash px-2 py-1 text-ink-700">Voice (incoming): {base}/crm-voice/inbound</code>
            <code className="truncate rounded bg-wash px-2 py-1 text-ink-700">Browser calling app: {base}/crm-voice/outbound</code>
          </div>
          {!live && <p className="mt-2 text-xs text-ink-400">Demo mode: sample numbers (555) and sample calls.</p>}
        </div>
      </div>
    </Card>
  )
}

function NumberModal({ row, close, save, callers }: { row: PhoneNumber | null; close(): void; save(n: PhoneNumber): Promise<void>; callers: string[] }) {
  const [n, setN] = useState<PhoneNumber | null>(row)
  const [key, setKey] = useState('')
  if (row && row.id !== key) {
    setKey(row.id)
    setN(row)
  }
  if (!row || !n) return null
  const set = (p: Partial<PhoneNumber>) => setN({ ...n, ...p })
  const ok = e164(n.number).length === 12 && n.label.trim()
  return (
    <Modal open onClose={close} title={row.number ? `Edit ${row.label}` : n.kind === 'line' ? 'Add a calling line' : 'Add a tracking number'}>
      <div className="space-y-3">
        <Field label="Name">
          <input className={inputCls} value={n.label} onChange={(e) => set({ label: e.target.value })} placeholder={n.kind === 'line' ? "K's line" : 'Website'} />
        </Field>
        <Field label="Number" hint="As bought in the carrier account.">
          <input className={inputCls} value={n.number} onChange={(e) => set({ number: e.target.value })} placeholder="(512) 555-0100" />
        </Field>
        {n.kind === 'tracking' && (
          <Field label="Where it appears">
            <Select
              value={CALL_SOURCES.includes(n.source) ? n.source : 'other'}
              onChange={(v) => set({ source: v === 'other' ? '' : v })}
              options={[...CALL_SOURCES.map((s) => [s, s] as [string, string]), ['other', 'Something else…']]}
            />
            {!CALL_SOURCES.includes(n.source) && (
              <input className={`${inputCls} mt-2`} value={n.source} onChange={(e) => set({ source: e.target.value })} placeholder="e.g. Truck wrap" />
            )}
          </Field>
        )}
        <Field label={n.kind === 'line' ? 'Whose line' : 'Who answers'}>
          <Select value={n.owner || ''} onChange={(v) => set({ owner: v })} options={callers.map((c) => [c, c] as [string, string])} />
        </Field>
        <Field label="Ring this cell" hint="Inbound calls forward here. Leave blank to only take calls in the browser.">
          <input className={inputCls} value={n.forward_to} onChange={(e) => set({ forward_to: e.target.value })} placeholder="(512) 555-0190" />
        </Field>
        <label className="flex items-center gap-2 text-sm text-ink-700">
          <input type="checkbox" checked={n.record} onChange={(e) => set({ record: e.target.checked })} /> Record calls on this number
        </label>
        <label className="flex items-center gap-2 text-sm text-ink-700">
          <input type="checkbox" checked={n.active} onChange={(e) => set({ active: e.target.checked })} /> Active
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <Button onClick={close}>Cancel</Button>
          <Button
            variant="primary"
            disabled={!ok}
            onClick={async () => {
              await save({
                ...n,
                number: e164(n.number),
                forward_to: n.forward_to ? e164(n.forward_to) : '',
                label: n.label.trim(),
              })
              close()
            }}
          >
            Save
          </Button>
        </div>
      </div>
    </Modal>
  )
}
