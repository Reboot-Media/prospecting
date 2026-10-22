import { useEffect, useMemo, useState } from 'react'
import { Avatar, Badge, Button, Card, Empty, Icon, PageHeader, SearchInput, Tabs, inputCls } from '../components/ui'
import { ago, fullName, when } from '../lib/format'
import { useData } from '../lib/store'
import type { Email } from '../lib/types'

type Filter = 'needs' | 'replies' | 'opened' | 'sent' | 'bounced'

// One thread per roofer: every email in and out, with what tracking saw.
export function Inbox({ openContact }: { openContact(id: string): void }) {
  const { data, leadById, draftEmail } = useData()
  const [filter, setFilter] = useState<Filter>('needs')
  const [q, setQ] = useState('')
  const [sel, setSel] = useState('')
  const [reply, setReply] = useState('')
  const [sent, setSent] = useState(false)

  const threads = useMemo(() => {
    const by = new Map<string, Email[]>()
    for (const e of data.emails) {
      if (e.status === 'draft') continue
      const l = by.get(e.lead_id) || []
      l.push(e)
      by.set(e.lead_id, l)
    }
    return [...by.entries()]
      .map(([lead_id, list]) => {
        list.sort((a, b) => (a.sent_at || a.created_at).localeCompare(b.sent_at || b.created_at))
        const last = list[list.length - 1]
        return {
          lead_id,
          list,
          last,
          at: last.sent_at || last.created_at,
          needs: last.direction === 'in',
          replies: list.some((e) => e.direction === 'in'),
          opens: list.reduce((a, e) => a + e.opens, 0),
          clicks: list.reduce((a, e) => a + e.clicks, 0),
          bounced: list.some((e) => e.status === 'bounced'),
        }
      })
      .sort((a, b) => b.at.localeCompare(a.at))
  }, [data.emails])

  const shown = threads.filter((t) => {
    const l = leadById.get(t.lead_id)
    if (q && !`${l?.company} ${l && fullName(l)} ${t.last.subject}`.toLowerCase().includes(q.toLowerCase())) return false
    if (filter === 'needs') return t.needs
    if (filter === 'replies') return t.replies
    if (filter === 'opened') return t.opens > 0 && !t.replies
    if (filter === 'bounced') return t.bounced
    return true
  })

  useEffect(() => {
    if (!shown.some((t) => t.lead_id === sel)) setSel(window.innerWidth >= 768 ? shown[0]?.lead_id || '' : '')
  }, [filter, q, shown.length]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    setReply('')
    setSent(false)
  }, [sel])

  const t = threads.find((x) => x.lead_id === sel)
  const lead = sel ? leadById.get(sel) : undefined
  const pending = data.emails.filter((e) => e.lead_id === sel && e.status === 'draft')
  const count = (f: Filter) => threads.filter((t) => (f === 'needs' ? t.needs : f === 'replies' ? t.replies : f === 'opened' ? t.opens > 0 && !t.replies : f === 'bounced' ? t.bounced : true)).length

  return (
    <div>
      <PageHeader title="Inbox" sub="Replies, opens and clicks from every roofer you've emailed." />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Tabs
          value={filter}
          onChange={setFilter}
          items={[
            { key: 'needs', label: 'Needs reply', count: count('needs') },
            { key: 'replies', label: 'All replies', count: count('replies') },
            { key: 'opened', label: 'Opened, no reply', count: count('opened') },
            { key: 'sent', label: 'All', count: threads.length },
            { key: 'bounced', label: 'Bounced', count: count('bounced') },
          ]}
        />
        <SearchInput value={q} onChange={setQ} placeholder="Search inbox" className="w-full sm:ml-auto sm:w-64" />
      </div>
      <Card className="grid grid-cols-1 overflow-hidden md:h-[calc(100vh-15rem)] md:min-h-[520px] md:grid-cols-[320px_1fr]">
        <ul className={`overflow-y-auto border-line md:border-r ${sel ? 'hidden md:block' : ''}`}>
          {shown.length === 0 && <li className="p-6 text-center text-sm text-ink-500">Nothing here.</li>}
          {shown.map((th) => {
            const l = leadById.get(th.lead_id)
            const on = th.lead_id === sel
            return (
              <li key={th.lead_id}>
                <button onClick={() => setSel(th.lead_id)} className={`flex w-full gap-3 border-b border-line px-4 py-3 text-left ${on ? 'bg-panel' : 'hover:bg-panel'}`}>
                  <Avatar name={l?.company || '?'} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className={`truncate text-sm ${th.needs ? 'font-semibold text-ink-900' : 'font-medium text-ink-700'}`}>{l?.company}</span>
                      <span className="ml-auto shrink-0 text-[11px] text-ink-400">{ago(th.at)}</span>
                    </div>
                    <div className="truncate text-xs text-ink-500">{th.last.direction === 'in' ? th.last.body : th.last.subject}</div>
                    <div className="mt-1 flex gap-1.5">
                      {th.needs && <Badge tone="sage">Replied</Badge>}
                      {th.opens > 0 && (
                        <Badge tone="violet" dot={false}>
                          <Icon name="eye" className="h-3 w-3" /> {th.opens}
                        </Badge>
                      )}
                      {th.clicks > 0 && (
                        <Badge tone="sand" dot={false}>
                          <Icon name="cursor" className="h-3 w-3" /> {th.clicks}
                        </Badge>
                      )}
                      {th.bounced && <Badge tone="clay">Bounced</Badge>}
                    </div>
                  </div>
                </button>
              </li>
            )
          })}
        </ul>
        <div className={`flex min-h-0 min-w-0 flex-col ${sel ? '' : 'hidden md:flex'}`}>
          {!t || !lead ? (
            <Empty title="Pick a conversation" />
          ) : (
            <>
              <div className="flex items-center gap-3 border-b border-line px-4 py-3">
                <button className="rounded-md p-1 text-ink-500 hover:bg-wash md:hidden" onClick={() => setSel('')} aria-label="Back">
                  <Icon name="left" />
                </button>
                <div className="min-w-0 flex-1">
                  <button onClick={() => openContact(lead.id)} className="truncate text-sm font-semibold text-ink-900 hover:underline">
                    {lead.company}
                  </button>
                  <div className="truncate text-xs text-ink-500">
                    {fullName(lead)} · {lead.email}
                  </div>
                </div>
                <a href={`tel:${lead.phone}`} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-sage-600 px-3 text-xs font-semibold text-white hover:bg-sage-700">
                  <Icon name="phone" className="h-3.5 w-3.5" /> Call
                </a>
              </div>
              <div className="flex-1 space-y-3 overflow-y-auto bg-panel p-4">
                {t.list.map((e) => (
                  <div key={e.id} className={`max-w-[92%] rounded-xl p-3.5 text-sm shadow-card ${e.direction === 'in' ? 'bg-white' : 'ml-auto bg-white ring-1 ring-inset ring-accent-200/60'}`}>
                    <div className="mb-1 flex flex-wrap items-baseline gap-x-2 text-xs">
                      <span className="font-medium text-ink-900">{e.direction === 'in' ? fullName(lead) || lead.company : 'You'}</span>
                      <span className="text-ink-400">{when(e.sent_at || e.created_at)}</span>
                      {e.branded && <span className="text-ink-400">· branded</span>}
                    </div>
                    <div className="font-medium text-ink-900">{e.subject}</div>
                    <p className="mt-1 whitespace-pre-wrap leading-relaxed text-ink-700">{e.body}</p>
                    {e.direction === 'out' && (
                      <div className="mt-2 flex flex-wrap gap-x-3 border-t border-line pt-2 text-[11px] text-ink-500">
                        {e.status === 'bounced' ? (
                          <span className="text-clay-600">Bounced: address doesn't exist</span>
                        ) : (
                          <>
                            <span>{e.opens ? `Opened ${e.opens}× · last ${ago(e.last_open_at)}` : 'Not opened yet'}</span>
                            <span>{e.clicks ? `Clicked ${e.clicks}×` : 'No clicks'}</span>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                {pending.map((e) => (
                  <div key={e.id} className="ml-auto max-w-[92%] rounded-xl border border-dashed border-accent-400/50 bg-accent-50/50 p-3.5 text-sm">
                    <div className="mb-1 text-xs font-medium text-accent-700">Waiting for approval</div>
                    <div className="font-medium text-ink-900">{e.subject}</div>
                    <p className="mt-1 whitespace-pre-wrap text-ink-700">{e.body}</p>
                  </div>
                ))}
              </div>
              <form
                className="border-t border-line p-3"
                onSubmit={async (ev) => {
                  ev.preventDefault()
                  if (!reply.trim()) return
                  const subj = t.last.subject.startsWith('Re:') ? t.last.subject : `Re: ${t.last.subject}`
                  await draftEmail(lead, subj, reply.trim(), false)
                  setReply('')
                  setSent(true)
                }}
              >
                <textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={3} placeholder={`Reply to ${lead.first_name || lead.company}…`} className={inputCls} />
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className="text-xs text-ink-400">{sent ? 'Sent to Approvals.' : 'Replies go to Approvals first. Warm replies: keep it short, video + booking link.'}</span>
                  <Button variant="primary" type="submit" disabled={!reply.trim() || lead.email_status !== 'ok'}>
                    <Icon name="send" /> Queue reply
                  </Button>
                </div>
              </form>
            </>
          )}
        </div>
      </Card>
    </div>
  )
}
