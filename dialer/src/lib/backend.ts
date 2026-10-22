import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Activity, Callback, Lead, Settings } from './types'
import { DEFAULT_BOOKING_TEXT, DEFAULT_CALLERS } from './constants'
import { demoData } from './demo'

export type Table = 'leads' | 'activities' | 'callbacks'
export type Change =
  | { table: 'leads'; row: Lead; deleted?: boolean }
  | { table: 'activities'; row: Activity; deleted?: boolean }
  | { table: 'callbacks'; row: Callback; deleted?: boolean }

export interface Snapshot {
  leads: Lead[]
  activities: Activity[]
  callbacks: Callback[]
  settings: Settings
}

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
  insertLeads(rows: Lead[]): Promise<void>
  updateLead(id: string, patch: Partial<Lead>): Promise<void>
  insertActivity(row: Activity): Promise<void>
  insertCallback(row: Callback): Promise<void>
  updateCallback(id: string, patch: Partial<Callback>): Promise<void>
  saveSettings(s: Settings): Promise<void>
  subscribe(fn: (c: Change) => void): () => void
}

const DEFAULT_SETTINGS: Settings = { booking_text: DEFAULT_BOOKING_TEXT, callers: DEFAULT_CALLERS }

/* ---------------------------------------------------------------- demo --- */
// Demo mode keeps everything in this browser. Tabs stay in sync through a
// BroadcastChannel so two windows behave like K and Ali side by side.

const KEY = 'reboot-dialer:demo:v1'
const SESSION_KEY = 'reboot-dialer:demo:session'

function readDemo(): Snapshot {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    /* fall through to seed */
  }
  const seeded = { ...demoData(), settings: DEFAULT_SETTINGS }
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
  const chan = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('reboot-dialer') : null
  const listeners = new Set<(c: Change) => void>()
  chan?.addEventListener('message', (e) => {
    mem = null // another tab wrote; reload lazily
    listeners.forEach((fn) => fn(e.data as Change))
  })
  const db = () => (mem ??= readDemo())
  const emit = (c: Change) => {
    writeDemo(db())
    chan?.postMessage(c)
  }

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
      return structuredClone(db())
    },
    async insertLeads(rows) {
      db().leads.push(...rows)
      rows.forEach((row) => emit({ table: 'leads', row }))
    },
    async updateLead(id, patch) {
      const l = db().leads.find((x) => x.id === id)
      if (!l) return
      Object.assign(l, patch)
      emit({ table: 'leads', row: l })
    },
    async insertActivity(row) {
      db().activities.push(row)
      emit({ table: 'activities', row })
    },
    async insertCallback(row) {
      db().callbacks.push(row)
      emit({ table: 'callbacks', row })
    },
    async updateCallback(id, patch) {
      const c = db().callbacks.find((x) => x.id === id)
      if (!c) return
      Object.assign(c, patch)
      emit({ table: 'callbacks', row: c })
    },
    async saveSettings(s) {
      db().settings = s
      writeDemo(db())
    },
    subscribe(fn) {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
  }
}

/* ---------------------------------------------------------------- live --- */

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

function liveBackend(url: string, key: string): Backend {
  const sb = createClient(url, key, { auth: { persistSession: true } })
  const toSession = (u: any): Session | null =>
    u ? { name: (u.user_metadata?.name as string) || String(u.email).split('@')[0], email: u.email } : null
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
      const { data, error } = await sb.auth.signInWithPassword({ email, password })
      if (error) throw error
      return toSession(data.user)!
    },
    async signOut() {
      await sb.auth.signOut()
    },
    async load() {
      const since = new Date(Date.now() - 45 * 864e5).toISOString()
      const [leads, activities, callbacks, settingsRow] = await Promise.all([
        fetchAll<Lead>(sb, 'leads', (q) => q.order('created_at')),
        fetchAll<Activity>(sb, 'activities', (q) => q.gte('created_at', since).order('created_at')),
        fetchAll<Callback>(sb, 'callbacks', (q) => q.or(`done_at.is.null,created_at.gte.${since}`).order('due_at')),
        sb.from('settings').select('value').eq('id', 1).maybeSingle(),
      ])
      const settings = { ...DEFAULT_SETTINGS, ...((settingsRow.data?.value as Settings) || {}) }
      return { leads, activities, callbacks, settings }
    },
    async insertLeads(rows) {
      for (let i = 0; i < rows.length; i += 500) check(await sb.from('leads').insert(rows.slice(i, i + 500)))
    },
    async updateLead(id, patch) {
      check(await sb.from('leads').update(patch).eq('id', id))
    },
    async insertActivity(row) {
      check(await sb.from('activities').insert(row))
    },
    async insertCallback(row) {
      check(await sb.from('callbacks').insert(row))
    },
    async updateCallback(id, patch) {
      check(await sb.from('callbacks').update(patch).eq('id', id))
    },
    async saveSettings(s) {
      check(await sb.from('settings').upsert({ id: 1, value: s }))
    },
    subscribe(fn) {
      const ch = sb.channel('dialer-sync')
      for (const table of ['leads', 'activities', 'callbacks'] as Table[]) {
        ch.on('postgres_changes', { event: '*', schema: 'public', table }, (p: any) => {
          const deleted = p.eventType === 'DELETE'
          fn({ table, row: deleted ? p.old : p.new, deleted } as Change)
        })
      }
      ch.subscribe()
      return () => {
        sb.removeChannel(ch)
      }
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
