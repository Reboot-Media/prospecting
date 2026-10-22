import { useMemo, useState } from 'react'
import {
  Avatar,
  Badge,
  Button,
  Card,
  Empty,
  Field,
  Icon,
  Modal,
  PageHeader,
  PainBadge,
  SearchInput,
  Select,
  StatStrip,
  StatusBadge,
  Tabs,
  Td,
  Th,
  inputCls,
} from '../components/ui'
import { LEAD_EXTRAS, PAIN_LABEL, SEGMENT_LABEL, STAGE_LABEL, STAGE_TONE, STATUS_LABEL } from '../lib/constants'
import { ago, digits, e164, fullName, prettyPhone, uid } from '../lib/format'
import { matchesList } from '../lib/metrics'
import { useData } from '../lib/store'
import type { Lead, Pain, Segment } from '../lib/types'

const PAGE = 25

export function Contacts({ openContact }: { openContact(id: string): void }) {
  const { me, data, updateLead, enroll } = useData()
  const [tab, setTab] = useState<'all' | 'dial' | 'pipeline' | 'clients' | 'dead'>('all')
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('all')
  const [pain, setPain] = useState('all')
  const [owner, setOwner] = useState('all')
  const [list, setList] = useState('')
  const [page, setPage] = useState(0)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [adding, setAdding] = useState(false)
  const [seq, setSeq] = useState('')

  const opensBy = useMemo(() => {
    const m = new Map<string, number>()
    for (const e of data.emails) if (e.direction === 'out' && e.opens) m.set(e.lead_id, (m.get(e.lead_id) || 0) + e.opens)
    return m
  }, [data.emails])

  const tabOk = (l: Lead) => tab === 'all' || tabOkFor(tab, l)

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase()
    const d = digits(q)
    const sl = data.lists.find((x) => x.id === list)
    return data.leads
      .filter((l) => {
        if (!tabOk(l)) return false
        if (sl && !matchesList(l, sl.filter)) return false
        if (status !== 'all' && l.status !== status) return false
        if (pain !== 'all' && l.pain !== pain) return false
        if (owner === 'none' && l.owner) return false
        if (owner !== 'all' && owner !== 'none' && l.owner !== owner) return false
        if (!term) return true
        if (d.length >= 3 && digits(l.phone).includes(d)) return true
        return `${l.company} ${fullName(l)} ${l.city} ${l.email} ${l.tags.join(' ')}`.toLowerCase().includes(term)
      })
      .sort((a, b) => (b.last_called_at || b.updated_at).localeCompare(a.last_called_at || a.updated_at))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.leads, data.lists, q, status, pain, owner, tab, list])

  const pages = Math.max(1, Math.ceil(rows.length / PAGE))
  const view = rows.slice(page * PAGE, page * PAGE + PAGE)
  const callers = Array.from(new Set([...data.settings.callers, me.name]))
  const reset = (fn: (v: string) => void) => (v: string) => (fn(v), setPage(0))
  const count = (t: typeof tab) => data.leads.filter((l) => t === 'all' || tabOkFor(t, l)).length

  const toggle = (id: string) =>
    setPicked((s) => {
      const n = new Set(s)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  const allOn = view.length > 0 && view.every((l) => picked.has(l.id))

  return (
    <div>
      <PageHeader
        title="Contacts"
        sub="Every roofer, from first dial to signed client."
        actions={
          <Button variant="primary" onClick={() => setAdding(true)}>
            <Icon name="plus" /> New contact
          </Button>
        }
      />
      <div className="mb-5">
        <StatStrip
          items={[
            {
              label: 'Total contacts',
              icon: 'users',
              value: data.leads.length,
            },
            { label: 'In the dial queue', icon: 'phone', value: count('dial') },
            {
              label: 'In the pipeline',
              icon: 'kanban',
              value: count('pipeline'),
            },
            { label: 'Signed clients', icon: 'check', value: count('clients') },
          ]}
        />
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Tabs
          value={tab}
          onChange={(v) => (setTab(v), setPage(0))}
          items={[
            { key: 'all', label: 'All', count: data.leads.length },
            { key: 'dial', label: 'To dial', count: count('dial') },
            { key: 'pipeline', label: 'Pipeline', count: count('pipeline') },
            { key: 'clients', label: 'Clients', count: count('clients') },
            { key: 'dead', label: 'Dead', count: count('dead') },
          ]}
        />
      </div>
      <div className="mb-3 flex flex-wrap gap-2">
        <SearchInput value={q} onChange={(v) => (setQ(v), setPage(0))} placeholder="Search company, name, city, phone or tag" className="min-w-[220px] flex-1" />
        <Select label="List" value={list} onChange={reset(setList)} options={[['', 'All lists'], ...data.lists.map((l) => [l.id, l.name] as [string, string])]} />
        <Select label="Status" value={status} onChange={reset(setStatus)} options={[['all', 'All statuses'], ...(Object.entries(STATUS_LABEL) as [string, string][])]} />
        <Select label="Pain" value={pain} onChange={reset(setPain)} options={[['all', 'All pains'], ...(Object.entries(PAIN_LABEL) as [string, string][])]} />
        <Select
          label="Owner"
          value={owner}
          onChange={reset(setOwner)}
          options={[['all', 'All owners'], ['none', 'Unassigned'], ...callers.map((c) => [c, c] as [string, string])]}
        />
      </div>

      {picked.size > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl bg-ink-900 px-3 py-2 text-sm text-white">
          <span className="font-medium">{picked.size} selected</span>
          <span className="mx-1 h-4 w-px bg-white/20" />
          <select aria-label="Add to sequence" value={seq} onChange={(e) => setSeq(e.target.value)} className="h-8 rounded-lg bg-white/10 px-2 text-xs text-white">
            <option value="">Add to sequence…</option>
            {data.sequences.map((s) => (
              <option key={s.id} value={s.id} className="text-ink-900">
                {s.name}
              </option>
            ))}
          </select>
          <Button size="sm" variant="secondary" disabled={!seq} onClick={() => enroll([...picked], seq).then(() => (setPicked(new Set()), setSeq('')))}>
            Enroll
          </Button>
          {callers.map((c) => (
            <Button
              key={c}
              size="sm"
              variant="ghost"
              className="text-white hover:bg-white/10"
              onClick={() => Promise.all([...picked].map((id) => updateLead(id, { owner: c }))).then(() => setPicked(new Set()))}
            >
              Give to {c}
            </Button>
          ))}
          <button onClick={() => setPicked(new Set())} className="ml-auto text-xs text-white/60 hover:text-white">
            Clear
          </button>
        </div>
      )}

      <Card className="overflow-hidden">
        {view.length === 0 ? (
          <Empty title="No contacts match" sub={data.leads.length ? 'Try clearing a filter.' : 'Import your GHL contacts to get started.'} />
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead className="border-b border-line bg-panel">
                  <tr>
                    <Th className="w-8 pr-0">
                      <input
                        type="checkbox"
                        aria-label="Select page"
                        checked={allOn}
                        onChange={() => setPicked((s) => (allOn ? new Set([...s].filter((x) => !view.some((l) => l.id === x))) : new Set([...s, ...view.map((l) => l.id)])))}
                      />
                    </Th>
                    <Th>Company</Th>
                    <Th>Phone</Th>
                    <Th>Pain</Th>
                    <Th>Status</Th>
                    <Th>Deal</Th>
                    <Th>Email</Th>
                    <Th>Owner</Th>
                    <Th className="text-right">Last touch</Th>
                  </tr>
                </thead>
                <tbody>
                  {view.map((l) => (
                    <tr key={l.id} className="cursor-pointer border-t border-line first:border-t-0 hover:bg-panel" onClick={() => openContact(l.id)}>
                      <Td className="w-8 pr-0">
                        <input type="checkbox" aria-label={`Select ${l.company}`} checked={picked.has(l.id)} onClick={(e) => e.stopPropagation()} onChange={() => toggle(l.id)} />
                      </Td>
                      <Td>
                        <div className="flex items-center gap-2.5">
                          <Avatar name={l.company} />
                          <div className="min-w-0">
                            <div className="truncate font-medium text-ink-900">{l.company}</div>
                            <div className="truncate text-xs text-ink-500">{[fullName(l), l.city].filter(Boolean).join(' · ')}</div>
                          </div>
                        </div>
                      </Td>
                      <Td className="tabular whitespace-nowrap text-ink-700">{l.phone ? prettyPhone(l.phone) : '–'}</Td>
                      <Td>
                        <PainBadge pain={l.pain} />
                      </Td>
                      <Td>
                        <StatusBadge status={l.status} />
                      </Td>
                      <Td>{l.stage ? <Badge tone={STAGE_TONE[l.stage]}>{STAGE_LABEL[l.stage]}</Badge> : <span className="text-ink-300">–</span>}</Td>
                      <Td className="whitespace-nowrap text-xs">
                        {l.email_status !== 'ok' ? (
                          <span className="text-clay-600">{l.email_status}</span>
                        ) : opensBy.get(l.id) ? (
                          <span className="inline-flex items-center gap-1 text-accent-600">
                            <Icon name="eye" className="h-3.5 w-3.5" /> {opensBy.get(l.id)}
                          </span>
                        ) : (
                          <span className="text-ink-300">{l.email ? '–' : 'none'}</span>
                        )}
                      </Td>
                      <Td className="text-ink-700">{l.owner || <span className="text-ink-300">–</span>}</Td>
                      <Td className="whitespace-nowrap text-right text-xs text-ink-500">{ago(l.last_called_at)}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="divide-y divide-line md:hidden">
              {view.map((l) => (
                <li key={l.id}>
                  <button onClick={() => openContact(l.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
                    <Avatar name={l.company} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-ink-900">{l.company}</div>
                      <div className="truncate text-xs text-ink-500">
                        {l.phone ? prettyPhone(l.phone) : l.email} · {l.city}
                      </div>
                    </div>
                    <StatusBadge status={l.status} />
                  </button>
                </li>
              ))}
            </ul>
            <div className="flex items-center justify-between border-t border-line px-4 py-2.5 text-xs text-ink-500">
              <span>
                Showing {page * PAGE + 1}–{Math.min(rows.length, page * PAGE + PAGE)} of {rows.length}
              </span>
              <div className="flex gap-1">
                <Button size="sm" disabled={page === 0} onClick={() => setPage(page - 1)} aria-label="Previous page">
                  <Icon name="left" />
                </Button>
                <span className="tabular grid place-items-center px-2">
                  {page + 1} / {pages}
                </span>
                <Button size="sm" disabled={page >= pages - 1} onClick={() => setPage(page + 1)} aria-label="Next page">
                  <Icon name="chevron" />
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>
      <NewContact open={adding} onClose={() => setAdding(false)} onMade={openContact} />
    </div>
  )
}

function tabOkFor(t: string, l: Lead) {
  return (
    (t === 'dial' && ['new', 'attempting', 'callback'].includes(l.status)) ||
    (t === 'pipeline' && !!l.stage && l.stage !== 'won' && l.stage !== 'lost') ||
    (t === 'clients' && l.stage === 'won') ||
    (t === 'dead' && ['not_interested', 'bad_number', 'dnc'].includes(l.status))
  )
}

function NewContact({ open, onClose, onMade }: { open: boolean; onClose(): void; onMade(id: string): void }) {
  const { me, data, importLeads } = useData()
  const blank = {
    company: '',
    first_name: '',
    last_name: '',
    phone: '',
    email: '',
    city: '',
    state: 'TX',
    website: '',
    pain: 'unknown',
    segment: 'growing',
  }
  const [f, setF] = useState(blank)
  const set = (k: keyof typeof blank) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }))
  const dupe = data.leads.find((l) => (f.phone && l.phone === e164(f.phone)) || (f.email && l.email.toLowerCase() === f.email.toLowerCase()))
  async function make() {
    const t = new Date().toISOString()
    const l: Lead = {
      id: uid(),
      ghl_id: null,
      ...f,
      phone: f.phone ? e164(f.phone) : '',
      email: f.email.trim().toLowerCase(),
      pain: f.pain as Pain,
      segment: f.segment as Segment,
      status: 'new',
      stage: null,
      deal_value: 0,
      owner: me.name,
      tags: [],
      notes: '',
      source: 'Manual',
      attempts: 0,
      last_outcome: null,
      last_called_at: null,
      meeting_at: null,
      why_now: '',
      sequence_id: null,
      sequence_step: 0,
      sequence_state: null,
      email_status: 'ok',
      ...LEAD_EXTRAS,
      created_at: t,
      updated_at: t,
    }
    await importLeads([l])
    setF(blank)
    onClose()
    onMade(l.id)
  }
  return (
    <Modal open={open} onClose={onClose} title="New contact">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <Field label="Company">
            <input value={f.company} onChange={set('company')} className={inputCls} autoFocus />
          </Field>
        </div>
        <Field label="First name">
          <input value={f.first_name} onChange={set('first_name')} className={inputCls} />
        </Field>
        <Field label="Last name">
          <input value={f.last_name} onChange={set('last_name')} className={inputCls} />
        </Field>
        <Field label="Phone">
          <input value={f.phone} onChange={set('phone')} className={inputCls} inputMode="tel" />
        </Field>
        <Field label="Email">
          <input value={f.email} onChange={set('email')} className={inputCls} type="email" />
        </Field>
        <Field label="City">
          <input value={f.city} onChange={set('city')} className={inputCls} />
        </Field>
        <Field label="Website">
          <input value={f.website} onChange={set('website')} className={inputCls} />
        </Field>
        <Field label="Pain">
          <Select value={f.pain} onChange={(v) => setF((x) => ({ ...x, pain: v }))} options={Object.entries(PAIN_LABEL) as [string, string][]} className="h-9 w-full" />
        </Field>
        <Field label="Segment">
          <Select value={f.segment} onChange={(v) => setF((x) => ({ ...x, segment: v }))} options={Object.entries(SEGMENT_LABEL) as [string, string][]} className="h-9 w-full" />
        </Field>
      </div>
      {dupe && <p className="mt-3 text-sm text-clay-600">Already in the CRM as {dupe.company}.</p>}
      <div className="mt-4 flex justify-end gap-2">
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="primary" disabled={!f.company.trim() || (!f.phone && !f.email) || !!dupe} onClick={make}>
          Create
        </Button>
      </div>
    </Modal>
  )
}
