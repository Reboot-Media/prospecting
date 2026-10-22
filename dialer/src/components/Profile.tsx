import { useState } from 'react'
import { Badge, Button, Card, CardHead, Field, Icon, inputCls } from './ui'
import { backend } from '../lib/backend'
import { PAIN_LABEL } from '../lib/constants'
import { ago } from '../lib/format'
import { TAG_LABEL, buyerIntent, sitePoints, type Intent } from '../lib/intent'
import { useData } from '../lib/store'
import type { Lead, SiteTags } from '../lib/types'

const BAND_TONE = { hot: 'clay', warm: 'sand', cold: 'stone' } as const

export function useIntent(lead: Lead): Intent {
  const { data } = useData()
  return buyerIntent(lead, data)
}

export function IntentPill({ intent }: { intent: Intent }) {
  return (
    <Badge tone={BAND_TONE[intent.band]}>
      Intent {intent.score} · {intent.band}
    </Badge>
  )
}

function Stars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex" aria-label={`${rating} stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Icon key={i} name="star" className={`h-3.5 w-3.5 ${rating >= i - 0.25 ? 'fill-sand-400 text-sand-400' : 'text-ink-300'}`} />
      ))}
    </span>
  )
}

// One line for the dialer: reviews, intent, ads, top talking point.
export function ProfileStrip({ lead }: { lead: Lead }) {
  const intent = useIntent(lead)
  const t = lead.site_tags || {}
  const points = sitePoints(lead)
  return (
    <div className="mt-3 space-y-1.5">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-ink-600">
        <IntentPill intent={intent} />
        {lead.google_rating !== null ? (
          <span className="inline-flex items-center gap-1">
            <Stars rating={lead.google_rating} /> {lead.google_rating} · {lead.review_count ?? 0} reviews
          </span>
        ) : (
          <span className="text-ink-400">Reviews unknown</span>
        )}
        <span>Ads: {PAIN_LABEL[lead.pain]}</span>
        {lead.site_checked_at && (
          <span>
            Site:{' '}
            {(['gtm', 'google_ads', 'meta_pixel', 'call_tracking'] as const)
              .filter((k) => t[k]?.length)
              .map((k) => TAG_LABEL[k].replace(' tag', ''))
              .join(', ') || 'no tracking tags'}
          </span>
        )}
      </div>
      {points[0] && <div className="text-xs text-ink-500">Talking point: {points[0]}</div>}
    </div>
  )
}

// The full card on a contact: reviews, ads, website tags, buyer intent and talking points.
export function ProfileCard({ lead }: { lead: Lead }) {
  const { updateLead } = useData()
  const intent = useIntent(lead)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [edit, setEdit] = useState(false)
  const t: SiteTags = lead.site_tags || {}
  const points = sitePoints(lead)

  async function check() {
    setBusy(true)
    setMsg('')
    try {
      if (backend.mode === 'live') {
        await backend.invoke('crm-enrich', { lead_id: lead.id })
      } else {
        await updateLead(lead.id, { site_checked_at: new Date().toISOString() })
        setMsg('Demo: the live CRM reads the website and fills this in.')
      }
    } catch (e: any) {
      setMsg(e?.message || 'Could not check the site')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardHead
        title="Roofer profile"
        sub={lead.site_checked_at ? `Website checked ${ago(lead.site_checked_at)}` : 'Website not checked yet'}
        actions={
          <Button size="sm" onClick={check} disabled={busy || !lead.website}>
            <Icon name="globe" /> {busy ? 'Checking…' : lead.site_checked_at ? 'Recheck' : 'Check website'}
          </Button>
        }
      />
      <div className="space-y-4 px-4 pb-4">
        <div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-ink-400">Buyer intent</span>
            <IntentPill intent={intent} />
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-wash ring-1 ring-inset ring-line">
            <div
              className={`h-full rounded-full ${intent.band === 'hot' ? 'bg-clay-400' : intent.band === 'warm' ? 'bg-sand-400' : 'bg-ink-300'}`}
              style={{ width: `${Math.max(4, intent.score)}%` }}
            />
          </div>
          <ul className="mt-2 space-y-0.5 text-xs text-ink-600">
            {intent.reasons.length ? intent.reasons.map((r) => <li key={r}>· {r}</li>) : <li className="text-ink-400">No signals in the last 14 days.</li>}
          </ul>
        </div>

        <div className="border-t border-line pt-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-ink-400">Google reviews</span>
            <button onClick={() => setEdit(!edit)} className="text-xs text-ink-500 hover:text-ink-900">
              {edit ? 'Done' : 'Edit'}
            </button>
          </div>
          {edit ? (
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Field label="Rating">
                <input
                  className={inputCls}
                  type="number"
                  step="0.1"
                  min="1"
                  max="5"
                  defaultValue={lead.google_rating ?? ''}
                  onBlur={(e) => updateLead(lead.id, { google_rating: e.target.value ? Number(e.target.value) : null })}
                />
              </Field>
              <Field label="Reviews">
                <input
                  className={inputCls}
                  type="number"
                  min="0"
                  defaultValue={lead.review_count ?? ''}
                  onBlur={(e) => updateLead(lead.id, { review_count: e.target.value ? Number(e.target.value) : null })}
                />
              </Field>
              <div className="col-span-2">
                <Field label="Google Business Profile link">
                  <input className={inputCls} defaultValue={lead.gbp_url} onBlur={(e) => updateLead(lead.id, { gbp_url: e.target.value.trim() })} />
                </Field>
              </div>
            </div>
          ) : lead.google_rating !== null ? (
            <div className="mt-1.5 flex items-center gap-2 text-sm text-ink-900">
              <Stars rating={lead.google_rating} />
              <span className="font-medium">{lead.google_rating}</span>
              <span className="text-ink-500">· {lead.review_count ?? 0} reviews</span>
              {lead.gbp_url && (
                <a href={lead.gbp_url} target="_blank" rel="noreferrer" className="ml-auto text-xs text-ink-500 underline">
                  Profile
                </a>
              )}
            </div>
          ) : (
            <div className="mt-1.5 text-sm text-ink-400">Not known yet</div>
          )}
        </div>

        <div className="border-t border-line pt-3">
          <span className="text-xs font-medium uppercase tracking-wider text-ink-400">Ads</span>
          <div className="mt-1.5 text-sm text-ink-900">{PAIN_LABEL[lead.pain]}</div>
          {lead.site_checked_at && (
            <div className="mt-0.5 text-xs text-ink-500">
              {t.google_ads?.length ? 'Google Ads tag on site' : 'No Google Ads tag'} · {t.meta_pixel?.length ? 'Meta pixel on site' : 'No Meta pixel'}
            </div>
          )}
        </div>

        <div className="border-t border-line pt-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-ink-400">Website</span>
            {t.builder && <span className="text-xs text-ink-500">Built on {t.builder}</span>}
          </div>
          {lead.website ? (
            <a
              href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`}
              target="_blank"
              rel="noreferrer"
              className="mt-1 block truncate text-sm text-ink-900 underline"
            >
              {lead.website.replace(/^https?:\/\//, '')}
            </a>
          ) : (
            <div className="mt-1 text-sm text-ink-400">No website on file</div>
          )}
          {t.error && <div className="mt-1 text-xs text-clay-600">{t.error}</div>}
          {lead.site_checked_at && !t.error && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {(Object.keys(TAG_LABEL) as (keyof typeof TAG_LABEL)[]).map((k) => {
                const ids = t[k] || []
                return (
                  <span
                    key={k}
                    title={ids.join(', ')}
                    className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] ring-1 ring-inset ${ids.length ? 'bg-sage-50 text-sage-700 ring-sage-400/40' : 'bg-white text-ink-400 ring-line line-through decoration-ink-300'}`}
                  >
                    {TAG_LABEL[k]}
                    {ids.length > 0 && ['call_tracking', 'chat', 'reviews_widget', 'estimator', 'crm'].includes(k) ? `: ${ids[0]}` : ''}
                  </span>
                )
              })}
            </div>
          )}
        </div>

        {points.length > 0 && (
          <div className="border-t border-line pt-3">
            <span className="text-xs font-medium uppercase tracking-wider text-ink-400">Talking points</span>
            <ul className="mt-1.5 space-y-1 text-sm text-ink-700">
              {points.map((p) => (
                <li key={p}>· {p}</li>
              ))}
            </ul>
          </div>
        )}
        {msg && <p className="text-xs text-ink-500">{msg}</p>}
      </div>
    </Card>
  )
}
