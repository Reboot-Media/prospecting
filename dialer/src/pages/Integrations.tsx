import { useState } from 'react'
import { Badge, Card, Icon, PageHeader, Tabs, type IconName } from '../components/ui'
import type { Tone } from '../lib/constants'
import { backend } from '../lib/backend'
import { useData } from '../lib/store'
import type { Route } from '../lib/router'

interface Conn {
  name: string
  what: string
  icon: IconName
  status: string
  tone: Tone
  detail: string
  group: 'core' | 'later'
  go?: Route
}

export function Integrations({ go }: { go(r: Route): void }) {
  const { data } = useData()
  const [tab, setTab] = useState<'core' | 'later'>('core')
  const live = backend.mode === 'live'
  const conns: Conn[] = [
    {
      name: 'Database',
      what: 'Supabase · shared by K and Ali, live sync',
      icon: 'layers',
      status: live ? 'Connected' : 'Demo data',
      tone: live ? 'sage' : 'sand',
      detail: live ? 'Realtime on' : 'Data stays in this browser',
      group: 'core',
    },
    {
      name: 'Resend',
      what: `Sends from ${data.settings.sender}, tracks opens, clicks, bounces`,
      icon: 'send',
      status: 'Needs setup',
      tone: 'sand',
      detail: 'Free tier: 100/day, 3,000/month',
      group: 'core',
      go: 'settings',
    },
    {
      name: 'Website forms',
      what: 'rebootmedia.us form fills become contacts',
      icon: 'globe',
      status: 'Needs your go',
      tone: 'sand',
      detail: 'Changes the live site',
      group: 'core',
      go: 'forms',
    },
    {
      name: 'GHL',
      what: 'One-time import of every contact and tag',
      icon: 'upload',
      status: 'Import by CSV',
      tone: 'mist',
      detail: 'Cancel after cutover',
      group: 'core',
      go: 'import',
    },
    {
      name: 'Your phones',
      what: 'Calls and booking texts go out from your own cell',
      icon: 'phone',
      status: 'Connected',
      tone: 'sage',
      detail: 'tel: and sms: links',
      group: 'core',
      go: 'dial',
    },
    {
      name: 'Booking calendar',
      what: data.settings.booking_link.replace('https://', ''),
      icon: 'calendar',
      status: 'Not connected',
      tone: 'stone',
      detail: 'Self-booked calls show in Calendar',
      group: 'core',
      go: 'calendar',
    },
    {
      name: 'Phone carrier',
      what: 'Numbers for K and Ali, browser calling, recordings, call-backs tracked (Twilio)',
      icon: 'phone',
      status: 'Needs your pick',
      tone: 'sand',
      detail: '2 local numbers + per-minute',
      group: 'core',
      go: 'numbers',
    },
    {
      name: 'Call transcripts',
      what: 'Gemini writes the transcript, summary, objections and next step for every recorded call',
      icon: 'message',
      status: 'Needs key',
      tone: 'sand',
      detail: 'About $0.002 a minute',
      group: 'core',
      go: 'settings',
    },
    {
      name: 'Meta lead ads',
      what: 'Facebook and Instagram lead forms become contacts and start speed-to-lead',
      icon: 'users',
      status: 'Needs setup',
      tone: 'sand',
      detail: 'Webhook below',
      group: 'core',
    },
    {
      name: 'Website tracking',
      what: 'Visits to rebootmedia.us from emailed roofers count toward buyer intent',
      icon: 'eye',
      status: 'Needs your go',
      tone: 'sand',
      detail: 'One tag in GTM or the site',
      group: 'core',
    },
    {
      name: 'Website checker',
      what: "Reads each roofer's site for GTM, GA4, Google Ads, Meta pixel, call tracking and widgets",
      icon: 'globe',
      status: live ? 'Running' : 'Demo data',
      tone: live ? 'sage' : 'mist',
      detail: '15 roofers every 15 min',
      group: 'core',
    },
    {
      name: 'Google reviews',
      what: 'Rating and review count on every roofer, filled automatically',
      icon: 'star',
      status: 'Optional',
      tone: 'stone',
      detail: 'Needs a Google Places key; or type them in',
      group: 'later',
    },
    {
      name: 'Texting (10DLC)',
      what: 'Two-way texts from a business number',
      icon: 'message',
      status: 'Later',
      tone: 'stone',
      detail: '~$20 one-time registration',
      group: 'later',
    },
    {
      name: 'Slack',
      what: 'Daily digest and reply alerts in #cold-outreach',
      icon: 'bell',
      status: 'Later',
      tone: 'stone',
      detail: 'Optional',
      group: 'later',
    },
    {
      name: 'Lead scoring',
      what: 'Your Mac scoring agent rates new contacts',
      icon: 'bolt',
      status: 'Later',
      tone: 'stone',
      detail: 'Bands: 60+ yes, 40–60 review',
      group: 'later',
    },
  ]
  const shown = conns.filter((c) => c.group === tab)
  const attention = conns.filter((c) => c.group === 'core' && c.tone === 'sand')

  return (
    <div>
      <PageHeader title="Integrations" sub={`${conns.filter((c) => c.tone === 'sage').length} connected · ${attention.length} need attention`} />
      {attention.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl bg-sand-50 px-4 py-2.5 text-sm text-sand-700 ring-1 ring-inset ring-sand-400/30">
          <Icon name="alert" />
          <span className="flex-1">
            <b className="font-medium">{attention.length} things need you:</b> {attention.map((c) => c.name).join(', ')}.
          </span>
        </div>
      )}
      <div className="mb-4">
        <Tabs
          value={tab}
          onChange={setTab}
          items={[
            {
              key: 'core',
              label: 'Running the CRM',
              count: conns.filter((c) => c.group === 'core').length,
            },
            {
              key: 'later',
              label: 'Later',
              count: conns.filter((c) => c.group === 'later').length,
            },
          ]}
        />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {shown.map((c) => (
          <Card key={c.name} className={`p-4 ${c.tone === 'sand' ? 'ring-1 ring-sand-400/40' : ''}`}>
            <div className="flex items-start gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-wash text-ink-700 ring-1 ring-inset ring-line">
                <Icon name={c.icon} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-ink-900">{c.name}</div>
                <div className="truncate text-xs text-ink-500">{c.what}</div>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <Badge tone={c.tone}>{c.status}</Badge>
              <span className="text-[11px] text-ink-400">{c.detail}</span>
            </div>
            {c.go && (
              <button onClick={() => go(c.go!)} className="mt-3 flex w-full items-center justify-between border-t border-line pt-2.5 text-xs text-ink-500 hover:text-ink-900">
                Open <Icon name="chevron" className="h-3.5 w-3.5" />
              </button>
            )}
          </Card>
        ))}
      </div>
      {tab === 'core' && <SetupDetails />}
    </div>
  )
}

const FN = backend.functionsUrl || 'https://fqlgfmuiedrdowxnvcjv.supabase.co/functions/v1'

function Copy({ text }: { text: string }) {
  const [done, setDone] = useState(false)
  return (
    <button
      onClick={() => {
        navigator.clipboard?.writeText(text).then(() => {
          setDone(true)
          setTimeout(() => setDone(false), 1500)
        })
      }}
      className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-ink-700 ring-1 ring-inset ring-line hover:bg-wash"
    >
      {done ? 'Copied' : 'Copy'}
    </button>
  )
}

export function trackingSnippet() {
  return `<script>(function(){try{var k='rb_v',v=localStorage.getItem(k);if(!v){v=(window.crypto&&crypto.randomUUID)?crypto.randomUUID():String(Math.random()).slice(2)+Date.now();localStorage.setItem(k,v)}var rb=new URLSearchParams(location.search).get('rb');fetch('${FN}/crm-track',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({v:v,rb:rb,page:location.pathname,ref:document.referrer}),keepalive:true})}catch(e){}})();</script>`
}

function SetupDetails() {
  const rows: { title: string; body: string; value: string; steps: string[] }[] = [
    {
      title: 'Meta lead ads webhook',
      body: 'Where Meta sends each new lead.',
      value: `${FN}/crm-meta`,
      steps: [
        'In your Meta app: Webhooks → Page → subscribe to leadgen with this URL.',
        'Verify token: any phrase; add the same phrase as META_VERIFY_TOKEN in Supabase → Edge Functions → Secrets, with META_APP_SECRET and a page token as META_PAGE_TOKEN.',
      ],
    },
    {
      title: 'Website tracking tag',
      body: 'Paste as a Custom HTML tag on All Pages in GTM (or in the site head). Email links already carry ?rb= so visits tie to the roofer.',
      value: trackingSnippet(),
      steps: ['Changes the live site, so it waits for your go.'],
    },
    {
      title: 'Call transcripts',
      body: 'Add your Gemini key as GEMINI_API_KEY in Supabase → Edge Functions → Secrets. Calls under 20 seconds are skipped (Settings).',
      value: 'GEMINI_API_KEY',
      steps: [],
    },
  ]
  return (
    <Card className="mt-5">
      <div className="border-b border-line px-4 py-3 text-sm font-semibold text-ink-900">Setup details</div>
      <ul>
        {rows.map((r) => (
          <li key={r.title} className="border-b border-line px-4 py-3 last:border-0">
            <div className="text-sm font-medium text-ink-900">{r.title}</div>
            <div className="mt-0.5 text-xs text-ink-500">{r.body}</div>
            <div className="mt-2 flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-md bg-wash px-2 py-1.5 text-[11px] text-ink-700 ring-1 ring-inset ring-line">{r.value}</code>
              <Copy text={r.value} />
            </div>
            {r.steps.map((x) => (
              <p key={x} className="mt-1.5 text-xs text-ink-500">
                {x}
              </p>
            ))}
          </li>
        ))}
      </ul>
    </Card>
  )
}
