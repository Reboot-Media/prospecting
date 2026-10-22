import { useState } from 'react'
import { Avatar, Button, Card, CardHead, Field, Icon, Modal, PageHeader, inputCls } from '../components/ui'
import { PAIN_LABEL, SEGMENT_LABEL, STATUS_LABEL } from '../lib/constants'
import { uid } from '../lib/format'
import { matchesList } from '../lib/metrics'
import { useData } from '../lib/store'
import type { ListFilter, Pain, Segment, SmartList, Status } from '../lib/types'

const blank: ListFilter = {
  tags_any: [],
  tags_none: [],
  pain: [],
  segment: [],
  status: [],
  has_email: false,
}

function describe(f: ListFilter) {
  const parts: string[] = []
  if (f.tags_any.length) parts.push(`tagged ${f.tags_any.join(' or ')}`)
  if (f.tags_none.length) parts.push(`not ${f.tags_none.join(', ')}`)
  if (f.pain.length) parts.push(f.pain.map((p) => PAIN_LABEL[p]).join(' / '))
  if (f.segment.length) parts.push(f.segment.map((s) => SEGMENT_LABEL[s]).join(' / '))
  if (f.status.length) parts.push(f.status.map((s) => STATUS_LABEL[s]).join(' / '))
  if (f.has_email) parts.push('has a good email')
  return parts.join(' · ') || 'Everyone'
}

export function Lists({ openContact }: { openContact(id: string): void }) {
  const { data, save, remove } = useData()
  const [edit, setEdit] = useState<SmartList | null>(null)
  return (
    <div>
      <PageHeader
        title="Lists"
        sub="Smart lists update themselves from tags, pain, segment and status. Use them for dialing, sequences and campaigns."
        actions={
          <Button
            variant="primary"
            onClick={() =>
              setEdit({
                id: uid(),
                name: '',
                filter: blank,
                created_at: new Date().toISOString(),
              })
            }
          >
            <Icon name="plus" /> New list
          </Button>
        }
      />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {data.lists.map((l) => {
          const members = data.leads.filter((x) => matchesList(x, l.filter))
          return (
            <Card key={l.id}>
              <CardHead
                title={l.name}
                sub={describe(l.filter)}
                actions={
                  <Button size="sm" onClick={() => setEdit(l)}>
                    Edit
                  </Button>
                }
              />
              <div className="flex items-center gap-3 px-4 pb-4">
                <span className="tabular text-2xl font-semibold text-ink-900">{members.length}</span>
                <div className="flex -space-x-1.5">
                  {members.slice(0, 6).map((m) => (
                    <button key={m.id} onClick={() => openContact(m.id)} title={m.company}>
                      <Avatar name={m.company} className="h-7 w-7 text-[10px] ring-2 ring-white" />
                    </button>
                  ))}
                </div>
                <span className="text-xs text-ink-500">roofers</span>
              </div>
            </Card>
          )
        })}
      </div>
      {edit && <ListEditor value={edit} close={() => setEdit(null)} onSave={(l) => save('lists', l)} onDelete={(id) => remove('lists', id)} />}
    </div>
  )
}

function Chips<T extends string>({ all, value, onChange }: { all: Record<T, string>; value: T[]; onChange(v: T[]): void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {(Object.keys(all) as T[]).map((k) => {
        const on = value.includes(k)
        return (
          <button
            key={k}
            type="button"
            onClick={() => onChange(on ? value.filter((x) => x !== k) : [...value, k])}
            className={`rounded-full px-2.5 py-1 text-xs ring-1 ring-inset ${on ? 'bg-ink-900 text-white ring-ink-900' : 'bg-white text-ink-700 ring-line hover:bg-wash'}`}
          >
            {all[k]}
          </button>
        )
      })}
    </div>
  )
}

function ListEditor({ value, close, onSave, onDelete }: { value: SmartList; close(): void; onSave(l: SmartList): Promise<void>; onDelete(id: string): Promise<void> }) {
  const { data } = useData()
  const [l, setL] = useState(value)
  const [any, setAny] = useState(value.filter.tags_any.join(', '))
  const [none, setNone] = useState(value.filter.tags_none.join(', '))
  const split = (s: string) =>
    s
      .split(',')
      .map((x) => x.trim().toLowerCase())
      .filter(Boolean)
  const f: ListFilter = {
    ...l.filter,
    tags_any: split(any),
    tags_none: split(none),
  }
  const n = data.leads.filter((x) => matchesList(x, f)).length
  const exists = data.lists.some((x) => x.id === value.id)
  return (
    <Modal open onClose={close} title={exists ? 'Edit list' : 'New list'} wide>
      <div className="space-y-4">
        <Field label="Name">
          <input value={l.name} onChange={(e) => setL({ ...l, name: e.target.value })} className={inputCls} autoFocus />
        </Field>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Has any of these tags" hint="Comma separated, e.g. call, email">
            <input value={any} onChange={(e) => setAny(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Has none of these tags">
            <input value={none} onChange={(e) => setNone(e.target.value)} className={inputCls} />
          </Field>
        </div>
        <Field label="Pain">
          <Chips all={PAIN_LABEL} value={l.filter.pain} onChange={(v: Pain[]) => setL({ ...l, filter: { ...l.filter, pain: v } })} />
        </Field>
        <Field label="Segment">
          <Chips all={SEGMENT_LABEL} value={l.filter.segment} onChange={(v: Segment[]) => setL({ ...l, filter: { ...l.filter, segment: v } })} />
        </Field>
        <Field label="Call status">
          <Chips all={STATUS_LABEL} value={l.filter.status} onChange={(v: Status[]) => setL({ ...l, filter: { ...l.filter, status: v } })} />
        </Field>
        <label className="flex items-center gap-2 text-sm text-ink-700">
          <input
            type="checkbox"
            checked={l.filter.has_email}
            onChange={(e) =>
              setL({
                ...l,
                filter: { ...l.filter, has_email: e.target.checked },
              })
            }
          />{' '}
          Only roofers with a good email
        </label>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4">
          <span className="text-sm text-ink-500">
            <b className="tabular text-ink-900">{n}</b> roofers match
          </span>
          <div className="flex gap-2">
            {exists && (
              <Button variant="danger" onClick={() => onDelete(value.id).then(close)}>
                Delete
              </Button>
            )}
            <Button onClick={close}>Cancel</Button>
            <Button variant="primary" disabled={!l.name.trim()} onClick={() => onSave({ ...l, filter: f }).then(close)}>
              Save list
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
