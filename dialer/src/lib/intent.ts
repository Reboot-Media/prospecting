import type { Lead, SiteTags } from './types'
import type { Snapshot } from './backend'

export interface Intent {
  score: number
  band: 'hot' | 'warm' | 'cold'
  reasons: string[]
}

const DAY = 864e5

// Buyer intent from what the roofer has done lately (14 days), plus a little fit.
export function buyerIntent(l: Lead, d: Pick<Snapshot, 'site_visits' | 'emails' | 'calls' | 'forms' | 'activities' | 'meetings'>, now = Date.now()): Intent {
  const since = new Date(now - 14 * DAY).toISOString()
  const reasons: string[] = []
  let score = 0
  const add = (pts: number, why: string) => {
    score += pts
    reasons.push(why)
  }

  const visits = d.site_visits.filter((v) => v.lead_id === l.id && v.created_at >= since)
  if (visits.length) add(Math.min(30, visits.length * 10), `${visits.length} visit${visits.length === 1 ? '' : 's'} to rebootmedia.us`)
  const buying = visits.filter((v) => /pricing|case|visibility|grow|scale/.test(v.page))
  if (buying.length) add(15, `Looked at ${[...new Set(buying.map((v) => v.page))].slice(0, 2).join(', ')}`)

  const mail = d.emails.filter((e) => e.lead_id === l.id && (e.sent_at || e.created_at) >= since)
  if (mail.some((e) => e.replied_at || e.direction === 'in')) add(25, 'Replied to an email')
  const clicks = mail.reduce((s, e) => s + (e.clicks || 0), 0)
  if (clicks) add(15, `Clicked ${clicks} email link${clicks === 1 ? '' : 's'}`)
  const opens = mail.reduce((s, e) => s + (e.opens || 0), 0)
  if (opens >= 2) add(5, `Opened emails ${opens}×`)

  if (d.calls.some((c) => c.lead_id === l.id && c.direction === 'in' && c.started_at >= since)) add(25, 'Called you')
  if (d.forms.some((f) => f.lead_id === l.id && f.created_at >= since)) add(25, 'Filled a form')
  if (d.activities.some((a) => a.lead_id === l.id && a.outcome === 'callback' && a.created_at >= since)) add(10, 'Asked for a callback')
  if (d.meetings.some((m) => m.lead_id === l.id && m.status !== 'canceled' && m.starts_at >= new Date(now).toISOString())) add(30, 'Call on the calendar')

  if (l.pain === 'never-ads' || l.pain === 'ads-stopped') add(5, l.pain === 'never-ads' ? 'Never ran ads' : 'Ads stopped')
  if (l.review_count !== null && l.review_count < 50) add(5, `Only ${l.review_count} reviews`)

  score = Math.min(100, score)
  return { score, band: score >= 60 ? 'hot' : score >= 30 ? 'warm' : 'cold', reasons }
}

export const TAG_LABEL: Record<Exclude<keyof SiteTags, 'builder' | 'error'>, string> = {
  gtm: 'Google Tag Manager',
  ga4: 'Google Analytics 4',
  google_ads: 'Google Ads tag',
  meta_pixel: 'Meta pixel',
  call_tracking: 'Call tracking',
  chat: 'Chat widget',
  reviews_widget: 'Reviews widget',
  estimator: 'Instant estimator',
  crm: 'CRM / booking',
}

// Short talking points from what the site is missing.
export function sitePoints(l: Lead): string[] {
  const t = l.site_tags || {}
  if (!l.site_checked_at) return []
  const out: string[] = []
  if (!t.google_ads?.length && !t.meta_pixel?.length) out.push('No ad tracking on the site: likely not running ads, or running them blind')
  else if (!t.call_tracking?.length) out.push('Ads tags but no call tracking: cannot tell which calls came from ads')
  if (!t.gtm?.length && !t.ga4?.length) out.push('No analytics: no idea where site visitors come from')
  if (l.review_count !== null && l.review_count < 50) out.push(`${l.review_count} Google reviews: top roofers in most cities have 100+`)
  if (l.google_rating !== null && l.google_rating < 4.3) out.push(`${l.google_rating}★ rating is below what homeowners click on`)
  return out
}
