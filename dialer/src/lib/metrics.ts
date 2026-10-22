import { OUTCOMES } from './constants'
import type { Activity, Email, Lead, ListFilter } from './types'

export const DIAL_OUTCOMES = new Set(OUTCOMES.map((o) => o.key))
export const CONVO_OUTCOMES = new Set(OUTCOMES.filter((o) => o.conversation).map((o) => o.key))

export const isDial = (a: Activity) => DIAL_OUTCOMES.has(a.outcome)

export function dayKey(iso: string) {
  const d = new Date(iso)
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

// Last `days` days as chart points, oldest first.
export function perDay(activities: Activity[], days: number, pick: (a: Activity) => boolean) {
  const counts = new Map<string, number>()
  for (const a of activities) if (pick(a)) counts.set(dayKey(a.created_at), (counts.get(dayKey(a.created_at)) || 0) + 1)
  const out: { label: string; value: number; highlight?: boolean }[] = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    out.push({
      label: `${d.getMonth() + 1}/${d.getDate()}`,
      value: counts.get(dayKey(d.toISOString())) || 0,
      highlight: i === 0,
    })
  }
  return out
}

export interface EmailStats {
  sent: number
  delivered: number
  opened: number
  clicked: number
  replied: number
  bounced: number
}

export function emailStats(emails: Email[]): EmailStats {
  const out = emails.filter((e) => e.direction === 'out' && (e.status === 'sent' || e.status === 'bounced'))
  return {
    sent: out.length,
    delivered: out.filter((e) => e.status === 'sent').length,
    opened: out.filter((e) => e.opens > 0).length,
    clicked: out.filter((e) => e.clicks > 0).length,
    replied: out.filter((e) => e.replied_at).length,
    bounced: out.filter((e) => e.status === 'bounced').length,
  }
}

export function matchesList(l: Lead, f: ListFilter): boolean {
  if (f.tags_any.length && !f.tags_any.some((t) => l.tags.includes(t))) return false
  if (f.tags_none.some((t) => l.tags.includes(t))) return false
  if (f.pain.length && !f.pain.includes(l.pain)) return false
  if (f.segment.length && !f.segment.includes(l.segment)) return false
  if (f.status.length && !f.status.includes(l.status)) return false
  if (f.has_email && (!l.email || l.email_status !== 'ok')) return false
  return true
}

export const money = (n: number) => (n >= 1000 ? `$${Math.round(n / 100) / 10}k` : `$${n}`)
