import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { Icon } from './ui'
import { backend } from '../lib/backend'
import { placeCall, type ActiveCall, type PhoneState } from '../lib/phone'
import { prettyPhone } from '../lib/format'
import type { Lead } from '../lib/types'
import { useData } from '../lib/store'

interface Live {
  callId: string
  lead: Lead
  state: PhoneState
  connectedAt: number | null
  endedSec: number
  muted: boolean
  error: string
  via: 'cell' | 'browser'
}

interface CallCtx {
  live: Live | null
  call(lead: Lead): void
  hangup(): void
  // Close the bar once the outcome is logged.
  done(leadId: string): void
}

const Ctx = createContext<CallCtx | null>(null)
export function useCall(): CallCtx {
  const c = useContext(Ctx)
  if (!c) throw new Error('useCall outside CallProvider')
  return c
}

export const fmtDur = (sec: number) =>
  sec >= 3600 ? `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m` : `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`

export function CallProvider({ children }: { children: ReactNode }) {
  const { data, startCall, endCall } = useData()
  const [live, setLive] = useState<Live | null>(null)
  const handle = useRef<ActiveCall | null>(null)
  const liveRef = useRef<Live | null>(null)
  liveRef.current = live

  const via = data.settings.call_via === 'browser' ? 'browser' : 'cell'

  const call = useCallback(
    async (lead: Lead) => {
      const cur = liveRef.current
      if (cur && cur.state !== 'ended') return
      const row = await startCall(lead, via)
      const base: Live = {
        callId: row.id,
        lead,
        state: 'ringing',
        connectedAt: null,
        endedSec: 0,
        muted: false,
        error: '',
        via,
      }
      setLive(base)
      if (via === 'browser' && backend.mode === 'live' && !row.from_number) {
        setLive({
          ...base,
          state: 'ended',
          error: 'Add your calling line under Phone numbers first.',
        })
        return
      }
      try {
        handle.current = await placeCall({
          to: lead.phone,
          from: row.from_number,
          callId: row.id,
          via,
          record: data.settings.record_calls,
          onState: (s, error) =>
            setLive((l) => {
              if (!l || l.callId !== row.id) return l
              if (s === 'live')
                return {
                  ...l,
                  state: 'live',
                  connectedAt: l.connectedAt ?? Date.now(),
                }
              if (s === 'ended') {
                const sec = l.connectedAt ? (Date.now() - l.connectedAt) / 1000 : 0
                endCall(row.id, sec)
                return {
                  ...l,
                  state: 'ended',
                  endedSec: sec,
                  error: error || '',
                }
              }
              return { ...l, state: s }
            }),
        })
      } catch (e: any) {
        endCall(row.id, 0)
        setLive({
          ...base,
          state: 'ended',
          error: e?.message || 'Call failed',
        })
      }
    },
    [via, startCall, endCall, data.settings.record_calls],
  )

  const hangup = useCallback(() => handle.current?.hangup(), [])
  const done = useCallback((leadId: string) => {
    const l = liveRef.current
    if (!l || l.lead.id !== leadId) return
    if (l.state !== 'ended') handle.current?.hangup()
    setLive(null)
  }, [])

  return (
    <Ctx.Provider value={{ live, call, hangup, done }}>
      {children}
      {live && (
        <CallBar
          live={live}
          hangup={hangup}
          mute={() => {
            handle.current?.mute(!live.muted)
            setLive({ ...live, muted: !live.muted })
          }}
          close={() => setLive(null)}
        />
      )}
    </Ctx.Provider>
  )
}

function CallBar({ live, hangup, mute, close }: { live: Live; hangup(): void; mute(): void; close(): void }) {
  const [, tick] = useState(0)
  useEffect(() => {
    if (live.state !== 'live') return
    const t = setInterval(() => tick((n) => n + 1), 1000)
    return () => clearInterval(t)
  }, [live.state])
  const sec = live.state === 'live' && live.connectedAt ? (Date.now() - live.connectedAt) / 1000 : live.endedSec
  const label =
    live.state === 'ringing' ? 'Ringing…' : live.state === 'live' ? (live.via === 'cell' ? 'On your phone' : 'Connected') : live.error ? live.error : 'Call ended · log the outcome'
  return (
    <div role="status" className="fixed inset-x-3 bottom-3 z-40 mx-auto flex max-w-xl items-center gap-3 rounded-2xl bg-ink-900 px-4 py-3 text-white shadow-panel lg:left-[248px]">
      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${live.state === 'live' ? 'bg-sage-600' : live.state === 'ringing' ? 'bg-sand-600' : 'bg-white/10'}`}>
        <Icon name="phone" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold">{live.lead.company}</div>
        <div className="truncate text-xs text-white/60">
          {prettyPhone(live.lead.phone)} · {label}
        </div>
      </div>
      <span className="tabular text-sm font-semibold">{fmtDur(sec)}</span>
      {live.state !== 'ended' ? (
        <>
          {live.via === 'browser' && (
            <button
              onClick={mute}
              className={`rounded-lg px-2.5 py-1.5 text-xs font-medium ring-1 ring-inset ring-white/20 ${live.muted ? 'bg-white text-ink-900' : 'text-white hover:bg-white/10'}`}
            >
              {live.muted ? 'Muted' : 'Mute'}
            </button>
          )}
          <button onClick={hangup} className="rounded-lg bg-clay-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-clay-700">
            {live.via === 'cell' ? 'Hung up' : 'Hang up'}
          </button>
        </>
      ) : (
        <button onClick={close} aria-label="Close" className="text-white/60 hover:text-white">
          <Icon name="x" />
        </button>
      )}
    </div>
  )
}
