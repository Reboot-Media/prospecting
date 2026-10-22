import { useState, type ReactNode } from 'react'
import { Icon, Logo, type IconName } from './ui'
import { useData } from '../lib/store'
import { backend } from '../lib/backend'

export type Route = 'today' | 'dial' | 'callbacks' | 'leads' | 'import' | 'settings'

const NAV: { key: Route; label: string; icon: IconName }[] = [
  { key: 'today', label: 'Today', icon: 'home' },
  { key: 'dial', label: 'Dial', icon: 'phone' },
  { key: 'callbacks', label: 'Callbacks', icon: 'clock' },
  { key: 'leads', label: 'Leads', icon: 'users' },
]
const NAV2: { key: Route; label: string; icon: IconName }[] = [
  { key: 'import', label: 'Import', icon: 'upload' },
  { key: 'settings', label: 'Settings', icon: 'settings' },
]

export function Layout({ route, go, children, dueCount }: { route: Route; go(r: Route): void; children: ReactNode; dueCount: number }) {
  const { me, data, signOut } = useData()
  const [open, setOpen] = useState(false)

  const item = (n: { key: Route; label: string; icon: IconName }, badge?: ReactNode) => (
    <button
      key={n.key}
      onClick={() => {
        go(n.key)
        setOpen(false)
      }}
      className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors ${
        route === n.key ? 'bg-ink-900 font-medium text-white' : 'text-ink-700 hover:bg-zinc-100'
      }`}
    >
      <Icon name={n.icon} />
      <span className="flex-1 text-left">{n.label}</span>
      {badge}
    </button>
  )

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 px-2 pb-5 pt-1">
        <Logo />
        <div className="leading-tight">
          <div className="text-sm font-semibold text-ink-900">Reboot Dialer</div>
          <div className="text-[11px] text-ink-500">{backend.mode === 'demo' ? 'Demo data' : 'Live'}</div>
        </div>
      </div>
      <div className="px-2 pb-1.5 text-[11px] font-medium uppercase tracking-wide text-ink-400">Work</div>
      <nav className="space-y-0.5">
        {NAV.map((n) =>
          item(
            n,
            n.key === 'callbacks' && dueCount > 0 ? (
              <span className={`rounded-full px-1.5 text-[11px] font-semibold ${route === n.key ? 'bg-white text-ink-900' : 'bg-amber-100 text-amber-800'}`}>{dueCount}</span>
            ) : n.key === 'leads' ? (
              <span className={`text-[11px] ${route === n.key ? 'text-white/70' : 'text-ink-400'}`}>{data.leads.length}</span>
            ) : undefined,
          ),
        )}
      </nav>
      <div className="px-2 pb-1.5 pt-5 text-[11px] font-medium uppercase tracking-wide text-ink-400">Setup</div>
      <nav className="space-y-0.5">{NAV2.map((n) => item(n))}</nav>
      <div className="mt-auto flex items-center gap-2.5 rounded-xl bg-zinc-50 p-2.5 ring-1 ring-inset ring-line">
        <div className="grid h-8 w-8 place-items-center rounded-full bg-ink-900 text-xs font-semibold text-white">{me.name.slice(0, 2).toUpperCase()}</div>
        <div className="min-w-0 flex-1 leading-tight">
          <div className="truncate text-sm font-medium text-ink-900">{me.name}</div>
          <div className="truncate text-[11px] text-ink-500">{me.email || 'Caller'}</div>
        </div>
        <button onClick={signOut} className="rounded-md p-1.5 text-ink-500 hover:bg-zinc-200" title="Sign out" aria-label="Sign out">
          <Icon name="out" />
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-canvas lg:p-3">
      <div className="mx-auto flex min-h-[calc(100vh-1.5rem)] max-w-[1440px] overflow-hidden bg-white lg:rounded-2xl lg:shadow-card">
        <aside className="hidden w-60 shrink-0 border-r border-line p-3 lg:block">{sidebar}</aside>
        {open && (
          <div className="fixed inset-0 z-40 bg-black/30 lg:hidden" onClick={() => setOpen(false)}>
            <aside className="h-full w-64 bg-white p-3" onClick={(e) => e.stopPropagation()}>
              {sidebar}
            </aside>
          </div>
        )}
        <main className="min-w-0 flex-1">
          <div className="sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-white/90 px-4 py-2.5 backdrop-blur lg:hidden">
            <button onClick={() => setOpen(true)} className="rounded-md p-1.5 text-ink-700 hover:bg-zinc-100" aria-label="Menu">
              <Icon name="menu" className="h-5 w-5" />
            </button>
            <span className="text-sm font-semibold">Reboot Dialer</span>
            {dueCount > 0 && (
              <button onClick={() => go('callbacks')} className="ml-auto rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
                {dueCount} due
              </button>
            )}
          </div>
          <div className="px-4 py-5 sm:px-6 lg:px-8 lg:py-7">{children}</div>
        </main>
      </div>
    </div>
  )
}
