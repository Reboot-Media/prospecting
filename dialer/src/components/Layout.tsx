import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Avatar, Icon, Kbd, Logo } from './ui'
import { useData } from '../lib/store'
import { backend } from '../lib/backend'
import { NAV, sectionOf, type Route } from '../lib/router'
import { digits, fullName } from '../lib/format'

export interface Badges {
  calls: number
  tasks: number
  inbox: number
  approvals: number
}

export function Layout({
  route,
  go,
  openContact,
  children,
  badges,
}: {
  route: Route
  go(r: Route, id?: string): void
  openContact(id: string): void
  children: ReactNode
  badges: Badges
}) {
  const { me, data, signOut } = useData()
  const [open, setOpen] = useState(false)
  const [palette, setPalette] = useState(false)

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPalette((p) => !p)
      }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])

  const badgeFor = (k: Route, active: boolean): ReactNode => {
    const n = k === 'tasks' ? badges.tasks : k === 'calls' ? badges.calls : k === 'inbox' ? badges.inbox : k === 'approvals' ? badges.approvals : 0
    if (k === 'contacts') return <span className={`tabular text-[11px] ${active ? 'text-white/60' : 'text-ink-400'}`}>{data.leads.length}</span>
    if (!n) return null
    const warm = k === 'tasks'
    return (
      <span
        className={`tabular rounded-full px-1.5 text-[10px] font-semibold ${active ? 'bg-white/90 text-ink-900' : warm ? 'bg-sand-50 text-sand-700 ring-1 ring-inset ring-sand-400/40' : 'bg-accent-50 text-accent-700 ring-1 ring-inset ring-accent-400/30'}`}
      >
        {n}
      </span>
    )
  }

  const active = route === 'contact' ? 'contacts' : route

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 rounded-xl bg-white p-2 shadow-card">
        <Logo className="h-8 w-8" />
        <div className="min-w-0 flex-1 leading-tight">
          <div className="truncate text-sm font-semibold text-ink-900">Reboot Media</div>
          <div className="truncate text-[11px] text-ink-500">Sales CRM · {backend.mode === 'demo' ? 'Demo data' : 'Live'}</div>
        </div>
      </div>
      <button onClick={() => setPalette(true)} className="mt-3 flex h-8 items-center gap-2 rounded-lg border border-line bg-white px-2.5 text-xs text-ink-400 hover:text-ink-700">
        <Icon name="search" className="h-3.5 w-3.5" />
        <span className="flex-1 text-left">Search</span>
        <Kbd>⌘K</Kbd>
      </button>
      <nav className="scroll-thin -mx-1 mt-2 flex-1 overflow-y-auto px-1">
        {NAV.map((s) => (
          <div key={s.section}>
            <div className="px-2 pb-1 pt-4 text-[10.5px] font-medium uppercase tracking-wider text-ink-400">{s.section}</div>
            <div className="space-y-px">
              {s.items.map((n) => {
                const on = active === n.key
                return (
                  <button
                    key={n.key}
                    onClick={() => {
                      go(n.key)
                      setOpen(false)
                    }}
                    className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[13px] transition-colors ${on ? 'bg-ink-900 font-medium text-white' : 'text-ink-700 hover:bg-white/70'}`}
                  >
                    <Icon name={n.icon} className={`h-4 w-4 ${on ? 'text-white' : 'text-ink-400'}`} />
                    <span className="flex-1 text-left">{n.label}</span>
                    {badgeFor(n.key, on)}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </nav>
      <div className="mt-3 flex items-center gap-2.5 rounded-xl bg-white p-2 shadow-card">
        <Avatar name={me.name} className="h-8 w-8 text-[11px]" />
        <div className="min-w-0 flex-1 leading-tight">
          <div className="truncate text-sm font-medium text-ink-900">{me.name}</div>
          <div className="truncate text-[11px] text-ink-500">{me.email || 'Caller'}</div>
        </div>
        <button onClick={signOut} className="rounded-md p-1.5 text-ink-400 hover:bg-wash hover:text-ink-700" title="Sign out" aria-label="Sign out">
          <Icon name="out" />
        </button>
      </div>
    </div>
  )

  const { section, label } = sectionOf(route)

  return (
    <div className="min-h-screen bg-canvas lg:p-3">
      <div className="mx-auto flex min-h-[calc(100vh-1.5rem)] max-w-[1480px] overflow-hidden bg-panel lg:rounded-2xl lg:shadow-panel lg:ring-1 lg:ring-black/5">
        <aside className="hidden w-[236px] shrink-0 border-r border-line bg-panel p-3 lg:block">
          <div className="sticky top-3 h-[calc(100vh-3rem)]">{sidebar}</div>
        </aside>
        {open && (
          <div className="fixed inset-0 z-40 bg-ink-900/25 lg:hidden" onClick={() => setOpen(false)}>
            <aside className="h-full w-[260px] bg-panel p-3" onClick={(e) => e.stopPropagation()}>
              {sidebar}
            </aside>
          </div>
        )}
        <main className="min-w-0 flex-1 bg-white lg:rounded-l-none">
          <div className="sticky top-0 z-30 flex h-12 items-center gap-3 border-b border-line bg-white/90 px-4 backdrop-blur sm:px-6">
            <button onClick={() => setOpen(true)} className="-ml-1 rounded-md p-1.5 text-ink-700 hover:bg-wash lg:hidden" aria-label="Menu">
              <Icon name="menu" className="h-5 w-5" />
            </button>
            <div className="flex min-w-0 items-center gap-1.5 text-xs text-ink-400">
              <span className="hidden sm:inline">{section}</span>
              <Icon name="chevron" className="hidden h-3 w-3 sm:block" />
              <span className="truncate font-medium text-ink-900">{label}</span>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={() => setPalette(true)}
                className="hidden h-8 w-56 items-center gap-2 rounded-lg border border-line bg-wash px-2.5 text-xs text-ink-400 hover:text-ink-700 md:flex"
              >
                <Icon name="search" className="h-3.5 w-3.5" />
                <span className="flex-1 text-left">Find a roofer…</span>
                <Kbd>⌘K</Kbd>
              </button>
              <button onClick={() => setPalette(true)} className="rounded-lg p-2 text-ink-500 hover:bg-wash md:hidden" aria-label="Search">
                <Icon name="search" />
              </button>
              <button onClick={() => go('tasks')} className="relative rounded-lg p-2 text-ink-500 hover:bg-wash" aria-label="Tasks due">
                <Icon name="bell" />
                {badges.tasks > 0 && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-sand-400 ring-2 ring-white" />}
              </button>
              <button onClick={() => go('dial')} className="hidden h-8 items-center gap-1.5 rounded-lg bg-ink-900 px-3 text-xs font-medium text-white hover:bg-black sm:flex">
                <Icon name="phone" className="h-3.5 w-3.5" /> Start dialing
              </button>
            </div>
          </div>
          <div className="px-4 py-5 sm:px-6 lg:px-8 lg:py-6">{children}</div>
        </main>
      </div>
      {palette && <Palette close={() => setPalette(false)} go={go} openContact={openContact} />}
    </div>
  )
}

function Palette({ close, go, openContact }: { close(): void; go(r: Route): void; openContact(id: string): void }) {
  const { data } = useData()
  const [q, setQ] = useState('')
  const [i, setI] = useState(0)
  const results = useMemo(() => {
    const s = q.trim().toLowerCase()
    const pages = NAV.flatMap((n) => n.items).filter((n) => !s || n.label.toLowerCase().includes(s))
    const d = digits(s)
    const people = !s
      ? []
      : data.leads.filter((l) => `${l.company} ${fullName(l)} ${l.city} ${l.email}`.toLowerCase().includes(s) || (d.length >= 3 && digits(l.phone).includes(d))).slice(0, 8)
    return [
      ...people.map((l) => ({
        key: l.id,
        label: l.company,
        sub: `${fullName(l)} · ${l.city}`,
        run: () => openContact(l.id),
      })),
      ...pages.slice(0, s ? 5 : 18).map((p) => ({
        key: p.key,
        label: p.label,
        sub: 'Go to page',
        run: () => go(p.key),
      })),
    ]
  }, [q, data.leads, go, openContact])

  useEffect(() => setI(0), [q])
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && close()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [close])

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-ink-900/25 p-4 pt-[12vh]" onMouseDown={close}>
      <div
        role="dialog"
        aria-label="Search"
        className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-panel ring-1 ring-black/5"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-line px-4">
          <Icon name="search" className="text-ink-400" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') setI((x) => Math.min(results.length - 1, x + 1))
              if (e.key === 'ArrowUp') setI((x) => Math.max(0, x - 1))
              if (e.key === 'Enter' && results[i]) {
                results[i].run()
                close()
              }
            }}
            placeholder="Company, owner, city, phone or page"
            className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-ink-400"
          />
          <Kbd>esc</Kbd>
        </div>
        <div className="max-h-80 overflow-y-auto p-1.5">
          {results.length === 0 && <div className="p-6 text-center text-sm text-ink-500">Nothing matches.</div>}
          {results.map((r, k) => (
            <button
              key={r.key}
              onMouseEnter={() => setI(k)}
              onClick={() => {
                r.run()
                close()
              }}
              className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm ${k === i ? 'bg-wash' : ''}`}
            >
              <span className="truncate font-medium text-ink-900">{r.label}</span>
              <span className="ml-3 truncate text-xs text-ink-400">{r.sub}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
