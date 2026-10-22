import { useMemo, useState } from 'react'
import { Button, Card, Field, PageHeader, PainBadge, Select, inputCls } from '../components/ui'
import { FIELD_LABEL, buildLeads, guessMapping, parseCsv, type Field as F } from '../lib/csv'
import { prettyPhone } from '../lib/format'
import { useData } from '../lib/store'

const DEFAULT_SKIP = 'not-a-lead'

export function Import({ done }: { done(): void }) {
  const { me, data, importLeads } = useData()
  const [name, setName] = useState('')
  const [table, setTable] = useState<string[][]>([])
  const [map, setMap] = useState<Partial<Record<F, number>>>({})
  const [onlyTag, setOnlyTag] = useState('')
  const [skip, setSkip] = useState(DEFAULT_SKIP)
  const [owner, setOwner] = useState('split')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  const headers = table[0] || []
  const callers = Array.from(new Set([...data.settings.callers, me.name]))

  const result = useMemo(() => {
    if (!table.length) return null
    const existing = new Set(data.leads.flatMap((l) => [l.phone, l.email.toLowerCase()].filter(Boolean)))
    const r = buildLeads(
      table,
      map,
      {
        onlyTag,
        skipTags: skip.split(','),
        owner: owner === 'split' || owner === 'none' ? null : owner,
      },
      existing,
    )
    if (owner === 'split') r.rows.forEach((l, i) => (l.owner = callers[i % callers.length]))
    return r
  }, [table, map, onlyTag, skip, owner, data.leads, callers.join('|')])

  async function onFile(f: File) {
    setMsg('')
    setName(f.name)
    const t = parseCsv(await f.text())
    setTable(t)
    setMap(guessMapping(t[0] || []))
    // A file with no tags column can't be filtered by tag.
    if (!guessMapping(t[0] || []).tags) setOnlyTag('')
  }

  async function run() {
    if (!result?.rows.length) return
    setBusy(true)
    await importLeads(result.rows)
    setBusy(false)
    setMsg(`Imported ${result.rows.length} contacts.`)
    setTable([])
    setName('')
    done()
  }

  return (
    <div className="max-w-4xl">
      <PageHeader title="Import" sub="Bring every GHL contact over in one go. Tags, pain lane and segment come with them. Duplicates (same phone or email) are skipped." />
      {msg && <div className="mb-4 rounded-lg bg-sage-50 px-3 py-2 text-sm text-sage-700">{msg}</div>}
      <Card className="p-5">
        <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-ink-300 bg-wash px-6 py-10 text-center hover:bg-canvas">
          <span className="text-sm font-medium text-ink-900">{name || 'Choose a CSV file'}</span>
          <span className="mt-1 text-xs text-ink-500">In GHL: Contacts → select all → Export. Keep the Tags column.</span>
          <input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
        </label>

        {headers.length > 0 && (
          <>
            <h3 className="mb-3 mt-6 text-sm font-semibold text-ink-900">Columns</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {(Object.keys(FIELD_LABEL) as F[]).map((f) => (
                <Field key={f} label={FIELD_LABEL[f]}>
                  <Select
                    value={map[f] === undefined ? '' : String(map[f])}
                    onChange={(v) =>
                      setMap((m) => ({
                        ...m,
                        [f]: v === '' ? undefined : Number(v),
                      }))
                    }
                    options={[['', '—'], ...headers.map((h, i) => [String(i), h] as [string, string])]}
                    className="w-full"
                  />
                </Field>
              ))}
            </div>

            <h3 className="mb-3 mt-6 text-sm font-semibold text-ink-900">Which rows</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Field label="Only rows tagged" hint="Blank imports every row. Use call for the dial list only.">
                <input value={onlyTag} onChange={(e) => setOnlyTag(e.target.value)} className={inputCls} />
              </Field>
              <Field label="Skip rows tagged" hint="Comma separated.">
                <input value={skip} onChange={(e) => setSkip(e.target.value)} className={inputCls} />
              </Field>
              <Field label="Owner">
                <Select
                  value={owner}
                  onChange={setOwner}
                  options={[['split', `Split evenly (${callers.join(' / ')})`], ['none', 'Unassigned'], ...callers.map((c) => [c, c] as [string, string])]}
                  className="w-full"
                />
              </Field>
            </div>

            {result && (
              <div className="mt-6 rounded-xl bg-wash p-4 ring-1 ring-inset ring-line">
                <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
                  <span>
                    <b className="text-ink-900">{result.rows.length}</b> <span className="text-ink-500">to import</span>
                  </span>
                  <span className="text-ink-500">{result.skippedDuplicate} duplicates</span>
                  <span className="text-ink-500">{result.skippedByTag} skipped by tag</span>
                  <span className="text-ink-500">{result.skippedNoPhone} without phone or email</span>
                </div>
                <ul className="mt-3 divide-y divide-line text-sm">
                  {result.rows.slice(0, 5).map((l) => (
                    <li key={l.id} className="flex items-center justify-between gap-3 py-2">
                      <span className="truncate font-medium text-ink-900">{l.company}</span>
                      <span className="flex items-center gap-3 text-ink-500">
                        {prettyPhone(l.phone)}
                        <PainBadge pain={l.pain} />
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="mt-5 flex justify-end">
              <Button variant="primary" onClick={run} disabled={busy || !result?.rows.length || (map.phone === undefined && map.email === undefined)}>
                {busy ? 'Importing…' : `Import ${result?.rows.length || 0} contacts`}
              </Button>
            </div>
          </>
        )}
      </Card>
    </div>
  )
}
