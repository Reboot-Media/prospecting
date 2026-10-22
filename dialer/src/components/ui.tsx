import { useEffect, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { PAIN_DOT, PAIN_LABEL, STATUS_LABEL, STATUS_TONE, TONE, type Tone } from '../lib/constants'
import type { Pain, Status } from '../lib/types'

const ICONS = {
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  phone: 'M5 4h3l2 5-2.5 1.5a11 11 0 0 0 6 6L15 14l5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zm0-13v4l3 2',
  users: 'M16 19v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M9 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm13 9v-1a4 4 0 0 0-3-3.9M16 4.1a3 3 0 0 1 0 5.8',
  upload: 'M12 15V3m0 0L7 8m5-5 5 5M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4',
  settings:
    'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm7.4-3a7.4 7.4 0 0 0-.1-1.3l2-1.6-2-3.4-2.4 1a7 7 0 0 0-2.2-1.3L14.3 3h-4l-.4 2.4a7 7 0 0 0-2.2 1.3l-2.4-1-2 3.4 2 1.6a7.4 7.4 0 0 0 0 2.6l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 2.2 1.3l.4 2.4h4l.4-2.4a7 7 0 0 0 2.2-1.3l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.3z',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zm10 2-4.35-4.35',
  x: 'M18 6 6 18M6 6l12 12',
  check: 'M20 6 9 17l-5-5',
  message: 'M21 12a8 8 0 0 1-11.8 7L3 21l2-6.2A8 8 0 1 1 21 12z',
  bell: 'M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0',
  chevron: 'm9 18 6-6-6-6',
  left: 'm15 18-6-6 6-6',
  down: 'm6 9 6 6 6-6',
  calendar: 'M8 2v4m8-4v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z',
  skip: 'm5 4 10 8-10 8V4zm14 1v14',
  menu: 'M4 6h16M4 12h16M4 18h16',
  out: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4m7 14 5-5-5-5m5 5H9',
  inbox: 'M22 12h-6l-2 3h-4l-2-3H2m3.5-7h13L22 12v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6z',
  mail: 'M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zm-1 1 9 7 9-7',
  kanban: 'M4 4h4v16H4zM10 4h4v10h-4zM16 4h4v13h-4z',
  task: 'M9 11l3 3 8-8M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9',
  flow: 'M6 3v6m0 0a3 3 0 1 0 0 6 3 3 0 0 0 0-6zm0 6h7a5 5 0 0 1 5 5v1m0 0a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  send: 'm22 2-7 20-4-9-9-4zm0 0L11 13',
  approve: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10zm-3-10 2 2 4-4',
  file: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zm0 0v6h6M8 13h8M8 17h5',
  layers: 'm12 2 10 6-10 6L2 8zm-10 11 10 6 10-6',
  chart: 'M3 3v18h18M8 17V11m5 6V7m5 10v-4',
  form: 'M4 4h16v16H4zM8 9h8M8 13h8M8 17h4',
  plug: 'M9 2v6m6-6v6M6 8h12v3a6 6 0 0 1-12 0zm6 9v5',
  plus: 'M12 5v14M5 12h14',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zm10 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  cursor: 'm4 4 7 17 2.5-7.5L21 11z',
  reply: 'M9 14 4 9l5-5M4 9h10a6 6 0 0 1 6 6v5',
  alert: 'M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
  pause: 'M8 5h3v14H8zM13 5h3v14h-3z',
  play: 'M6 4l14 8-14 8z',
  filter: 'M3 5h18l-7 8v6l-4 2v-8z',
  link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  trash: 'M3 6h18M8 6V4h8v2m-9 0 1 14h8l1-14',
  bolt: 'M13 2 3 14h9l-1 8 10-12h-9z',
  globe: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18',
  dollar: 'M12 2v20M17 6H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6',
  calls: 'M5 4h3l2 5-2.5 1.5a11 11 0 0 0 6 6L15 14l5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2m10-1v5h5m-5 0 6-6',
  hash: 'M5 9h14M4 15h14M10 3 8 21M16 3l-2 18',
  tag: 'M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8zM7.5 7.5h.01',
  split: 'M12 3v6m0 0-6 6v6m6-12 6 6v6',
  stop: 'M7 7h10v10H7z',
  script: 'M8 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-3m4-13a2 2 0 0 0-2 2v11m2-13H6a2 2 0 0 0-2 2v2h4M11 8h6M11 12h6M11 16h3',
  star: 'm12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2l1.1-6.2L3 9.6l6.2-.9z',
  target: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zm0-4a5 5 0 1 0 0-10 5 5 0 0 0 0 10zm0-4a1 1 0 1 0 0-2 1 1 0 0 0 0 2z',
  sliders: 'M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0M14 4v4M8 10v4M16 16v4',
} as const

export type IconName = keyof typeof ICONS

export function Icon({ name, className = 'h-4 w-4' }: { name: IconName; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d={ICONS[name]} />
    </svg>
  )
}

export function Badge({ tone = 'stone', children, dot = true }: { tone?: Tone; children: ReactNode; dot?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${TONE[tone]}`}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current opacity-60" />}
      {children}
    </span>
  )
}

export function StatusBadge({ status }: { status: Status }) {
  return <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>
}

export function PainBadge({ pain }: { pain: Pain }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs text-ink-700">
      <span className={`h-2 w-2 rounded-sm ${PAIN_DOT[pain]}`} />
      {PAIN_LABEL[pain]}
    </span>
  )
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'accent'
  size?: 'sm' | 'md'
}

export function Button({ variant = 'secondary', size = 'md', className = '', ...p }: BtnProps) {
  const v = {
    primary: 'bg-ink-900 text-white hover:bg-black disabled:bg-ink-300',
    accent: 'bg-accent-600 text-white hover:bg-accent-700 disabled:bg-accent-200',
    secondary: 'bg-white text-ink-900 ring-1 ring-inset ring-line hover:bg-wash disabled:text-ink-300',
    ghost: 'text-ink-700 hover:bg-wash',
    danger: 'bg-white text-clay-700 ring-1 ring-inset ring-clay-400/40 hover:bg-clay-50',
  }[variant]
  const s = size === 'sm' ? 'h-8 px-2.5 text-xs' : 'h-9 px-3.5 text-sm'
  return <button {...p} className={`inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors disabled:cursor-not-allowed ${v} ${s} ${className}`} />
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-xl bg-white shadow-card ${className}`}>{children}</div>
}

export function CardHead({ title, sub, actions }: { title: ReactNode; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 pb-2 pt-3.5">
      <div className="min-w-0">
        <div className="text-sm font-semibold text-ink-900">{title}</div>
        {sub && <div className="text-xs text-ink-500">{sub}</div>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  )
}

// A row of numbers that share one card, split by hairlines (like the inspiration's stat strips).
export function StatStrip({
  items,
}: {
  items: {
    label: string
    value: ReactNode
    sub?: ReactNode
    icon?: IconName
    delta?: { text: string; good: boolean }
  }[]
}) {
  return (
    <Card className="grid grid-cols-2 divide-line overflow-hidden md:grid-cols-4 md:divide-x [&>*:nth-child(n+3)]:border-t [&>*:nth-child(n+3)]:border-line md:[&>*:nth-child(n+3)]:border-t-0 [&>*:nth-child(even)]:border-l [&>*:nth-child(even)]:border-line md:[&>*:nth-child(even)]:border-l-0">
      {items.map((s) => (
        <div key={s.label} className="p-4">
          <div className="flex items-center gap-1.5 text-xs font-medium text-ink-500">
            {s.icon && <Icon name={s.icon} className="h-3.5 w-3.5 text-ink-400" />}
            {s.label}
            {s.delta && (
              <span className={`ml-auto rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${s.delta.good ? 'bg-sage-50 text-sage-700' : 'bg-clay-50 text-clay-700'}`}>
                {s.delta.text}
              </span>
            )}
          </div>
          <div className="tabular mt-2 text-[26px] font-semibold leading-none tracking-tight text-ink-900">{s.value}</div>
          {s.sub && <div className="mt-1.5 text-xs text-ink-500">{s.sub}</div>}
        </div>
      ))}
    </Card>
  )
}

export function PageHeader({ title, sub, actions }: { title: string; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-[22px] font-semibold tracking-tight text-ink-900">{title}</h1>
        {sub && <p className="mt-0.5 text-sm text-ink-500">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function Tabs<T extends string>({ value, onChange, items }: { value: T; onChange(v: NoInfer<T>): void; items: { key: NoInfer<T>; label: ReactNode; count?: number }[] }) {
  return (
    <div className="inline-flex max-w-full gap-0.5 overflow-x-auto rounded-lg bg-wash p-0.5 ring-1 ring-inset ring-line">
      {items.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={`flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${value === t.key ? 'bg-white text-ink-900 shadow-card' : 'text-ink-500 hover:text-ink-900'}`}
        >
          {t.label}
          {t.count !== undefined && <span className="tabular text-[10px] text-ink-400">{t.count}</span>}
        </button>
      ))}
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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink-900/25 p-0 sm:items-center sm:p-4" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal
        aria-label={title}
        className={`max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-panel sm:rounded-2xl ${wide ? 'sm:max-w-2xl' : 'sm:max-w-md'}`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-ink-900">{title}</h2>
          <button onClick={onClose} className="rounded-md p-1 text-ink-500 hover:bg-wash" aria-label="Close">
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
  'w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink-900 placeholder:text-ink-400 focus:border-ink-400 focus:outline-none focus:ring-2 focus:ring-accent-100'

export function Select({
  value,
  onChange,
  options,
  className = '',
  label,
}: {
  value: string
  onChange(v: string): void
  options: [string, string][]
  className?: string
  label?: string
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`h-8 rounded-lg border border-line bg-white px-2 text-xs font-medium text-ink-700 focus:outline-none focus:ring-2 focus:ring-accent-100 ${className}`}
    >
      {options.map(([v, l]) => (
        <option key={v} value={v}>
          {l}
        </option>
      ))}
    </select>
  )
}

export function SearchInput({ value, onChange, placeholder = 'Search…', className = '' }: { value: string; onChange(v: string): void; placeholder?: string; className?: string }) {
  return (
    <div className={`relative ${className}`}>
      <Icon name="search" className="pointer-events-none absolute left-2.5 top-2 h-4 w-4 text-ink-400" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-8 w-full rounded-lg border border-line bg-white pl-8 pr-3 text-xs text-ink-900 placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-accent-100"
      />
    </div>
  )
}

export function Empty({ title, sub, action }: { title: string; sub?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <div className="text-sm font-medium text-ink-900">{title}</div>
      {sub && <div className="mt-1 max-w-sm text-sm text-ink-500">{sub}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function Avatar({ name, className = 'h-7 w-7 text-[10px]' }: { name: string; className?: string }) {
  const initials = name
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
  const hues = ['bg-accent-100 text-accent-700', 'bg-sage-50 text-sage-700', 'bg-sand-50 text-sand-700', 'bg-mist-50 text-mist-700', 'bg-clay-50 text-clay-700']
  const h = hues[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % hues.length]
  return <span className={`grid shrink-0 place-items-center rounded-full font-semibold ring-1 ring-inset ring-black/5 ${h} ${className}`}>{initials || '?'}</span>
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="rounded border border-line bg-wash px-1 font-sans text-[10px] font-medium text-ink-500">{children}</kbd>
}

// Thin progress bar.
export function Meter({ value, max, tone = 'accent' }: { value: number; max: number; tone?: 'accent' | 'sage' | 'sand' | 'clay' }) {
  const pct = Math.max(0, Math.min(100, max ? (value / max) * 100 : 0))
  const c = {
    accent: 'bg-accent-500',
    sage: 'bg-sage-400',
    sand: 'bg-sand-400',
    clay: 'bg-clay-400',
  }[tone]
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-wash ring-1 ring-inset ring-line">
      <div className={`h-full rounded-full ${c}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

// Dot-matrix bar chart, the inspiration's signature chart. Each column is a day,
// filled dots show the value, faint dots show the empty part of the scale.
export function DotBars({ data, rows = 12, height = 150 }: { data: { label: string; value: number; highlight?: boolean }[]; rows?: number; height?: number }) {
  const max = Math.max(1, ...data.map((d) => d.value))
  const step = Math.ceil(max / rows)
  return (
    <div>
      <div className="flex items-end gap-[3px] sm:gap-1" style={{ height }}>
        {data.map((d) => {
          const filled = Math.round(d.value / step)
          return (
            <div key={d.label} className="group relative flex flex-1 flex-col-reverse gap-[3px]" title={`${d.label}: ${d.value}`}>
              {Array.from({ length: rows }).map((_, i) => (
                <span key={i} className={`mx-auto aspect-square w-full max-w-[9px] rounded-full ${i < filled ? (d.highlight ? 'bg-accent-600' : 'bg-accent-400') : 'bg-wash'}`} />
              ))}
            </div>
          )
        })}
      </div>
      <div className="mt-2 flex gap-[3px] text-[10px] text-ink-400 sm:gap-1">
        {data.map((d, i) => (
          <span key={d.label} className="flex-1 truncate text-center">
            {i % Math.ceil(data.length / 7) === 0 || i === data.length - 1 ? d.label : ''}
          </span>
        ))}
      </div>
    </div>
  )
}

export function Logo({ className = 'h-7 w-7' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <rect width="32" height="32" rx="8" fill="#1c1b19" />
      <path
        d="M11 9.5c.6-.6 1.6-.6 2.2 0l2 2c.6.6.6 1.6 0 2.2l-1 1a9 9 0 0 0 3.1 3.1l1-1c.6-.6 1.6-.6 2.2 0l2 2c.6.6.6 1.6 0 2.2l-1.2 1.2c-1 1-2.5 1.2-3.7.6A16 16 0 0 1 9.4 15c-.6-1.2-.4-2.7.6-3.7z"
        fill="#fafaf8"
      />
    </svg>
  )
}

export function Th({ children, className = '' }: { children?: ReactNode; className?: string }) {
  return <th className={`whitespace-nowrap px-4 py-2 text-left text-[11px] font-medium text-ink-400 ${className}`}>{children}</th>
}
export function Td({ children, className = '' }: { children?: ReactNode; className?: string }) {
  return <td className={`px-4 py-2.5 ${className}`}>{children}</td>
}

export const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 1000) / 10}%` : '–')
