import { useEffect, useMemo, useState } from 'react'
import { Badge, Button, Card, Empty, Icon, PageHeader, Select } from '../components/ui'
import { backend } from '../lib/backend'
import { ago } from '../lib/format'
import { useData } from '../lib/store'

// Nothing leaves without K's OK. Drafts from sequences, campaigns, replies and
// one-off emails all land here.
export function Approvals({ openContact }: { openContact(id: string): void }) {
  const { data, leadById, approveEmails, remove, save } = useData()
  const [source, setSource] = useState('all')
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [view, setView] = useState('')
  const [done, setDone] = useState('')

  const drafts = useMemo(
    () =>
      data.emails
        .filter((e) => e.status === 'draft')
        .filter((e) => source === 'all' || (source === 'sequence' ? e.sequence_id : source === 'campaign' ? e.campaign_id : !e.sequence_id && !e.campaign_id))
        .sort((a, b) => a.created_at.localeCompare(b.created_at)),
    [data.emails, source],
  )
  useEffect(() => {
    if (!drafts.some((d) => d.id === view)) setView(drafts[0]?.id || '')
  }, [drafts, view])
  const cur = drafts.find((d) => d.id === view)
  const curLead = cur ? leadById.get(cur.lead_id) : undefined
  const queued = data.emails.filter((e) => e.status === 'approved').length
  const failed = data.emails.filter((e) => e.status === 'failed')
  const label = (e: (typeof drafts)[0]) =>
    e.sequence_id ? `${data.sequences.find((s) => s.id === e.sequence_id)?.name || 'Sequence'} · email ${(e.step ?? 0) + 1}` : e.campaign_id ? `${data.campaigns.find((c) => c.id === e.campaign_id)?.name || 'Campaign'} · ${e.variant}` : 'One-off'

  async function approve(ids: string[]) {
    await approveEmails(ids)
    setPicked(new Set())
    setDone(`${ids.length} approved. ${backend.mode === 'demo' ? 'Demo mode marks them sent right away.' : `They go out in the next sending window, up to ${data.settings.daily_email_cap} a day.`}`)
  }

  return (
    <div>
      <PageHeader
        title="Approvals"
        sub={`Every email waits here for your OK. ${queued ? `${queued} approved and queued to send.` : ''}`}
        actions={
          <>
            <Select
              label="Source"
              value={source}
              onChange={setSource}
              options={[
                ['all', 'All drafts'],
                ['sequence', 'Sequences'],
                ['campaign', 'Campaigns'],
                ['oneoff', 'One-off & replies'],
              ]}
            />
            <Button disabled={!picked.size} onClick={() => approve([...picked])}>
              Approve {picked.size || ''} selected
            </Button>
            <Button variant="primary" disabled={!drafts.length} onClick={() => approve(drafts.map((d) => d.id))}>
              <Icon name="check" /> Approve all {drafts.length}
            </Button>
          </>
        }
      />
      {failed.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg bg-clay-50 px-3 py-2 text-sm text-clay-700 ring-1 ring-inset ring-clay-400/30">
          <span className="flex-1">{failed.length} email{failed.length === 1 ? '' : 's'} failed to send.</span>
          <Button size="sm" onClick={() => Promise.all(failed.map((e) => save('emails', { ...e, status: 'approved' })))}>
            Retry
          </Button>
        </div>
      )}
      {done && <div className="mb-4 rounded-lg bg-sage-50 px-3 py-2 text-sm text-sage-700 ring-1 ring-inset ring-sage-400/30">{done}</div>}
      {drafts.length === 0 ? (
        <Card>
          <Empty title="Inbox zero for approvals" sub="New drafts from sequences, campaigns and replies show up here." />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[380px_1fr]">
          <Card className="max-h-[640px] overflow-y-auto">
            <ul>
              {drafts.map((d) => {
                const l = leadById.get(d.lead_id)
                return (
                  <li key={d.id} className={`flex items-start gap-3 border-b border-line px-4 py-3 ${view === d.id ? 'bg-panel' : ''}`}>
                    <input
                      type="checkbox"
                      className="mt-1"
                      aria-label={`Select email to ${l?.company}`}
                      checked={picked.has(d.id)}
                      onChange={() =>
                        setPicked((s) => {
                          const n = new Set(s)
                          n.has(d.id) ? n.delete(d.id) : n.add(d.id)
                          return n
                        })
                      }
                    />
                    <button onClick={() => setView(d.id)} className="min-w-0 flex-1 text-left">
                      <div className="flex items-baseline gap-2">
                        <span className="truncate text-sm font-medium text-ink-900">{l?.company}</span>
                        <span className="ml-auto shrink-0 text-[11px] text-ink-400">{ago(d.created_at)}</span>
                      </div>
                      <div className="truncate text-xs text-ink-700">{d.subject}</div>
                      <div className="mt-0.5 truncate text-[11px] text-ink-400">
                        {label(d)} · by {d.created_by}
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          </Card>
          {cur && curLead && (
            <Card className="p-5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={cur.branded ? 'violet' : 'stone'}>{cur.branded ? 'Branded look' : 'Plain text'}</Badge>
                <span className="text-xs text-ink-500">{label(cur)}</span>
              </div>
              <dl className="mt-4 grid grid-cols-[56px_1fr] gap-y-1 text-sm">
                <dt className="text-ink-400">From</dt>
                <dd className="text-ink-700">{cur.from_addr}</dd>
                <dt className="text-ink-400">To</dt>
                <dd>
                  <button onClick={() => openContact(curLead.id)} className="text-ink-700 hover:underline">
                    {cur.to_addr} ({curLead.company})
                  </button>
                </dd>
                {cur.cc && (
                  <>
                    <dt className="text-ink-400">CC</dt>
                    <dd className="text-ink-700">{cur.cc}</dd>
                  </>
                )}
              </dl>
              <div className={`mt-4 rounded-xl p-5 ring-1 ring-inset ring-line ${cur.branded ? 'bg-white' : 'bg-panel'}`}>
                {cur.branded && <div className="mb-4 text-sm font-semibold text-accent-700">Reboot Media</div>}
                <div className="text-base font-semibold text-ink-900">{cur.subject}</div>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-ink-700">{cur.body}</p>
              </div>
              <div className="mt-4 flex flex-wrap justify-end gap-2">
                <Button variant="danger" onClick={() => remove('emails', cur.id)}>
                  Reject
                </Button>
                <Button variant="primary" onClick={() => approve([cur.id])}>
                  <Icon name="check" /> Approve this one
                </Button>
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
