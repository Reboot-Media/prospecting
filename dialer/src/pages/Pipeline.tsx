import { useState } from 'react'
import { Avatar, Card, PageHeader, Select, StatStrip } from '../components/ui'
import { STAGE_LABEL, STAGES } from '../lib/constants'
import { ago, when } from '../lib/format'
import { money } from '../lib/metrics'
import { useData } from '../lib/store'
import type { Stage } from '../lib/types'

const OPEN: Stage[] = ['booked', 'confirmed', 'showed', 'proposal']
const DOT: Record<Stage, string> = {
  booked: 'bg-accent-400',
  confirmed: 'bg-mist-400',
  showed: 'bg-sand-400',
  proposal: 'bg-sand-600',
  won: 'bg-sage-400',
  no_show: 'bg-clay-400',
  lost: 'bg-ink-300',
}

export function Pipeline({ openContact }: { openContact(id: string): void }) {
  const { data, setStage } = useData()
  const [drag, setDrag] = useState('')
  const [over, setOver] = useState<Stage | ''>('')
  const [who, setWho] = useState('all')
  const deals = data.leads.filter((l) => l.stage && (who === 'all' || l.owner === who))
  const open = deals.filter((l) => OPEN.includes(l.stage!))
  const won = deals.filter((l) => l.stage === 'won')
  const lost = deals.filter((l) => l.stage === 'lost' || l.stage === 'no_show')
  const closed = won.length + lost.length

  return (
    <div>
      <PageHeader
        title="Pipeline"
        sub="Drag a card to move it. Booked stays booked until he texts YES."
        actions={<Select label="Owner" value={who} onChange={setWho} options={[['all', 'Everyone'], ...data.settings.callers.map((c) => [c, c] as [string, string])]} />}
      />
      <div className="mb-5">
        <StatStrip
          items={[
            { label: 'Open pipeline', icon: 'dollar', value: money(open.reduce((a, l) => a + (l.deal_value || 0), 0)), sub: `${open.length} open deals` },
            { label: 'Waiting on YES', icon: 'message', value: deals.filter((l) => l.stage === 'booked').length, sub: 'Booked, not confirmed' },
            { label: 'Signed', icon: 'check', value: won.length, sub: money(won.reduce((a, l) => a + (l.deal_value || 0), 0)) + ' first 90 days' },
            { label: 'Close rate', icon: 'chart', value: closed ? `${Math.round((won.length / closed) * 100)}%` : '–', sub: `${closed} decided` },
          ]}
        />
      </div>
      <div className="-mx-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
        <div className="grid min-w-[1100px] grid-cols-7 gap-3">
          {STAGES.map((s) => {
            const cards = deals.filter((l) => l.stage === s).sort((a, b) => (a.meeting_at || '').localeCompare(b.meeting_at || ''))
            return (
              <div
                key={s}
                onDragOver={(e) => (e.preventDefault(), setOver(s))}
                onDragLeave={() => setOver('')}
                onDrop={() => {
                  const l = data.leads.find((x) => x.id === drag)
                  if (l) setStage(l, s)
                  setDrag('')
                  setOver('')
                }}
                className={`flex min-h-[420px] flex-col rounded-xl p-2 transition-colors ${over === s ? 'bg-accent-50 ring-1 ring-inset ring-accent-200' : 'bg-wash'}`}
              >
                <div className="flex items-center gap-2 px-1.5 pb-2 pt-1">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${DOT[s]}`} />
                  <span className="text-xs font-semibold text-ink-900">{STAGE_LABEL[s]}</span>
                  <span className="tabular text-xs text-ink-400">{cards.length}</span>
                  <span className="tabular ml-auto text-[11px] text-ink-400">{money(cards.reduce((a, l) => a + (l.deal_value || 0), 0))}</span>
                </div>
                <div className="space-y-2">
                  {cards.map((l) => (
                    <Card key={l.id} className={`cursor-grab p-3 active:cursor-grabbing ${drag === l.id ? 'opacity-50' : ''}`}>
                      <div draggable onDragStart={() => setDrag(l.id)} onDragEnd={() => setDrag('')}>
                        <button onClick={() => openContact(l.id)} className="block w-full text-left">
                          <div className="truncate text-sm font-medium text-ink-900">{l.company}</div>
                          <div className="truncate text-xs text-ink-500">{l.city}</div>
                          {l.why_now && <div className="mt-1.5 line-clamp-2 text-xs italic text-ink-500">"{l.why_now}"</div>}
                        </button>
                        <div className="mt-2 truncate text-[11px] text-ink-500">{l.meeting_at ? when(l.meeting_at) : `Moved ${ago(l.updated_at)}`}</div>
                        <div className="mt-1.5 flex items-center gap-2 text-[11px] text-ink-500">
                          {l.owner && <Avatar name={l.owner} className="h-5 w-5 text-[8px]" />}
                          <span className="truncate">{l.owner}</span>
                          <span className="tabular ml-auto font-medium text-ink-700">{money(l.deal_value || 0)}</span>
                        </div>
                        <select
                          aria-label={`Move ${l.company}`}
                          value={s}
                          onChange={(e) => setStage(l, e.target.value as Stage)}
                          className="mt-2 h-7 w-full rounded-md border border-line bg-white px-1.5 text-[11px] text-ink-700 lg:hidden"
                        >
                          {STAGES.map((x) => (
                            <option key={x} value={x}>
                              Move to {STAGE_LABEL[x]}
                            </option>
                          ))}
                        </select>
                      </div>
                    </Card>
                  ))}
                  {cards.length === 0 && <div className="rounded-lg border border-dashed border-line px-2 py-6 text-center text-[11px] text-ink-400">Drop here</div>}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
