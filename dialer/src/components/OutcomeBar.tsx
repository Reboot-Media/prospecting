import { useEffect, useState } from 'react'
import { OUTCOMES } from '../lib/constants'
import type { Lead, Outcome } from '../lib/types'
import { useData } from '../lib/store'
import { BookedModal, CallbackModal } from './OutcomeModals'

// One click per call. Call back and Booked open a short form; everything else saves at once.
export function OutcomeBar({ lead, onLogged, hotkeys }: { lead: Lead; onLogged(o: Outcome): void; hotkeys?: boolean }) {
  const { logOutcome } = useData()
  const [modal, setModal] = useState<'callback' | 'booked' | null>(null)
  const [busy, setBusy] = useState(false)
  const [armDnc, setArmDnc] = useState(false) // Do not call needs a second click
  useEffect(() => setArmDnc(false), [lead.id])

  async function pick(o: Outcome) {
    if (o === 'callback' || o === 'booked') return setModal(o)
    if (o === 'dnc' && !armDnc) return setArmDnc(true)
    setArmDnc(false)
    setBusy(true)
    await logOutcome(lead, o)
    setBusy(false)
    onLogged(o)
  }

  useEffect(() => {
    if (!hotkeys) return
    const h = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (modal || e.metaKey || e.ctrlKey || e.altKey || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName)) return
      const o = OUTCOMES.find((x) => x.hotkey === e.key)
      if (o) {
        e.preventDefault()
        pick(o.key)
      }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  })

  const tone = (k: Outcome) =>
    k === 'booked'
      ? 'bg-ink-900 text-white hover:bg-black ring-ink-900'
      : k === 'callback'
        ? 'bg-amber-50 text-amber-900 ring-amber-200 hover:bg-amber-100'
        : k === 'dnc' || k === 'bad_number'
          ? 'bg-white text-rose-700 ring-rose-200 hover:bg-rose-50'
          : 'bg-white text-ink-900 ring-line hover:bg-zinc-50'

  return (
    <>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {OUTCOMES.map((o) => (
          <button
            key={o.key}
            disabled={busy}
            onClick={() => pick(o.key)}
            className={`flex h-11 items-center justify-between rounded-lg px-3 text-sm font-medium ring-1 ring-inset transition-colors disabled:opacity-50 ${tone(o.key)}`}
          >
            {o.key === 'dnc' && armDnc ? 'Click again to confirm' : o.label}
            {hotkeys && <kbd className="hidden rounded border border-current/20 px-1 font-sans text-[10px] opacity-60 sm:inline">{o.hotkey}</kbd>}
          </button>
        ))}
      </div>
      <CallbackModal lead={lead} open={modal === 'callback'} onClose={() => setModal(null)} onDone={() => (setModal(null), onLogged('callback'))} />
      <BookedModal lead={lead} open={modal === 'booked'} onClose={() => setModal(null)} onDone={() => (setModal(null), onLogged('booked'))} />
    </>
  )
}
