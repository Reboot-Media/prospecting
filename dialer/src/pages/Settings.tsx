import { useState } from 'react'
import { Button, Card, Field, PageHeader, inputCls } from '../components/ui'
import { backend, resetDemo } from '../lib/backend'
import { DEFAULT_SETTINGS } from '../lib/constants'
import { useData } from '../lib/store'
import { notifyPermission, requestNotify, testAlert } from '../lib/alerts'
import type { Settings as S } from '../lib/types'

export function Settings() {
  const { data, saveSettings } = useData()
  const [s, setS] = useState<S>({ ...DEFAULT_SETTINGS, ...data.settings })
  const [callers, setCallers] = useState(data.settings.callers.join(', '))
  const [saved, setSaved] = useState(false)
  const [perm, setPerm] = useState(notifyPermission())
  const [armReset, setArmReset] = useState(false)
  const num = (k: keyof S) => (e: { target: { value: string } }) => setS({ ...s, [k]: Number(e.target.value) || 0 })
  const str = (k: keyof S) => (e: { target: { value: string } }) => setS({ ...s, [k]: e.target.value })

  async function save() {
    await saveSettings({
      ...s,
      booking_text: s.booking_text.trim() || DEFAULT_SETTINGS.booking_text,
      callers: callers
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean),
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const saveBar = (
    <div className="flex items-center justify-end gap-3">
      {saved && <span className="text-xs text-sage-700">Saved</span>}
      <Button variant="primary" onClick={save}>
        Save
      </Button>
    </div>
  )

  return (
    <div className="max-w-3xl space-y-5">
      <PageHeader title="Settings" />
      <Card className="p-5">
        <h2 className="text-sm font-semibold text-ink-900">Callback alerts</h2>
        <p className="mt-1 text-sm text-ink-500">
          When one of your callbacks comes due, this tab beeps and shows a desktop notification. Keep the app pinned in a tab while you dial.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {perm === 'granted' ? (
            <span className="rounded-full bg-sage-50 px-2.5 py-1 text-xs font-medium text-sage-700 ring-1 ring-inset ring-sage-400/30">Notifications on</span>
          ) : perm === 'unsupported' ? (
            <span className="text-xs text-ink-500">This browser can't show notifications. The in-app alert and beep still work.</span>
          ) : (
            <Button variant="primary" onClick={() => requestNotify().then(setPerm)}>
              Turn on notifications
            </Button>
          )}
          <Button onClick={testAlert}>Test alert</Button>
        </div>
      </Card>

      <Card className="space-y-4 p-5">
        <h2 className="text-sm font-semibold text-ink-900">Team and dialing</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Callers" hint="Comma separated. Used for owners and the team tables.">
            <input value={callers} onChange={(e) => setCallers(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Daily dial goal (each)">
            <input type="number" value={s.daily_dial_goal} onChange={num('daily_dial_goal')} className={inputCls} />
          </Field>
        </div>
        <Field label="Booking confirmation text" hint="{first} first name · {me} your name · {when} meeting time · {why} his words from “Why now?” · {company}">
          <textarea value={s.booking_text} onChange={str('booking_text')} rows={3} className={inputCls} />
        </Field>
        <Field label="Booking link">
          <input value={s.booking_link} onChange={str('booking_link')} className={inputCls} />
        </Field>
        {saveBar}
      </Card>

      <Card className="space-y-4 p-5">
        <h2 className="text-sm font-semibold text-ink-900">Phone</h2>
        <Field
          label="Place calls from"
          hint="Your phone: the CRM opens the dialer, times the call and logs it. Browser: calls go through the phone carrier with recording (needs the carrier connected and your line added under Phone numbers)."
        >
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                ['cell', 'My phone'],
                ['browser', 'Browser (recorded)'],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setS({ ...s, call_via: k })}
                className={`h-10 rounded-lg text-sm font-medium ring-1 ring-inset ${s.call_via === k ? 'bg-ink-900 text-white ring-ink-900' : 'bg-white text-ink-700 ring-line hover:bg-wash'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </Field>
        <label className="flex items-center gap-2 text-sm text-ink-700">
          <input type="checkbox" checked={s.record_calls} onChange={(e) => setS({ ...s, record_calls: e.target.checked })} /> Record browser calls
        </label>
        <label className="flex items-center gap-2 text-sm text-ink-700">
          <input type="checkbox" checked={s.missed_call_task} onChange={(e) => setS({ ...s, missed_call_task: e.target.checked })} /> Turn every missed inbound call into a callback
          task
        </label>
        {saveBar}
      </Card>

      <Card className="space-y-4 p-5">
        <h2 className="text-sm font-semibold text-ink-900">Email sending</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Send from">
            <input value={s.sender} onChange={str('sender')} className={inputCls} />
          </Field>
          <Field label="CC on every email">
            <input value={s.cc} onChange={str('cc')} className={inputCls} />
          </Field>
          <Field label="Daily cap" hint="First emails and follow-ups share it.">
            <input type="number" value={s.daily_email_cap} onChange={num('daily_email_cap')} className={inputCls} />
          </Field>
          <Field label="Auto-pause above bounce rate (%)">
            <input type="number" value={s.bounce_pause_pct} onChange={num('bounce_pause_pct')} className={inputCls} />
          </Field>
        </div>
        {saveBar}
      </Card>

      {backend.mode === 'demo' && (
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-ink-900">Demo mode</h2>
          <p className="mt-1 text-sm text-ink-500">
            Data lives only in this browser. Open a second window to see how two callers stay in sync. Reset brings back the sample roofers.
          </p>
          <Button
            variant="danger"
            className="mt-3"
            onClick={() => {
              if (!armReset) return setArmReset(true)
              resetDemo()
              location.reload()
            }}
          >
            {armReset ? 'Click again to erase demo data' : 'Reset demo data'}
          </Button>
        </Card>
      )}
    </div>
  )
}
