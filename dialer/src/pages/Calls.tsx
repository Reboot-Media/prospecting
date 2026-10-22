import { Fragment, useEffect, useMemo, useState } from 'react'
import { Badge, Button, Card, Empty, Icon, PageHeader, SearchInput, Select, StatStrip, Tabs, Td, Th, pct } from '../components/ui'
import { fmtDur, useCall } from '../components/CallBar'
import { CALL_STATUS_LABEL, CALL_STATUS_TONE, OUTCOME_LABEL } from '../lib/constants'
import { ago, digits, isSameDay, prettyPhone } from '../lib/format'
import { recordingSrc } from '../lib/phone'
import type { Call } from '../lib/types'
import { useData } from '../lib/store'

type Tab = 'all' | 'out' | 'in' | 'missed' | 'recorded'

// Every call in and out: who, which line or tracking number, how long, what happened, the recording.
export function Calls({ openContact }: { openContact(id: string): void }) {
  const { me, data, leadById, contactFromCall } = useData()
  const { call } = useCall()
  const [tab, setTab] = useState<Tab>('all')
  const [who, setWho] = useState('all')
  const [source, setSource] = useState('all')
  const [range, setRange] = useState('7')
  const [q, setQ] = useState('')
  const [playing, setPlaying] = useState('')
  const [notes, setNotes] = useState('')
  const [limit, setLimit] = useState(50)

  const since = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    d.setDate(d.getDate() - (Number(range) - 1))
    return d.toISOString()
  }, [range])

  const numberById = useMemo(() => new Map(data.numbers.map((n) => [n.id, n])), [data.numbers])
  const inRange = useMemo(() => data.calls.filter((c) => c.started_at >= since), [data.calls, since])
  const sources = useMemo(() => [...new Set(data.calls.map((c) => c.source).filter(Boolean))].sort(), [data.calls])

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const nd = digits(needle)
    return inRange
      .filter((c) => {
        if (tab === 'out' && c.direction !== 'out') return false
        if (tab === 'in' && c.direction !== 'in') return false
        if (tab === 'missed' && c.status !== 'missed') return false
        if (tab === 'recorded' && !c.recording_url) return false
        if (who !== 'all' && c.user_name !== who) return false
        if (source !== 'all' && c.source !== source) return false
        if (needle) {
          const l = c.lead_id ? leadById.get(c.lead_id) : undefined
          const hay = `${l?.company || ''} ${l?.first_name || ''} ${l?.city || ''}`.toLowerCase()
          if (!hay.includes(needle) && !(nd && (digits(c.from_number).includes(nd) || digits(c.to_number).includes(nd)))) return false
        }
        return true
      })
      .sort((a, b) => b.started_at.localeCompare(a.started_at))
  }, [inRange, tab, who, source, q, leadById])

  const shown = rows.slice(0, limit)
  const today = data.calls.filter((c) => isSameDay(new Date(c.started_at), new Date()))
  const connected = (list: Call[]) => list.filter((c) => c.status === 'completed' && c.duration_sec >= 30)
  const talk = (list: Call[]) => list.reduce((s, c) => s + c.duration_sec, 0)
  const outToday = today.filter((c) => c.direction === 'out')
  const missedOpen = inRange.filter((c) => c.status === 'missed' && !calledBackAfter(c, data.calls))

  return (
    <div>
      <PageHeader
        title="Calls"
        sub="Every dial and every inbound call, with length, result and recording."
        actions={
          <>
            <Select
              label="Range"
              value={range}
              onChange={setRange}
              options={[
                ['1', 'Today'],
                ['7', 'Last 7 days'],
                ['30', 'Last 30 days'],
              ]}
            />
            <Select label="Caller" value={who} onChange={setWho} options={[['all', 'Everyone'], ...data.settings.callers.map((c) => [c, c] as [string, string])]} />
          </>
        }
      />
      <StatStrip
        items={[
          {
            label: 'Dials today',
            value: outToday.length,
            sub: `${data.settings.daily_dial_goal} goal each`,
            icon: 'phone',
          },
          {
            label: 'Conversations today',
            value: connected(outToday).length,
            sub: `${pct(connected(outToday).length, outToday.length)} of dials · 30s+`,
            icon: 'message',
          },
          {
            label: 'Talk time today',
            value: fmtDur(talk(today)),
            sub: `${fmtDur(connected(today).length ? talk(connected(today)) / connected(today).length : 0)} avg conversation`,
            icon: 'clock',
          },
          {
            label: 'Inbound',
            value: inRange.filter((c) => c.direction === 'in').length,
            sub: missedOpen.length ? `${missedOpen.length} missed, not called back` : `${range === '1' ? 'today' : `last ${range} days`} · none missed`,
            icon: missedOpen.length ? 'alert' : 'inbox',
          },
        ]}
      />

      <Card className="mt-5">
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
          <Tabs
            value={tab}
            onChange={setTab}
            items={[
              { key: 'all', label: 'All', count: inRange.length },
              {
                key: 'out',
                label: 'Outbound',
                count: inRange.filter((c) => c.direction === 'out').length,
              },
              {
                key: 'in',
                label: 'Inbound',
                count: inRange.filter((c) => c.direction === 'in').length,
              },
              {
                key: 'missed',
                label: 'Missed',
                count: inRange.filter((c) => c.status === 'missed').length,
              },
              {
                key: 'recorded',
                label: 'Recorded',
                count: inRange.filter((c) => c.recording_url).length,
              },
            ]}
          />
          <Select label="Source" value={source} onChange={setSource} options={[['all', 'Any source'], ...sources.map((s) => [s, s] as [string, string])]} />
          <SearchInput value={q} onChange={setQ} placeholder="Roofer or number" className="ml-auto w-full sm:w-56" />
        </div>
        {shown.length === 0 ? (
          <Empty title="No calls here" sub="Calls show up as soon as you dial from the CRM or someone rings one of your numbers." />
        ) : (
          <>
            <ul className="sm:hidden">
              {shown.map((c) => {
                const l = c.lead_id ? leadById.get(c.lead_id) : undefined
                const n = c.number_id ? numberById.get(c.number_id) : undefined
                return (
                  <li key={c.id} className="border-b border-line px-4 py-3 last:border-0">
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <button onClick={() => (l ? openContact(l.id) : contactFromCall(c).then(openContact))} className="truncate text-left text-sm font-medium text-ink-900">
                          {l?.company || 'Unknown caller'}
                        </button>
                        <div className="text-xs text-ink-500">
                          {c.direction === 'in' ? 'In' : 'Out'} · {ago(c.started_at)} · {n?.label || c.source}
                          {c.user_name ? ` · ${c.user_name}` : ''}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <Badge tone={CALL_STATUS_TONE[c.status]}>{CALL_STATUS_LABEL[c.status]}</Badge>
                        <div className="tabular mt-1 text-xs text-ink-500">{c.duration_sec ? fmtDur(c.duration_sec) : ''}</div>
                      </div>
                    </div>
                    {(c.outcome || c.recording_url || (c.status === 'missed' && l)) && (
                      <div className="mt-1.5 flex items-center gap-2">
                        {c.outcome && <span className="text-xs text-ink-500">{OUTCOME_LABEL[c.outcome]}</span>}
                        <span className="ml-auto flex gap-1.5">
                          {c.status === 'missed' && l && (
                            <Button size="sm" onClick={() => call(l)}>
                              <Icon name="phone" /> Call back
                            </Button>
                          )}
                          {c.recording_url && <Recording call={c} open={playing === c.id} toggle={() => setPlaying(playing === c.id ? '' : c.id)} />}
                        </span>
                      </div>
                    )}
                    {c.summary && (
                      <div className="mt-2">
                        <CallNotes call={c} compact />
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
            {rows.length > shown.length && (
              <button onClick={() => setLimit(limit + 100)} className="w-full border-t border-line px-4 py-3 text-xs font-medium text-ink-500 sm:hidden">
                Show more ({rows.length - shown.length} older)
              </button>
            )}
            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line">
                    <Th>When</Th>
                    <Th>Roofer</Th>
                    <Th>Line / source</Th>
                    <Th>Who</Th>
                    <Th>Result</Th>
                    <Th className="text-right">Length</Th>
                    <Th className="text-right">Recording</Th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((c) => {
                    const l = c.lead_id ? leadById.get(c.lead_id) : undefined
                    const n = c.number_id ? numberById.get(c.number_id) : undefined
                    const other = c.direction === 'out' ? c.to_number : c.from_number
                    return (
                      <Fragment key={c.id}>
                        <tr className="border-b border-line align-top last:border-0 hover:bg-panel">
                          <Td className="whitespace-nowrap text-ink-500">
                            <span className="inline-flex items-center gap-1.5">
                              <span className={`text-[11px] font-semibold ${c.direction === 'in' ? 'text-mist-600' : 'text-ink-400'}`}>{c.direction === 'in' ? 'IN' : 'OUT'}</span>
                              {ago(c.started_at)}
                            </span>
                          </Td>
                          <Td>
                            {l ? (
                              <button onClick={() => openContact(l.id)} className="text-left font-medium text-ink-900 hover:underline">
                                {l.company}
                              </button>
                            ) : (
                              <span className="font-medium text-ink-700">Unknown caller</span>
                            )}
                            <div className="text-xs text-ink-500">{prettyPhone(other)}</div>
                          </Td>
                          <Td className="text-ink-700">
                            <div>{n?.label || (c.via === 'cell' ? 'Own phone' : '—')}</div>
                            <div className="text-xs text-ink-400">{c.source}</div>
                          </Td>
                          <Td className="text-ink-700">{c.user_name || '—'}</Td>
                          <Td>
                            <Badge tone={CALL_STATUS_TONE[c.status]}>{CALL_STATUS_LABEL[c.status]}</Badge>
                            {c.outcome && <div className="mt-1 text-xs text-ink-500">{OUTCOME_LABEL[c.outcome]}</div>}
                            {c.status === 'missed' && (
                              <div className="mt-1.5 flex flex-wrap gap-1.5">
                                {l ? (
                                  <Button size="sm" onClick={() => call(l)}>
                                    <Icon name="phone" /> Call back
                                  </Button>
                                ) : (
                                  <Button size="sm" onClick={async () => openContact(await contactFromCall(c))}>
                                    Add as contact
                                  </Button>
                                )}
                                {calledBackAfter(c, data.calls) && <span className="text-xs text-sage-700">Called back</span>}
                              </div>
                            )}
                            {c.status !== 'missed' && !l && c.direction === 'in' && (
                              <button onClick={async () => openContact(await contactFromCall(c))} className="mt-1 block text-xs text-ink-500 underline">
                                Add as contact
                              </button>
                            )}
                          </Td>
                          <Td className="tabular whitespace-nowrap text-right text-ink-700">{c.status === 'live' ? 'Live' : c.duration_sec ? fmtDur(c.duration_sec) : '—'}</Td>
                          <Td className="text-right">
                            {c.recording_url ? (
                              <Recording call={c} open={playing === c.id} toggle={() => setPlaying(playing === c.id ? '' : c.id)} />
                            ) : (
                              <span className="text-xs text-ink-300">—</span>
                            )}
                            {(c.summary || c.transcript) && (
                              <button
                                onClick={() => setNotes(notes === c.id ? '' : c.id)}
                                className="mt-1.5 block w-full text-right text-xs font-medium text-accent-600 hover:underline"
                              >
                                {notes === c.id ? 'Hide notes' : 'Call notes'}
                              </button>
                            )}
                          </Td>
                        </tr>
                        {notes === c.id && (
                          <tr className="border-b border-line bg-panel">
                            <td colSpan={7} className="px-4 py-3">
                              <CallNotes call={c} />
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
              {rows.length > shown.length && (
                <button onClick={() => setLimit(limit + 100)} className="w-full border-t border-line px-4 py-3 text-xs font-medium text-ink-500 hover:bg-wash hover:text-ink-900">
                  Show more ({rows.length - shown.length} older)
                </button>
              )}
            </div>
          </>
        )}
      </Card>
      {backendNote(
        data.settings.call_via,
        data.numbers.some((n) => n.kind === 'line' && n.owner === me.name),
      )}
    </div>
  )
}

// What the transcriber pulled out of a recorded call.
export function CallNotes({ call, compact }: { call: Call; compact?: boolean }) {
  const [open, setOpen] = useState(false)
  const i = call.insights
  if (!call.summary && !call.transcript) return null
  return (
    <div className="space-y-1.5 text-sm">
      {call.summary && <p className="text-ink-800">{call.summary}</p>}
      {i?.error && <p className="text-xs text-clay-600">Transcriber: {i.error}</p>}
      {!compact && i && (
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-ink-600">
          {i.sentiment && <span>Mood: {i.sentiment}</span>}
          {i.pain && <span>Pain: {i.pain}</span>}
          {i.why_now && <span>Why now: “{i.why_now}”</span>}
          {i.objections && i.objections.length > 0 && <span>Objections: {i.objections.join(' · ')}</span>}
        </div>
      )}
      {i?.next_step && <p className="text-xs font-medium text-ink-900">Next: {i.next_step}</p>}
      {call.transcript && (
        <div>
          <button onClick={() => setOpen(!open)} className="text-xs text-ink-500 underline">
            {open ? 'Hide transcript' : 'Read transcript'}
          </button>
          {open && (
            <pre className="mt-1.5 max-h-72 overflow-y-auto whitespace-pre-wrap rounded-lg bg-white p-3 font-sans text-xs leading-relaxed text-ink-700 ring-1 ring-inset ring-line">
              {call.transcript}
            </pre>
          )}
        </div>
      )}
    </div>
  )
}

// A missed call counts as handled once anyone dials that roofer or number afterwards.
export function calledBackAfter(c: Call, all: Call[]) {
  return all.some((x) => x.direction === 'out' && x.started_at > c.started_at && ((c.lead_id && x.lead_id === c.lead_id) || digits(x.to_number) === digits(c.from_number)))
}

function Recording({ call, open, toggle }: { call: Call; open: boolean; toggle(): void }) {
  const [src, setSrc] = useState('')
  useEffect(() => {
    if (open) recordingSrc(call.recording_url, call.id).then(setSrc)
  }, [open, call])
  if (!open)
    return (
      <button onClick={toggle} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-ink-700 ring-1 ring-inset ring-line hover:bg-wash">
        <Icon name="play" className="h-3 w-3" /> Play
      </button>
    )
  return (
    <div className="flex items-center justify-end gap-2">
      {src ? (
        <audio src={src} controls autoPlay className="h-8 w-56" />
      ) : (
        <span className="text-xs text-ink-400">{call.recording_url === 'demo' ? 'Sample only. Real recordings play here.' : 'Loading…'}</span>
      )}
      <button onClick={toggle} aria-label="Close player" className="text-ink-400 hover:text-ink-900">
        <Icon name="x" className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

function backendNote(via: string, hasLine: boolean) {
  if (via === 'browser' && hasLine) return null
  return (
    <p className="mt-3 text-xs text-ink-400">
      {via === 'cell'
        ? 'Calling from your own phone: the CRM times each call and logs the result, but cannot record. Switch to browser calling in Settings once the phone carrier is connected.'
        : 'Add your calling line under Phone numbers to call from the browser.'}
    </p>
  )
}
