import { useState } from 'react'
import { Button, Card, Field, PageHeader, inputCls } from '../components/ui'
import { backend, resetDemo } from '../lib/backend'
import { DEFAULT_BOOKING_TEXT } from '../lib/constants'
import { useData } from '../lib/store'
import { notifyPermission, requestNotify, testAlert } from '../lib/alerts'

export function Settings() {
  const { data, saveSettings } = useData()
  const [text, setText] = useState(data.settings.booking_text)
  const [callers, setCallers] = useState(data.settings.callers.join(', '))
  const [saved, setSaved] = useState(false)
  const [perm, setPerm] = useState(notifyPermission())
  const [armReset, setArmReset] = useState(false)

  async function save() {
    await saveSettings({
      booking_text: text.trim() || DEFAULT_BOOKING_TEXT,
      callers: callers
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean),
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="max-w-3xl space-y-5">
      <PageHeader title="Settings" />
      <Card className="p-5">
        <h2 className="text-sm font-semibold text-ink-900">Callback alerts</h2>
        <p className="mt-1 text-sm text-ink-500">
          When one of your callbacks comes due, this tab beeps and shows a desktop notification. It works while the app is open in a browser tab, so keep it pinned
          while you dial.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {perm === 'granted' ? (
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">Notifications on</span>
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
        <h2 className="text-sm font-semibold text-ink-900">Booking confirmation text</h2>
        <Field label="Template" hint="{first} his first name · {me} your name · {when} meeting time · {why} his words from “Why now?” · {company}">
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} className={inputCls} />
        </Field>
        <Field label="Callers" hint="Comma separated. Used for owners and the team table.">
          <input value={callers} onChange={(e) => setCallers(e.target.value)} className={inputCls} />
        </Field>
        <div className="flex items-center justify-end gap-3">
          {saved && <span className="text-xs text-emerald-700">Saved</span>}
          <Button variant="primary" onClick={save}>
            Save
          </Button>
        </div>
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
