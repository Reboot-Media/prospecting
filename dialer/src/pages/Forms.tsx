import { useState } from 'react'
import { Avatar, Badge, Button, Card, CardHead, Empty, Icon, PageHeader, StatStrip, Tabs } from '../components/ui'
import { backend } from '../lib/backend'
import { FORM_LABEL } from '../lib/constants'
import { ago, uid } from '../lib/format'
import { useData } from '../lib/store'
import type { FormSubmission, Lead } from '../lib/types'

const ENDPOINT = (import.meta.env.VITE_SUPABASE_URL as string | undefined)
  ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/crm-form`
  : 'https://<your-project>.supabase.co/functions/v1/crm-form'

export function Forms({ openContact }: { openContact(id: string): void }) {
  const { data, leadById, save, importLeads } = useData()
  const [form, setForm] = useState<'all' | FormSubmission['form']>('all')
  const rows = data.forms.filter((f) => form === 'all' || f.form === form).sort((a, b) => b.created_at.localeCompare(a.created_at))
  const week = new Date(Date.now() - 7 * 864e5).toISOString()
  const count = (k: FormSubmission['form']) => data.forms.filter((f) => f.form === k).length

  async function test() {
    const t = new Date().toISOString()
    const l: Lead = {
      id: uid(),
      ghl_id: null,
      first_name: 'Test',
      last_name: 'Roofer',
      company: 'Test Form Roofing',
      phone: '+15125550999',
      email: 'test@testformroofing.example.com',
      city: 'Austin',
      state: 'TX',
      website: 'testformroofing.example.com',
      pain: 'unknown',
      segment: 'growing',
      status: 'new',
      stage: null,
      deal_value: 0,
      owner: null,
      tags: ['VisibilityCheck'],
      notes: '',
      source: 'Website form',
      attempts: 0,
      last_outcome: null,
      last_called_at: null,
      meeting_at: null,
      why_now: '',
      sequence_id: null,
      sequence_step: 0,
      sequence_state: null,
      email_status: 'ok',
      created_at: t,
      updated_at: t,
    }
    await importLeads([l])
    await save('forms', {
      id: uid(),
      form: 'visibility-check',
      lead_id: l.id,
      page: '/visibility-check',
      fields: {
        name: 'Test Roofer',
        company: l.company,
        email: l.email,
        phone: l.phone,
        city: 'Austin',
        website: l.website,
      },
      created_at: t,
    })
  }

  return (
    <div>
      <PageHeader
        title="Forms"
        sub="Website form fills land here as new contacts, tagged by form, instead of in GHL."
        actions={
          backend.mode === 'demo' && (
            <Button onClick={test}>
              <Icon name="bolt" /> Send a test fill
            </Button>
          )
        }
      />
      <div className="mb-5">
        <StatStrip
          items={[
            {
              label: 'Visibility Check',
              icon: 'eye',
              value: count('visibility-check'),
            },
            { label: 'Grow', icon: 'chart', value: count('grow') },
            { label: 'Scale', icon: 'layers', value: count('scale') },
            {
              label: 'Last 7 days',
              icon: 'form',
              value: data.forms.filter((f) => f.created_at >= week).length,
              sub: `${data.forms.length} all time`,
            },
          ]}
        />
      </div>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_340px]">
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
            <span className="text-sm font-semibold text-ink-900">Submissions</span>
            <Tabs
              value={form}
              onChange={setForm}
              items={[{ key: 'all' as const, label: 'All' }, ...(Object.entries(FORM_LABEL) as [FormSubmission['form'], string][]).map(([k, v]) => ({ key: k, label: v }))]}
            />
          </div>
          {rows.length === 0 ? (
            <Empty title="No form fills yet" />
          ) : (
            <ul>
              {rows.map((f) => {
                const l = f.lead_id ? leadById.get(f.lead_id) : undefined
                return (
                  <li key={f.id}>
                    <button onClick={() => l && openContact(l.id)} className="flex w-full items-center gap-3 border-b border-line px-4 py-3 text-left hover:bg-panel">
                      <Avatar name={f.fields.company || f.fields.name || '?'} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-ink-900">{f.fields.company || f.fields.name}</div>
                        <div className="truncate text-xs text-ink-500">{[f.fields.name, f.fields.city, f.fields.website].filter(Boolean).join(' · ')}</div>
                      </div>
                      <Badge tone={f.form === 'visibility-check' ? 'violet' : f.form === 'scale' ? 'sand' : 'mist'}>{FORM_LABEL[f.form]}</Badge>
                      <span className="hidden w-20 text-right text-xs text-ink-400 sm:block">{ago(f.created_at)}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>
        <Card>
          <CardHead title="Hook up the website" />
          <div className="space-y-3 px-4 pb-4 text-sm text-ink-700">
            <p>The site's form handler (/api/lead) sends each fill to GHL today. At cutover it also posts here:</p>
            <code className="block break-all rounded-lg bg-wash p-2.5 text-xs text-ink-900 ring-1 ring-inset ring-line">POST {ENDPOINT}</code>
            <p className="text-xs text-ink-500">
              Same fields as now: name, company, email, phone, city, state, website, stage, page. New roofers become contacts; known ones get the form added to their timeline.
              Visibility Check fills get the VisibilityCheck tag.
            </p>
            <p className="text-xs text-ink-500">This changes the live site, so it waits for your go.</p>
          </div>
        </Card>
      </div>
    </div>
  )
}
