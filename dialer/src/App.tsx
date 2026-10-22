import { useCallback, useEffect, useState } from 'react'
import { backend, type Session } from './lib/backend'
import { DataProvider, useData } from './lib/store'
import { Layout } from './components/Layout'
import { CallProvider } from './components/CallBar'
import { Button, Card, Icon, Logo, inputCls } from './components/ui'
import { Home } from './pages/Home'
import { Dial } from './pages/Dial'
import { Inbox } from './pages/Inbox'
import { Contacts } from './pages/Contacts'
import { Contact } from './pages/Contact'
import { Pipeline } from './pages/Pipeline'
import { Calendar } from './pages/Calendar'
import { Tasks } from './pages/Tasks'
import { Sequences } from './pages/Sequences'
import { WorkflowBuilder, Workflows } from './pages/Workflows'
import { Campaigns } from './pages/Campaigns'
import { Approvals } from './pages/Approvals'
import { Templates } from './pages/Templates'
import { Lists } from './pages/Lists'
import { Reports } from './pages/Reports'
import { Forms } from './pages/Forms'
import { Integrations } from './pages/Integrations'
import { Import } from './pages/Import'
import { Settings } from './pages/Settings'
import { Calls, calledBackAfter } from './pages/Calls'
import { Numbers } from './pages/Numbers'
import { alreadyAlerted, markAlerted, notify } from './lib/alerts'
import { when } from './lib/format'
import { href, parseHash, type Loc, type Route } from './lib/router'

export default function App() {
  const [me, setMe] = useState<Session | null | undefined>(undefined)
  useEffect(() => {
    backend
      .session()
      .then(setMe)
      .catch(() => setMe(null))
  }, [])
  const signedOut = useCallback(() => setMe(null), [])
  if (me === undefined) return null
  if (!me) return <Login onIn={setMe} />
  return (
    <DataProvider me={me} onSignOut={signedOut}>
      <CallProvider>
        <Shell />
      </CallProvider>
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
        <h1 className="mt-4 text-lg font-semibold text-ink-900">Reboot CRM</h1>
        {demo ? (
          <>
            <p className="mt-1 text-sm text-ink-500">Demo mode. Sample roofers, nothing real gets called or emailed. Pick who you are.</p>
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
            {err && <p className="text-sm text-clay-600">{err}</p>}
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
  const [loc, setLoc] = useState<Loc>(parseHash)
  const [focus, setFocus] = useState('')
  const [tick, setTick] = useState(0)
  const [toasts, setToasts] = useState<{ id: string; leadId: string | null; text: string }[]>([])

  useEffect(() => {
    const h = () => setLoc(parseHash())
    window.addEventListener('hashchange', h)
    return () => window.removeEventListener('hashchange', h)
  }, [])
  useEffect(() => window.scrollTo(0, 0), [loc.route, loc.id])

  const go = useCallback((route: Route, id = '') => {
    location.hash = href(route, id)
    setLoc({ route, id })
  }, [])
  const openContact = useCallback((id: string) => go('contact', id), [go])
  const callNow = useCallback(
    (id: string) => {
      setFocus(id)
      go('dial')
    },
    [go],
  )
  const clearFocus = useCallback(() => setFocus(''), [])

  // Re-check due tasks every 15 seconds.
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 15000)
    return () => clearInterval(t)
  }, [])
  const nowIso = new Date().toISOString()
  const myDue = data.tasks.filter((c) => !c.done_at && c.owner === me.name && c.due_at <= nowIso)

  useEffect(() => {
    const seen = alreadyAlerted()
    const fresh = myDue.filter((c) => !seen.has(c.id))
    if (!fresh.length) return
    fresh.forEach((c) => {
      seen.add(c.id)
      const l = c.lead_id ? leadById.get(c.lead_id) : undefined
      const title = c.kind === 'callback' ? `Callback due: ${l?.company || 'lead'}` : `Task due: ${l?.company || c.reason}`
      notify(title, `${c.reason} · ${when(c.due_at)}`, () => (c.lead_id ? callNow(c.lead_id) : go('tasks')))
      setToasts((t) => [
        ...t,
        {
          id: c.id,
          leadId: c.lead_id,
          text: `${l?.company || 'To-do'} · ${c.reason}`,
        },
      ])
    })
    markAlerted(seen)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, myDue.length])

  const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString()
  const badges = {
    calls: data.calls.filter((c) => c.status === 'missed' && c.started_at >= weekAgo && !calledBackAfter(c, data.calls)).length,
    tasks: myDue.length,
    approvals: data.emails.filter((e) => e.status === 'draft').length,
    inbox: (() => {
      const last = new Map<string, string>()
      for (const e of data.emails)
        if (e.status !== 'draft') {
          const at = e.sent_at || e.created_at
          if ((last.get(e.lead_id) || '') < at) last.set(e.lead_id, at)
        }
      return data.emails.filter((e) => e.direction === 'in' && (e.sent_at || e.created_at) === last.get(e.lead_id)).length
    })(),
  }

  const r = loc.route
  return (
    <Layout route={r} go={go} openContact={openContact} badges={badges}>
      {r === 'home' && <Home go={go} openContact={openContact} callNow={callNow} />}
      {r === 'dial' && <Dial focusId={focus} clearFocus={clearFocus} />}
      {r === 'calls' && <Calls openContact={openContact} />}
      {r === 'numbers' && <Numbers />}
      {r === 'inbox' && <Inbox openContact={openContact} />}
      {r === 'contacts' && <Contacts openContact={openContact} />}
      {r === 'contact' && <Contact id={loc.id} back={() => go('contacts')} callNow={callNow} />}
      {r === 'pipeline' && <Pipeline openContact={openContact} />}
      {r === 'calendar' && <Calendar openContact={openContact} />}
      {r === 'tasks' && <Tasks openContact={openContact} callNow={callNow} />}
      {r === 'workflows' && <Workflows open={(id) => go('workflow', id)} />}
      {r === 'workflow' && <WorkflowBuilder id={loc.id} back={() => go('workflows')} openContact={openContact} />}
      {r === 'sequences' && <Sequences />}
      {r === 'campaigns' && <Campaigns />}
      {r === 'approvals' && <Approvals openContact={openContact} />}
      {r === 'templates' && <Templates />}
      {r === 'lists' && <Lists openContact={openContact} />}
      {r === 'reports' && <Reports />}
      {r === 'forms' && <Forms openContact={openContact} />}
      {r === 'integrations' && <Integrations go={go} />}
      {r === 'import' && <Import done={() => go('contacts')} />}
      {r === 'settings' && <Settings />}

      <div className="fixed bottom-4 right-4 z-50 flex w-80 max-w-[calc(100vw-2rem)] lg:bottom-24 lg:left-6 lg:right-auto lg:w-[212px] max-w-[calc(100vw-2rem)] flex-col gap-2">
        {error && (
          <div className="rounded-xl bg-clay-600 p-3 text-sm text-white shadow-panel" onClick={clearError}>
            {error}
          </div>
        )}
        {toasts.map((t) => (
          <div key={t.id} className="flex items-start gap-3 rounded-xl bg-ink-900 p-3 text-sm text-white shadow-panel">
            <Icon name="bell" className="mt-0.5 h-4 w-4 shrink-0 text-sand-400" />
            <div className="min-w-0 flex-1">
              <div className="font-medium">Due now</div>
              <div className="truncate text-white/70">{t.text}</div>
            </div>
            <button
              className="rounded-md bg-white px-2 py-1 text-xs font-semibold text-ink-900"
              onClick={() => {
                setToasts((x) => x.filter((y) => y.id !== t.id))
                t.leadId ? callNow(t.leadId) : go('tasks')
              }}
            >
              {t.leadId ? 'Call' : 'Open'}
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
