import { useCallback, useEffect, useState } from 'react'
import { backend, type Session } from './lib/backend'
import { DataProvider, useData } from './lib/store'
import { Layout, type Route } from './components/Layout'
import { Button, Card, Icon, Logo, inputCls } from './components/ui'
import { LeadEditor, LeadHeader, LeadHistory } from './components/LeadPanel'
import { OutcomeBar } from './components/OutcomeBar'
import { Today } from './pages/Today'
import { Dial } from './pages/Dial'
import { Callbacks } from './pages/Callbacks'
import { Leads } from './pages/Leads'
import { Import } from './pages/Import'
import { Settings } from './pages/Settings'
import { alreadyAlerted, markAlerted, notify } from './lib/alerts'
import { when } from './lib/format'

const ROUTES: Route[] = ['today', 'dial', 'callbacks', 'leads', 'import', 'settings']
const routeFromHash = (): Route => {
  const h = location.hash.replace('#/', '') as Route
  return ROUTES.includes(h) ? h : 'today'
}

export default function App() {
  const [me, setMe] = useState<Session | null | undefined>(undefined)
  useEffect(() => {
    backend.session().then(setMe).catch(() => setMe(null))
  }, [])
  const signedOut = useCallback(() => setMe(null), [])
  if (me === undefined) return null
  if (!me) return <Login onIn={setMe} />
  return (
    <DataProvider me={me} onSignOut={signedOut}>
      <Shell />
    </DataProvider>
  )
}

function Login({ onIn }: { onIn(s: Session): void }) {
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [err, setErr] = useState('')
  const demo = backend.mode === 'demo'
  async function submit(name?: string) {
    setErr('')
    try {
      onIn(await backend.signIn(name ?? email, pw))
    } catch (e: any) {
      setErr(e?.message || 'Sign in failed')
    }
  }
  return (
    <div className="grid min-h-screen place-items-center bg-canvas p-4">
      <Card className="w-full max-w-sm p-6">
        <Logo className="h-9 w-9" />
        <h1 className="mt-4 text-lg font-semibold text-ink-900">Reboot Dialer</h1>
        {demo ? (
          <>
            <p className="mt-1 text-sm text-ink-500">Demo mode. Sample roofers, nothing real gets called. Pick who you are.</p>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <Button variant="primary" onClick={() => submit('K')}>
                I'm K
              </Button>
              <Button onClick={() => submit('Ali')}>I'm Ali</Button>
            </div>
          </>
        ) : (
          <form
            className="mt-5 space-y-3"
            onSubmit={(e) => {
              e.preventDefault()
              submit()
            }}
          >
            <input className={inputCls} type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
            <input className={inputCls} type="password" placeholder="Password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="current-password" />
            {err && <p className="text-sm text-rose-600">{err}</p>}
            <Button variant="primary" className="w-full" type="submit">
              Sign in
            </Button>
          </form>
        )}
      </Card>
    </div>
  )
}

function Shell() {
  const { me, data, leadById, error, clearError } = useData()
  const [route, setRoute] = useState<Route>(routeFromHash)
  const [drawer, setDrawer] = useState('')
  const [focus, setFocus] = useState('')
  const [tick, setTick] = useState(0)
  const [toasts, setToasts] = useState<{ id: string; leadId: string; text: string }[]>([])

  useEffect(() => {
    const h = () => setRoute(routeFromHash())
    window.addEventListener('hashchange', h)
    return () => window.removeEventListener('hashchange', h)
  }, [])
  const go = useCallback((r: Route) => {
    location.hash = `#/${r}`
    setRoute(r)
  }, [])
  const callNow = useCallback(
    (id: string) => {
      setDrawer('')
      setFocus(id)
      go('dial')
    },
    [go],
  )
  const clearFocus = useCallback(() => setFocus(''), [])

  // Re-check due callbacks every 15 seconds.
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 15000)
    return () => clearInterval(t)
  }, [])
  const nowIso = new Date().toISOString()
  const myDue = data.callbacks.filter((c) => !c.done_at && c.owner === me.name && c.due_at <= nowIso)

  useEffect(() => {
    const seen = alreadyAlerted()
    const fresh = myDue.filter((c) => !seen.has(c.id))
    if (!fresh.length) return
    fresh.forEach((c) => {
      seen.add(c.id)
      const l = leadById.get(c.lead_id)
      const title = `Callback due: ${l?.company || 'lead'}`
      notify(title, `${c.reason} · ${when(c.due_at)}`, () => callNow(c.lead_id))
      setToasts((t) => [...t, { id: c.id, leadId: c.lead_id, text: `${l?.company || 'Lead'} · ${c.reason}` }])
    })
    markAlerted(seen)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, myDue.length])

  // Drawer closes on Escape and on any page change.
  useEffect(() => setDrawer(''), [route])
  useEffect(() => {
    if (!drawer) return
    const h = (e: KeyboardEvent) => e.key === 'Escape' && !document.querySelector('[role=dialog]') && setDrawer('')
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [drawer])
  const lead = drawer ? leadById.get(drawer) : undefined

  return (
    <Layout route={route} go={go} dueCount={myDue.length}>
      {route === 'today' && <Today openLead={setDrawer} callNow={callNow} />}
      {route === 'dial' && <Dial focusId={focus} clearFocus={clearFocus} />}
      {route === 'callbacks' && <Callbacks openLead={setDrawer} callNow={callNow} />}
      {route === 'leads' && <Leads openLead={setDrawer} />}
      {route === 'import' && <Import done={() => go('leads')} />}
      {route === 'settings' && <Settings />}

      {lead && (
        <div className="fixed inset-0 z-40 flex justify-end bg-black/20" onMouseDown={() => setDrawer('')}>
          <aside className="h-full w-full max-w-lg overflow-y-auto bg-white p-5 shadow-xl" onMouseDown={(e) => e.stopPropagation()}>
            <div className="mb-3 flex justify-end">
              <button onClick={() => setDrawer('')} className="rounded-md p-1 text-ink-500 hover:bg-zinc-100" aria-label="Close">
                <Icon name="x" />
              </button>
            </div>
            <LeadHeader lead={lead} />
            <div className="mt-5 border-t border-line pt-5">
              <LeadEditor lead={lead} />
            </div>
            <div className="mt-5 border-t border-line pt-5">
              <div className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-400">Log a call</div>
              <OutcomeBar lead={lead} onLogged={() => {}} />
            </div>
            <div className="mt-5 border-t border-line pt-5">
              <LeadHistory lead={lead} />
            </div>
          </aside>
        </div>
      )}

      <div className="fixed bottom-4 right-4 z-50 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2">
        {error && (
          <div className="rounded-xl bg-rose-600 p-3 text-sm text-white shadow-lg" onClick={clearError}>
            {error}
          </div>
        )}
        {toasts.map((t) => (
          <div key={t.id} className="flex items-start gap-3 rounded-xl bg-ink-900 p-3 text-sm text-white shadow-lg">
            <Icon name="bell" className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
            <div className="min-w-0 flex-1">
              <div className="font-medium">Callback due</div>
              <div className="truncate text-white/70">{t.text}</div>
            </div>
            <button
              className="rounded-md bg-white px-2 py-1 text-xs font-semibold text-ink-900"
              onClick={() => {
                setToasts((x) => x.filter((y) => y.id !== t.id))
                callNow(t.leadId)
              }}
            >
              Call
            </button>
            <button className="text-white/60 hover:text-white" onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))} aria-label="Dismiss">
              <Icon name="x" />
            </button>
          </div>
        ))}
      </div>
    </Layout>
  )
}
