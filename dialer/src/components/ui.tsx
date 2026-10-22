import { useEffect, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { PAIN_LABEL, PAIN_TONE, STATUS_LABEL, STATUS_TONE } from '../lib/constants'
import type { Pain, Status } from '../lib/types'

const ICONS = {
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  phone: 'M5 4h3l2 5-2.5 1.5a11 11 0 0 0 6 6L15 14l5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zm0-13v4l3 2',
  users: 'M16 19v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M9 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm13 9v-1a4 4 0 0 0-3-3.9M16 4.1a3 3 0 0 1 0 5.8',
  upload: 'M12 15V3m0 0L7 8m5-5 5 5M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm7.4-3a7.4 7.4 0 0 0-.1-1.3l2-1.6-2-3.4-2.4 1a7 7 0 0 0-2.2-1.3L14.3 3h-4l-.4 2.4a7 7 0 0 0-2.2 1.3l-2.4-1-2 3.4 2 1.6a7.4 7.4 0 0 0 0 2.6l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 2.2 1.3l.4 2.4h4l.4-2.4a7 7 0 0 0 2.2-1.3l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.3z',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zm10 2-4.35-4.35',
  x: 'M18 6 6 18M6 6l12 12',
  check: 'M20 6 9 17l-5-5',
  message: 'M21 12a8 8 0 0 1-11.8 7L3 21l2-6.2A8 8 0 1 1 21 12z',
  bell: 'M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0',
  chevron: 'm9 18 6-6-6-6',
  calendar: 'M8 2v4m8-4v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z',
  skip: 'm5 4 10 8-10 8V4zm14 1v14',
  menu: 'M4 6h16M4 12h16M4 18h16',
  out: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4m7 14 5-5-5-5m5 5H9',
} as const

export type IconName = keyof typeof ICONS

export function Icon({ name, className = 'h-4 w-4' }: { name: IconName; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d={ICONS[name]} />
    </svg>
  )
}

export function StatusBadge({ status }: { status: Status }) {
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${STATUS_TONE[status]}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {STATUS_LABEL[status]}
    </span>
  )
}

export function PainBadge({ pain }: { pain: Pain }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs text-ink-700">
      <span className={`h-2 w-2 rounded-sm ${PAIN_TONE[pain]}`} />
      {PAIN_LABEL[pain]}
    </span>
  )
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; size?: 'sm' | 'md' }

export function Button({ variant = 'secondary', size = 'md', className = '', ...p }: BtnProps) {
  const v = {
    primary: 'bg-ink-900 text-white hover:bg-black disabled:bg-ink-300',
    secondary: 'bg-white text-ink-900 ring-1 ring-inset ring-line hover:bg-zinc-50 disabled:text-ink-300',
    ghost: 'text-ink-700 hover:bg-zinc-100',
    danger: 'bg-white text-rose-700 ring-1 ring-inset ring-rose-200 hover:bg-rose-50',
  }[variant]
  const s = size === 'sm' ? 'h-8 px-2.5 text-xs' : 'h-9 px-3.5 text-sm'
  return <button {...p} className={`inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors disabled:cursor-not-allowed ${v} ${s} ${className}`} />
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-xl bg-white shadow-card ${className}`}>{children}</div>
}

export function Stat({ label, value, sub, icon }: { label: string; value: ReactNode; sub?: ReactNode; icon: IconName }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-xs font-medium text-ink-500">
        <span className="grid h-6 w-6 place-items-center rounded-md bg-zinc-100 text-ink-700">
          <Icon name={icon} className="h-3.5 w-3.5" />
        </span>
        {label}
      </div>
      <div className="mt-3 text-[28px] font-semibold leading-none tracking-tight text-ink-900">{value}</div>
      {sub && <div className="mt-1.5 text-xs text-ink-500">{sub}</div>}
    </Card>
  )
}

export function PageHeader({ title, sub, actions }: { title: string; sub?: string; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-ink-900">{title}</h1>
        {sub && <p className="mt-0.5 text-sm text-ink-500">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose(): void; title: string; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-0 sm:items-center sm:p-4" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal
        aria-label={title}
        className={`max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl ${wide ? 'sm:max-w-2xl' : 'sm:max-w-md'}`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-ink-900">{title}</h2>
          <button onClick={onClose} className="rounded-md p-1 text-ink-500 hover:bg-zinc-100" aria-label="Close">
            <Icon name="x" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    // A div, not a label: a label would forward clicks to its first button (the quick-pick chips).
    <div role="group" aria-label={label}>
      <span className="mb-1 block text-xs font-medium text-ink-700">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-ink-400">{hint}</span>}
    </div>
  )
}

export const inputCls =
  'w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink-900 placeholder:text-ink-400 focus:border-ink-400 focus:outline-none focus:ring-2 focus:ring-zinc-200'

export function Select({ value, onChange, options, className = '' }: { value: string; onChange(v: string): void; options: [string, string][]; className?: string }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={`h-9 rounded-lg border border-line bg-white px-2.5 text-sm text-ink-900 focus:outline-none focus:ring-2 focus:ring-zinc-200 ${className}`}>
      {options.map(([v, l]) => (
        <option key={v} value={v}>
          {l}
        </option>
      ))}
    </select>
  )
}

export function Empty({ title, sub, action }: { title: string; sub?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="text-sm font-medium text-ink-900">{title}</div>
      {sub && <div className="mt-1 max-w-sm text-sm text-ink-500">{sub}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function Logo({ className = 'h-7 w-7' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <rect width="32" height="32" rx="8" fill="#111113" />
      <path d="M11 9.5c.6-.6 1.6-.6 2.2 0l2 2c.6.6.6 1.6 0 2.2l-1 1a9 9 0 0 0 3.1 3.1l1-1c.6-.6 1.6-.6 2.2 0l2 2c.6.6.6 1.6 0 2.2l-1.2 1.2c-1 1-2.5 1.2-3.7.6A16 16 0 0 1 9.4 15c-.6-1.2-.4-2.7.6-3.7z" fill="#fff" />
    </svg>
  )
}
