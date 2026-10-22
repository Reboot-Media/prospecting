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
import { Scripts } from './pages/Scripts'
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
  if (!me || backend.recovering()) return <Login onIn={setMe} />
  return (
    <DataProvider me={me} onSignOut={signedOut}>
      <CallProvider>
        <Shell />
      </CallProvider>
    </DataProvider>
  )
}

type LoginMode = 'in' | 'first' | 'forgot' | 'reset'

function Login({ onIn }: { onIn(s: Session): void }) {
  const demo = backend.mode === 'demo'
  const [mode, setMode] = useState<LoginMode>(backend.recovering() ? 'reset' : 'in')
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [err, setErr] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  async function run(fn: () => Promise<void>) {
    setErr('')
    setNote('')
    setBusy(true)
    try {
      await fn()
    } catch (e: any) {
      const m = String(e?.message || 'Something went wrong')
      setErr(/invalid login/i.test(m) ? 'Wrong email or password. First time here? Set your password below.' : m)
    } finally {
      setBusy(false)
    }
  }
  const submit = (name?: string) =>
    run(async () => {
      if (demo) return onIn(await backend.signIn(name ?? 'K', ''))
      const e = email.trim().toLowerCase()
      if (mode === 'in') return onIn(await backend.signIn(e, pw))
      if (mode === 'forgot') {
        await backend.sendReset(e)
        setNote('Check your inbox for a reset link. It opens this page.')
        return
      }
      if (pw.length < 8) throw new Error('Use at least 8 characters.')
      if (pw !== pw2) throw new Error('The two passwords do not match.')
      if (mode === 'reset') return onIn(await backend.setPassword(pw))
      if (!(await backend.isTeamEmail(e))) throw new Error('This CRM is only for the Reboot team. Use your rebootmedia.us email.')
      const s = await backend.signUp(e, pw)
      if (s) return onIn(s)
      setNote('Almost there: open the confirmation email we just sent, then sign in here.')
      setMode('in')
    })

  const title = { in: 'Sign in', first: 'Set your password', forgot: 'Reset your password', reset: 'Pick a new password' }[mode]
  return (
    <div className="grid min-h-screen bg-canvas lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-ink-900 p-10 text-white lg:flex">
        <div className="flex items-center gap-2.5">
          <Logo className="h-8 w-8 [&_rect]:fill-white [&_path]:fill-ink-900" />
          <span className="text-sm font-semibold tracking-tight">Reboot CRM</span>
        </div>
        <div className="max-w-md">
          <h2 className="text-3xl font-semibold leading-tight tracking-tight">Dial roofers. Book the call. Sign the job.</h2>
          <p className="mt-4 text-sm leading-relaxed text-white/60">
            Your dial queue, callbacks that never slip, every call recorded and summarized, cold email by pain lane, and the workflows that keep every roofer moving.
          </p>
          <ul className="mt-8 space-y-3 text-sm text-white/80">
            {[
              ['phone', 'Script M beside every dial, outcome logged every time'],
              ['bell', 'Callbacks due jump the queue and ping you'],
              ['bolt', 'Workflows for no-shows, replies, call-backs and new leads'],
              ['chart', 'Reviews, ads and website tags on every roofer'],
            ].map(([icon, text]) => (
              <li key={text} className="flex items-center gap-3">
                <span className="grid h-7 w-7 place-items-center rounded-lg bg-white/10">
                  <Icon name={icon as any} className="h-3.5 w-3.5" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>
        <div className="text-xs text-white/40">Reboot Media · Austin, Texas · K and Ali only</div>
      </div>

      <div className="grid place-items-center p-4">
        <Card className="w-full max-w-sm p-6">
          <div className="flex items-center gap-2.5 lg:hidden">
            <Logo className="h-8 w-8" />
            <span className="text-sm font-semibold text-ink-900">Reboot CRM</span>
          </div>
          <h1 className="mt-4 text-lg font-semibold text-ink-900 lg:mt-0">{demo ? 'Reboot CRM demo' : title}</h1>
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
              {mode === 'first' && <p className="text-sm text-ink-500">First time here. Use your rebootmedia.us email and pick a password.</p>}
              {mode === 'reset' && <p className="text-sm text-ink-500">Pick a new password for your account.</p>}
              {mode !== 'reset' && (
                <input
                  className={inputCls}
                  type="email"
                  required
                  placeholder="you@rebootmedia.us"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  aria-label="Email"
                />
              )}
              {mode !== 'forgot' && (
                <input
                  className={inputCls}
                  type="password"
                  required
                  placeholder={mode === 'in' ? 'Password' : 'New password (8+ characters)'}
                  value={pw}
                  onChange={(e) => setPw(e.target.value)}
                  autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
                  aria-label="Password"
                />
              )}
              {(mode === 'first' || mode === 'reset') && (
                <input
                  className={inputCls}
                  type="password"
                  required
                  placeholder="Same password again"
                  value={pw2}
                  onChange={(e) => setPw2(e.target.value)}
                  autoComplete="new-password"
                  aria-label="Confirm password"
                />
              )}
              {err && <p className="text-sm text-clay-600">{err}</p>}
              {note && <p className="text-sm text-sage-700">{note}</p>}
              <Button variant="primary" className="w-full" type="submit" disabled={busy}>
                {busy ? 'One moment…' : { in: 'Sign in', first: 'Create my login', forgot: 'Send reset link', reset: 'Save password' }[mode]}
              </Button>
              {mode !== 'reset' && (
                <div className="flex justify-between pt-1 text-xs">
                  {mode === 'in' ? (
                    <>
                      <button type="button" onClick={() => (setMode('first'), setErr(''))} className="font-medium text-ink-700 hover:text-ink-900">
                        First time? Set your password
                      </button>
                      <button type="button" onClick={() => (setMode('forgot'), setErr(''))} className="text-ink-500 hover:text-ink-900">
                        Forgot password
                      </button>
                    </>
                  ) : (
                    <button type="button" onClick={() => (setMode('in'), setErr(''))} className="text-ink-500 hover:text-ink-900">
                      Back to sign in
                    </button>
                  )}
                </div>
              )}
            </form>
          )}
        </Card>
      </div>
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
      {r === 'scripts' && <Scripts />}
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
