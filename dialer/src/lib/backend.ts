import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Activity, Call, Campaign, Email, EmailEvent, FormSubmission, Lead, Meeting, PhoneNumber, Sequence, Settings, SmartList, Task, Template } from './types'
import { DEFAULT_SETTINGS } from './constants'
import { demoData } from './demo'

// Every table the app reads and writes. Live table names carry a crm_ prefix so
// they never clash with other tools in the same Supabase project.
export interface Rows {
  leads: Lead
  activities: Activity
  tasks: Task
  meetings: Meeting
  emails: Email
  email_events: EmailEvent
  sequences: Sequence
  campaigns: Campaign
  lists: SmartList
  templates: Template
  forms: FormSubmission
  calls: Call
  numbers: PhoneNumber
}
export type Table = keyof Rows
export const TABLES: Table[] = ['leads', 'activities', 'tasks', 'meetings', 'emails', 'email_events', 'sequences', 'campaigns', 'lists', 'templates', 'forms', 'calls', 'numbers']

export type Change = {
  [K in Table]: { table: K; row: Rows[K]; deleted?: boolean }
}[Table]

export type Snapshot = { [K in Table]: Rows[K][] } & { settings: Settings }

export interface Session {
  name: string
  email: string | null
}

export interface Backend {
  mode: 'demo' | 'live'
  session(): Promise<Session | null>
  signIn(emailOrName: string, password: string): Promise<Session>
  signOut(): Promise<void>
  load(): Promise<Snapshot>
  insert<K extends Table>(table: K, rows: Rows[K][]): Promise<void>
  update<K extends Table>(table: K, id: string, patch: Partial<Rows[K]>): Promise<void>
  remove(table: Table, id: string): Promise<void>
  saveSettings(s: Settings): Promise<void>
  subscribe(fn: (c: Change) => void): () => void
  // Calls an edge function as the signed-in user (live only).
  invoke<T = unknown>(path: string, body?: unknown): Promise<T>
  // Base URL for edge functions, or '' in demo mode.
  functionsUrl: string
  accessToken(): Promise<string>
}

/* ---------------------------------------------------------------- demo --- */
// Demo mode keeps everything in this browser. Tabs stay in sync through a
// BroadcastChannel so two windows behave like K and Ali side by side.

const KEY = 'reboot-crm:demo:v3'
const SESSION_KEY = 'reboot-crm:demo:session'

function readDemo(): Snapshot {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    /* fall through to seed */
  }
  const seeded: Snapshot = { ...demoData(), settings: DEFAULT_SETTINGS }
  writeDemo(seeded)
  return seeded
}

function writeDemo(s: Snapshot) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    /* storage full or blocked: keep working in memory */
  }
}

function demoBackend(): Backend {
  let mem: Snapshot | null = null
  const chan = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('reboot-crm') : null
  const listeners = new Set<(c: Change) => void>()
  chan?.addEventListener('message', (e) => {
    mem = null
    listeners.forEach((fn) => fn(e.data as Change))
  })
  const db = () => (mem ??= readDemo())
  const emit = (c: Change) => {
    writeDemo(db())
    chan?.postMessage(c)
  }
  const list = <K extends Table>(t: K) => db()[t] as Rows[K][]

  return {
    mode: 'demo',
    async session() {
      try {
        const raw = localStorage.getItem(SESSION_KEY)
        return raw ? (JSON.parse(raw) as Session) : null
      } catch {
        return null
      }
    },
    async signIn(name) {
      const s = { name: name.trim() || 'K', email: null }
      try {
        localStorage.setItem(SESSION_KEY, JSON.stringify(s))
      } catch {
        /* ignore */
      }
      return s
    },
    async signOut() {
      try {
        localStorage.removeItem(SESSION_KEY)
      } catch {
        /* ignore */
      }
    },
    async load() {
      mem = null
      const d = db()
      return structuredClone({
        ...d,
        settings: { ...DEFAULT_SETTINGS, ...d.settings },
      })
    },
    async insert(table, rows) {
      list(table).push(...rows)
      rows.forEach((row) => emit({ table, row } as Change))
    },
    async update(table, id, patch) {
      const r = list(table).find((x) => x.id === id)
      if (!r) return
      Object.assign(r, patch)
      emit({ table, row: r } as Change)
    },
    async remove(table, id) {
      const l = list(table) as { id: string }[]
      const i = l.findIndex((x) => x.id === id)
      if (i < 0) return
      const [row] = l.splice(i, 1)
      emit({ table, row, deleted: true } as Change)
    },
    async saveSettings(s) {
      db().settings = s
      writeDemo(db())
    },
    subscribe(fn) {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
    async invoke() {
      throw new Error('Not available in demo mode')
    },
    functionsUrl: '',
    async accessToken() {
      return ''
    },
  }
}

/* ---------------------------------------------------------------- live --- */

const live = (t: Table) => `crm_${t}`

async function fetchAll<T>(sb: SupabaseClient, table: string, build: (q: any) => any): Promise<T[]> {
  const out: T[] = []
  const page = 1000
  for (let from = 0; ; from += page) {
    const { data, error } = await build(sb.from(table).select('*')).range(from, from + page - 1)
    if (error) throw error
    out.push(...(data as T[]))
    if (!data || data.length < page) break
  }
  return out
}

// Names the app uses for owners and callers, keyed by login email.
const TEAM_NAMES: Record<string, string> = {
  'k.reid@rebootmedia.us': 'K',
  's.kazmi@rebootmedia.us': 'Ali',
}

function liveBackend(url: string, key: string): Backend {
  const sb = createClient(url, key, { auth: { persistSession: true } })
  const toSession = (u: any): Session | null =>
    u
      ? {
          name: (u.user_metadata?.name as string) || TEAM_NAMES[String(u.email).toLowerCase()] || String(u.email).split('@')[0],
          email: u.email,
        }
      : null
  const check = (r: { error: any }) => {
    if (r.error) throw r.error
  }

  return {
    mode: 'live',
    async session() {
      const { data } = await sb.auth.getSession()
      return toSession(data.session?.user)
    },
    async signIn(email, password) {
      const { data, error } = await sb.auth.signInWithPassword({
        email,
        password,
      })
      if (error) throw error
      return toSession(data.user)!
    },
    async signOut() {
      await sb.auth.signOut()
    },
    async load() {
      // Recent history only for the busy tables; everything else in full.
      const since = new Date(Date.now() - 90 * 864e5).toISOString()
      const recent = new Set<Table>(['activities', 'email_events', 'calls'])
      const results = await Promise.all(TABLES.map((t) => fetchAll(sb, live(t), (q) => (recent.has(t) ? q.gte('created_at', since).order('created_at') : q.order('created_at')))))
      const settingsRow = await sb.from('crm_settings').select('value').eq('id', 1).maybeSingle()
      const snap = Object.fromEntries(TABLES.map((t, i) => [t, results[i]])) as unknown as Snapshot
      snap.settings = {
        ...DEFAULT_SETTINGS,
        ...((settingsRow.data?.value as Settings) || {}),
      }
      return snap
    },
    async insert(table, rows) {
      for (let i = 0; i < rows.length; i += 500) check(await sb.from(live(table)).insert(rows.slice(i, i + 500) as any))
    },
    async update(table, id, patch) {
      check(
        await sb
          .from(live(table))
          .update(patch as any)
          .eq('id', id),
      )
    },
    async remove(table, id) {
      check(await sb.from(live(table)).delete().eq('id', id))
    },
    async saveSettings(s) {
      check(await sb.from('crm_settings').upsert({ id: 1, value: s }))
    },
    subscribe(fn) {
      const ch = sb.channel('crm-sync')
      for (const table of TABLES) {
        ch.on('postgres_changes', { event: '*', schema: 'public', table: live(table) }, (p: any) => {
          const deleted = p.eventType === 'DELETE'
          fn({ table, row: deleted ? p.old : p.new, deleted } as Change)
        })
      }
      ch.subscribe()
      return () => {
        sb.removeChannel(ch)
      }
    },
    functionsUrl: `${url}/functions/v1`,
    async accessToken() {
      const { data } = await sb.auth.getSession()
      return data.session?.access_token || ''
    },
    async invoke(path, body) {
      const token = (await sb.auth.getSession()).data.session?.access_token
      const r = await fetch(`${url}/functions/v1/${path}`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          apikey: key,
          'content-type': 'application/json',
        },
        body: JSON.stringify(body ?? {}),
      })
      const out = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(out?.error || `Request failed (${r.status})`)
      return out
    },
  }
}

const URL_ = import.meta.env.VITE_SUPABASE_URL as string | undefined
const KEY_ = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const backend: Backend = URL_ && KEY_ ? liveBackend(URL_, KEY_) : demoBackend()

export function resetDemo() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}
