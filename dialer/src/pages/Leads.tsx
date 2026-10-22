import { useMemo, useState } from 'react'
import { Button, Card, Empty, Icon, PageHeader, PainBadge, Select, StatusBadge, inputCls } from '../components/ui'
import { PAIN_LABEL, STATUS_LABEL } from '../lib/constants'
import { ago, digits, fullName, prettyPhone } from '../lib/format'
import { useData } from '../lib/store'

const PAGE = 50

export function Leads({ openLead }: { openLead(id: string): void }) {
  const { me, data } = useData()
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('all')
  const [pain, setPain] = useState('all')
  const [owner, setOwner] = useState('all')
  const [page, setPage] = useState(0)

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase()
    const d = digits(q)
    return data.leads
      .filter((l) => {
        if (status !== 'all' && l.status !== status) return false
        if (pain !== 'all' && l.pain !== pain) return false
        if (owner === 'none' && l.owner) return false
        if (owner !== 'all' && owner !== 'none' && l.owner !== owner) return false
        if (!term) return true
        if (d.length >= 3 && digits(l.phone).includes(d)) return true
        return `${l.company} ${fullName(l)} ${l.city} ${l.email}`.toLowerCase().includes(term)
      })
      .sort((a, b) => (b.last_called_at || b.created_at).localeCompare(a.last_called_at || a.created_at))
  }, [data.leads, q, status, pain, owner])

  const pages = Math.max(1, Math.ceil(rows.length / PAGE))
  const view = rows.slice(page * PAGE, page * PAGE + PAGE)
  const callers = Array.from(new Set([...data.settings.callers, me.name]))
  const reset = (fn: (v: string) => void) => (v: string) => (fn(v), setPage(0))

  return (
    <div>
      <PageHeader title="Leads" sub={`${rows.length} of ${data.leads.length} roofers`} />
      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <input value={q} onChange={(e) => (setQ(e.target.value), setPage(0))} placeholder="Search company, name, city or phone" className={`${inputCls} pl-9`} />
        </div>
        <Select value={status} onChange={reset(setStatus)} options={[['all', 'All statuses'], ...(Object.entries(STATUS_LABEL) as [string, string][])]} />
        <Select value={pain} onChange={reset(setPain)} options={[['all', 'All pains'], ...(Object.entries(PAIN_LABEL) as [string, string][])]} />
        <Select value={owner} onChange={reset(setOwner)} options={[['all', 'All owners'], ['none', 'Unassigned'], ...callers.map((c) => [c, c] as [string, string])]} />
      </div>
      <Card className="overflow-hidden">
        {view.length === 0 ? (
          <Empty title="No leads match" sub={data.leads.length ? 'Try clearing a filter.' : 'Import your GHL contacts to get started.'} />
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 text-left text-xs text-ink-500">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Company</th>
                    <th className="px-3 py-2.5 font-medium">Contact</th>
                    <th className="px-3 py-2.5 font-medium">Phone</th>
                    <th className="px-3 py-2.5 font-medium">Status</th>
                    <th className="px-3 py-2.5 font-medium">Pain</th>
                    <th className="px-3 py-2.5 font-medium">Owner</th>
                    <th className="px-3 py-2.5 text-right font-medium">Tries</th>
                    <th className="px-4 py-2.5 font-medium">Last touch</th>
                  </tr>
                </thead>
                <tbody>
                  {view.map((l) => (
                    <tr key={l.id} onClick={() => openLead(l.id)} className="cursor-pointer border-t border-line hover:bg-zinc-50">
                      <td className="max-w-[240px] truncate px-4 py-2.5 font-medium text-ink-900">{l.company}</td>
                      <td className="max-w-[160px] truncate px-3 py-2.5 text-ink-700">{fullName(l) || '—'}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 tabular-nums text-ink-700">{prettyPhone(l.phone)}</td>
                      <td className="px-3 py-2.5">
                        <StatusBadge status={l.status} />
                      </td>
                      <td className="px-3 py-2.5">
                        <PainBadge pain={l.pain} />
                      </td>
                      <td className="px-3 py-2.5 text-ink-700">{l.owner || '—'}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-ink-700">{l.attempts}</td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-ink-500">{ago(l.last_called_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="md:hidden">
              {view.map((l) => (
                <li key={l.id}>
                  <button onClick={() => openLead(l.id)} className="w-full border-t border-line px-4 py-3 text-left first:border-t-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium text-ink-900">{l.company}</span>
                      <StatusBadge status={l.status} />
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-2 text-xs text-ink-500">
                      <span>
                        {prettyPhone(l.phone)} · {l.owner || 'Unassigned'}
                      </span>
                      <PainBadge pain={l.pain} />
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
        {pages > 1 && (
          <div className="flex items-center justify-between border-t border-line px-4 py-2.5 text-xs text-ink-500">
            <span>
              Page {page + 1} of {pages}
            </span>
            <div className="flex gap-1.5">
              <Button size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>
                Previous
              </Button>
              <Button size="sm" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
