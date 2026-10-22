import { useState } from 'react'
import { Badge, Button, Card, CardHead, Field, Icon, Modal, PageHeader, Select, Td, Th, inputCls, pct } from '../components/ui'
import { ago, uid } from '../lib/format'
import { emailStats, matchesList } from '../lib/metrics'
import { useData } from '../lib/store'
import type { Campaign, Email } from '../lib/types'

export function Campaigns() {
  const { me, data, save } = useData()
  const [edit, setEdit] = useState<Campaign | null>(null)
  const [msg, setMsg] = useState('')

  // Turn a campaign into drafts: list members split at random across variants.
  async function build(c: Campaign) {
    const list = data.lists.find((l) => l.id === c.list_id)
    if (!list) return
    const already = new Set(data.emails.filter((e) => e.campaign_id === c.id).map((e) => e.lead_id))
    const leads = data.leads.filter((l) => matchesList(l, { ...list.filter, has_email: true }) && !already.has(l.id) && l.status !== 'dnc')
    const t = new Date().toISOString()
    const fill = (s: string, l: (typeof leads)[0]) =>
      s
        .replaceAll('{first}', l.first_name || 'there')
        .replaceAll('{company}', l.company)
        .replaceAll('{city}', l.city)
    for (const l of leads) {
      const v = c.variants[Math.floor(Math.random() * c.variants.length)]
      const e: Email = {
        id: uid(),
        lead_id: l.id,
        direction: 'out',
        from_addr: data.settings.sender,
        to_addr: l.email,
        cc: data.settings.cc,
        subject: fill(v.subject, l),
        body: fill(v.body, l),
        branded: true,
        status: 'draft',
        sequence_id: null,
        step: null,
        campaign_id: c.id,
        variant: v.key,
        sent_at: null,
        opens: 0,
        clicks: 0,
        first_open_at: null,
        last_open_at: null,
        replied_at: null,
        created_by: me.name,
        created_at: t,
      }
      await save('emails', e)
    }
    await save('campaigns', { ...c, status: 'scheduled' })
    setMsg(`${leads.length} drafts are waiting in Approvals for "${c.name}".`)
  }

  return (
    <div>
      <PageHeader
        title="Campaigns"
        sub="One-off branded blasts to a list, with an A/B split judged by replies and bookings, not just opens."
        actions={
          <Button
            variant="primary"
            onClick={() =>
              setEdit({
                id: uid(),
                name: '',
                list_id: data.lists[0]?.id || null,
                status: 'draft',
                variants: [{ key: 'A', subject: '', body: 'Hi {first},\n\n\n\nKendall' }],
                scheduled_at: null,
                created_at: new Date().toISOString(),
              })
            }
          >
            <Icon name="plus" /> New campaign
          </Button>
        }
      />
      {msg && <div className="mb-4 rounded-lg bg-sage-50 px-3 py-2 text-sm text-sage-700 ring-1 ring-inset ring-sage-400/30">{msg}</div>}
      <div className="space-y-4">
        {data.campaigns
          .slice()
          .sort((a, b) => b.created_at.localeCompare(a.created_at))
          .map((c) => {
            const mails = data.emails.filter((e) => e.campaign_id === c.id)
            const list = data.lists.find((l) => l.id === c.list_id)
            const audience = list ? data.leads.filter((l) => matchesList(l, { ...list.filter, has_email: true })).length : 0
            return (
              <Card key={c.id}>
                <CardHead
                  title={c.name || 'Untitled'}
                  sub={`${list?.name || 'No list'} · ${audience} roofers · created ${ago(c.created_at)}`}
                  actions={
                    <>
                      <Badge tone={c.status === 'sent' ? 'sage' : c.status === 'scheduled' ? 'violet' : 'stone'}>
                        {c.status === 'sent' ? 'Sent' : c.status === 'scheduled' ? 'In approvals' : 'Draft'}
                      </Badge>
                      <Button size="sm" onClick={() => setEdit(c)}>
                        Edit
                      </Button>
                      {c.status === 'draft' && (
                        <Button size="sm" variant="primary" onClick={() => build(c)} disabled={!c.variants.every((v) => v.subject.trim())}>
                          Build drafts
                        </Button>
                      )}
                    </>
                  }
                />
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-y border-line bg-panel">
                        <Th>Variant</Th>
                        <Th>Subject</Th>
                        <Th className="text-right">Sent</Th>
                        <Th className="text-right">Opened</Th>
                        <Th className="text-right">Clicked</Th>
                        <Th className="text-right">Replied</Th>
                        <Th className="text-right">Booked</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {c.variants.map((v) => {
                        const vm = mails.filter((e) => e.variant === v.key)
                        const st = emailStats(vm)
                        const booked = new Set(vm.map((e) => e.lead_id))
                        const nb = data.meetings.filter((m) => booked.has(m.lead_id) && c.scheduled_at && m.created_at >= c.scheduled_at).length
                        return (
                          <tr key={v.key} className="border-t border-line first:border-t-0">
                            <Td>
                              <span className="grid h-6 w-6 place-items-center rounded-md bg-wash text-xs font-semibold ring-1 ring-inset ring-line">{v.key}</span>
                            </Td>
                            <Td className="max-w-[280px] truncate text-ink-700">{v.subject || <i className="text-ink-400">no subject</i>}</Td>
                            <Td className="tabular text-right">{st.sent || vm.length}</Td>
                            <Td className="tabular text-right">{pct(st.opened, st.delivered)}</Td>
                            <Td className="tabular text-right">{pct(st.clicked, st.delivered)}</Td>
                            <Td className="tabular text-right">{pct(st.replied, st.delivered)}</Td>
                            <Td className="tabular text-right font-medium">{nb}</Td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            )
          })}
      </div>
      {edit && <CampaignEditor value={edit} close={() => setEdit(null)} />}
    </div>
  )
}

function CampaignEditor({ value, close }: { value: Campaign; close(): void }) {
  const { data, save } = useData()
  const [c, setC] = useState(value)
  const setV = (i: number, p: Partial<Campaign['variants'][0]>) =>
    setC((x) => ({
      ...x,
      variants: x.variants.map((v, k) => (k === i ? { ...v, ...p } : v)),
    }))
  return (
    <Modal open onClose={close} title={value.name ? 'Edit campaign' : 'New campaign'} wide>
      <div className="space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Name">
            <input value={c.name} onChange={(e) => setC({ ...c, name: e.target.value })} className={inputCls} autoFocus />
          </Field>
          <Field label="Send to list">
            <Select
              value={c.list_id || ''}
              onChange={(v) => setC({ ...c, list_id: v || null })}
              options={data.lists.map((l) => [l.id, l.name] as [string, string])}
              className="h-9 w-full"
            />
          </Field>
        </div>
        {c.variants.map((v, i) => (
          <div key={v.key} className="rounded-xl bg-wash p-3 ring-1 ring-inset ring-line">
            <div className="mb-2 flex items-center justify-between text-xs font-semibold text-ink-900">
              Variant {v.key}
              {c.variants.length > 1 && (
                <button
                  className="text-ink-400 hover:text-ink-900"
                  onClick={() =>
                    setC((x) => ({
                      ...x,
                      variants: x.variants.filter((_, k) => k !== i),
                    }))
                  }
                >
                  Remove
                </button>
              )}
            </div>
            <input
              aria-label={`Variant ${v.key} subject`}
              value={v.subject}
              onChange={(e) => setV(i, { subject: e.target.value })}
              placeholder="Subject"
              className={`${inputCls} mb-2`}
            />
            <textarea aria-label={`Variant ${v.key} body`} value={v.body} onChange={(e) => setV(i, { body: e.target.value })} rows={5} className={inputCls} />
          </div>
        ))}
        <div className="flex flex-wrap justify-between gap-2">
          <Button
            disabled={c.variants.length >= 3}
            onClick={() =>
              setC((x) => ({
                ...x,
                variants: [
                  ...x.variants,
                  {
                    key: 'ABC'[x.variants.length],
                    subject: '',
                    body: x.variants[0].body,
                  },
                ],
              }))
            }
          >
            <Icon name="plus" /> Add A/B variant
          </Button>
          <div className="flex gap-2">
            <Button onClick={close}>Cancel</Button>
            <Button variant="primary" disabled={!c.name.trim()} onClick={() => save('campaigns', c).then(close)}>
              Save
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
