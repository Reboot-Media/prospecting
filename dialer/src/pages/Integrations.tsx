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
    { name: 'Database', what: 'Supabase · shared by K and Ali, live sync', icon: 'layers', status: live ? 'Connected' : 'Demo data', tone: live ? 'sage' : 'sand', detail: live ? 'Realtime on' : 'Data stays in this browser', group: 'core' },
    { name: 'Resend', what: `Sends from ${data.settings.sender}, tracks opens, clicks, bounces`, icon: 'send', status: 'Needs setup', tone: 'sand', detail: 'Free tier: 100/day, 3,000/month', group: 'core', go: 'settings' },
    { name: 'Website forms', what: 'rebootmedia.us form fills become contacts', icon: 'globe', status: 'Needs your go', tone: 'sand', detail: 'Changes the live site', group: 'core', go: 'forms' },
    { name: 'GHL', what: 'One-time import of every contact and tag', icon: 'upload', status: 'Import by CSV', tone: 'mist', detail: 'Cancel after cutover', group: 'core', go: 'import' },
    { name: 'Your phones', what: 'Calls and booking texts go out from your own cell', icon: 'phone', status: 'Connected', tone: 'sage', detail: 'tel: and sms: links', group: 'core', go: 'dial' },
    { name: 'Booking calendar', what: data.settings.booking_link.replace('https://', ''), icon: 'calendar', status: 'Not connected', tone: 'stone', detail: 'Self-booked calls show in Calendar', group: 'core', go: 'calendar' },
    { name: 'Calling carrier', what: 'Click-to-call in the browser with recordings (Telnyx)', icon: 'phone', status: 'Later', tone: 'stone', detail: 'About $25–50/mo at 200 dials/day', group: 'later' },
    { name: 'Texting (10DLC)', what: 'Two-way texts from a business number', icon: 'message', status: 'Later', tone: 'stone', detail: '~$20 one-time registration', group: 'later' },
    { name: 'Slack', what: 'Daily digest and reply alerts in #cold-outreach', icon: 'bell', status: 'Later', tone: 'stone', detail: 'Optional', group: 'later' },
    { name: 'Lead scoring', what: 'Your Mac scoring agent rates new contacts', icon: 'bolt', status: 'Later', tone: 'stone', detail: 'Bands: 60+ yes, 40–60 review', group: 'later' },
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
            <b className="font-medium">Resend isn't set up yet.</b> Emails you approve wait in the queue until it is.
          </span>
        </div>
      )}
      <div className="mb-4">
        <Tabs
          value={tab}
          onChange={setTab}
          items={[
            { key: 'core', label: 'Running the CRM', count: conns.filter((c) => c.group === 'core').length },
            { key: 'later', label: 'Later', count: conns.filter((c) => c.group === 'later').length },
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
    </div>
  )
}
