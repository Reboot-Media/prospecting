import { useEffect, useMemo, useState } from 'react'
import { Button, Card, Empty, Field, Icon, PageHeader, Select, inputCls } from '../components/ui'
import { SCRIPT_KIND_LABEL, defaultScripts, fillScript } from '../lib/scripts'
import { uid } from '../lib/format'
import { useData } from '../lib/store'
import type { Lead, Script, ScriptKind } from '../lib/types'

const sorted = (l: Script[]) => [...l].sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name))

// Your call scripts. Edit them here; the one you pick shows beside every dial.
export function Scripts() {
  const { data, save, remove } = useData()
  const list = useMemo(() => sorted(data.scripts), [data.scripts])
  const [id, setId] = useState('')
  const cur = list.find((s) => s.id === id) || list[0]
  const [draft, setDraft] = useState<Script | null>(null)
  useEffect(() => setDraft(cur ? { ...cur } : null), [cur?.id, cur?.updated_at]) // eslint-disable-line react-hooks/exhaustive-deps
  const dirty = !!draft && !!cur && (draft.name !== cur.name || draft.body !== cur.body || draft.kind !== cur.kind)

  async function loadM() {
    const t = new Date().toISOString()
    for (const s of defaultScripts(uid, t)) await save('scripts', s)
  }
  async function add() {
    const t = new Date().toISOString()
    const s: Script = { id: uid(), name: 'New script', kind: 'other', body: '', sort: (list[list.length - 1]?.sort || 0) + 1, created_at: t, updated_at: t }
    await save('scripts', s)
    setId(s.id)
  }

  return (
    <div>
      <PageHeader
        title="Scripts"
        sub="What you say on the call. {first}, {company}, {city} and {me} fill in from the roofer on screen in the dialer."
        actions={
          <Button variant="primary" onClick={add}>
            <Icon name="plus" /> New script
          </Button>
        }
      />
      {list.length === 0 ? (
        <Card>
          <Empty
            title="No scripts yet"
            sub="Load Script M (opener, gatekeeper, objections, pain lanes, booking text) and edit from there."
            action={
              <Button variant="primary" onClick={loadM}>
                Load Script M
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[240px_1fr]">
          <Card className="h-fit">
            <ul className="p-1.5">
              {list.map((s) => (
                <li key={s.id}>
                  <button
                    onClick={() => setId(s.id)}
                    className={`flex w-full flex-col rounded-lg px-3 py-2 text-left ${cur?.id === s.id ? 'bg-wash ring-1 ring-inset ring-line' : 'hover:bg-wash'}`}
                  >
                    <span className="truncate text-sm font-medium text-ink-900">{s.name}</span>
                    <span className="text-[11px] text-ink-500">{SCRIPT_KIND_LABEL[s.kind]}</span>
                  </button>
                </li>
              ))}
            </ul>
          </Card>
          {draft && (
            <Card className="p-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_200px]">
                <Field label="Name">
                  <input className={inputCls} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
                </Field>
                <Field label="Kind">
                  <Select value={draft.kind} onChange={(v) => setDraft({ ...draft, kind: v as ScriptKind })} options={Object.entries(SCRIPT_KIND_LABEL) as [string, string][]} />
                </Field>
              </div>
              <Field label="Script">
                <textarea
                  className={`${inputCls} mt-1 min-h-[460px] font-mono text-[13px] leading-relaxed`}
                  value={draft.body}
                  onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                />
              </Field>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button variant="primary" disabled={!dirty} onClick={() => save('scripts', { ...draft, updated_at: new Date().toISOString() })}>
                  Save
                </Button>
                {dirty && <Button onClick={() => setDraft({ ...cur! })}>Undo changes</Button>}
                <button
                  className="ml-auto text-xs text-ink-400 hover:text-clay-600"
                  onClick={() => {
                    if (confirm(`Delete "${draft.name}"?`)) remove('scripts', draft.id)
                  }}
                >
                  Delete script
                </button>
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}

// The script beside the dialer, filled in for the roofer on screen.
export function ScriptPanel({ lead }: { lead?: Lead }) {
  const { me, data } = useData()
  const list = useMemo(() => sorted(data.scripts), [data.scripts])
  const [pick, setPick] = useState('')
  const lane = lead?.pain === 'ads-stopped' || lead?.pain === 'ads-running'
  const cur = list.find((s) => s.id === pick) || list.find((s) => s.kind === 'opener') || list[0]
  if (!list.length) return <div className="px-4 py-6 text-sm text-ink-500">No scripts yet. Load Script M under Outreach → Scripts.</div>
  return (
    <div>
      <div className="flex gap-1 overflow-x-auto border-b border-line px-3 py-2">
        {list.map((s) => (
          <button
            key={s.id}
            onClick={() => setPick(s.id)}
            className={`shrink-0 rounded-md px-2 py-1 text-xs font-medium ${cur?.id === s.id ? 'bg-ink-900 text-white' : 'text-ink-600 hover:bg-wash'}`}
          >
            {SCRIPT_KIND_LABEL[s.kind] === 'Other' ? s.name : SCRIPT_KIND_LABEL[s.kind]}
          </button>
        ))}
      </div>
      {lane && cur?.kind === 'opener' && (
        <div className="border-b border-line bg-sand-50 px-4 py-2 text-xs text-sand-700">
          This roofer is tagged {lead?.pain === 'ads-stopped' ? 'ads stopped' : 'ads running'}: use the matching tagline under Pain lanes.
        </div>
      )}
      <div className="max-h-[560px] overflow-y-auto whitespace-pre-wrap px-4 py-3 text-[13px] leading-relaxed text-ink-800">{cur ? fillScript(cur.body, lead, me.name) : ''}</div>
    </div>
  )
}
