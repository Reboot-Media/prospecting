import { useState } from 'react'
import { Badge, Button, Card, Field, Icon, PageHeader, Select, inputCls } from '../components/ui'
import { ago, uid } from '../lib/format'
import { useData } from '../lib/store'
import type { Template } from '../lib/types'

const KIND: Record<Template['kind'], string> = {
  plain: 'Plain email',
  branded: 'Branded email',
  text: 'Text message',
}

export function Templates() {
  const { data, save, remove } = useData()
  const [sel, setSel] = useState(data.templates[0]?.id || '')
  const cur = data.templates.find((t) => t.id === sel)
  const [draft, setDraft] = useState<Template | null>(cur || null)
  const [saved, setSaved] = useState(false)

  const pick = (t: Template) => {
    setSel(t.id)
    setDraft(t)
  }

  return (
    <div>
      <PageHeader
        title="Templates"
        sub="Reusable emails and texts. Use {first}, {company}, {city}, {me}, {when} and {why}."
        actions={
          <Button
            variant="primary"
            onClick={() => {
              const t: Template = {
                id: uid(),
                name: 'New template',
                kind: 'branded',
                subject: '',
                body: 'Hi {first},\n\n\n\nKendall',
                created_at: new Date().toISOString(),
              }
              save('templates', t).then(() => pick(t))
            }}
          >
            <Icon name="plus" /> New template
          </Button>
        }
      />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[300px_1fr]">
        <Card className="h-fit">
          <ul className="p-1.5">
            {data.templates.map((t) => (
              <li key={t.id}>
                <button onClick={() => pick(t)} className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left ${sel === t.id ? 'bg-wash' : 'hover:bg-panel'}`}>
                  <Icon name={t.kind === 'text' ? 'message' : 'mail'} className="h-4 w-4 text-ink-400" />
                  <span className="min-w-0 flex-1 truncate text-sm text-ink-900">{t.name}</span>
                  <span className="text-[11px] text-ink-400">{ago(t.created_at)}</span>
                </button>
              </li>
            ))}
          </ul>
        </Card>
        {draft && (
          <Card className="space-y-3 p-5">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_200px]">
              <Field label="Name">
                <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className={inputCls} />
              </Field>
              <Field label="Kind">
                <Select
                  value={draft.kind}
                  onChange={(v) => setDraft({ ...draft, kind: v as Template['kind'] })}
                  options={Object.entries(KIND) as [string, string][]}
                  className="h-9 w-full"
                />
              </Field>
            </div>
            {draft.kind !== 'text' && (
              <Field label="Subject">
                <input value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} className={inputCls} />
              </Field>
            )}
            <Field label="Body">
              <textarea value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} rows={10} className={inputCls} />
            </Field>
            <div className="flex items-center justify-between">
              <Badge tone={draft.kind === 'branded' ? 'violet' : 'stone'}>{KIND[draft.kind]}</Badge>
              <div className="flex items-center gap-2">
                {saved && <span className="text-xs text-sage-700">Saved</span>}
                <Button variant="danger" onClick={() => remove('templates', draft.id).then(() => setDraft(null))}>
                  Delete
                </Button>
                <Button
                  variant="primary"
                  onClick={() =>
                    save('templates', draft).then(() => {
                      setSaved(true)
                      setTimeout(() => setSaved(false), 1500)
                    })
                  }
                >
                  Save
                </Button>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}
