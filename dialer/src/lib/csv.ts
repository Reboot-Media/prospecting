import type { Lead, Pain } from './types'
import { e164, uid } from './format'

// RFC 4180-ish CSV parser: quotes, escaped quotes, commas and newlines inside quotes.
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let q = false
  const s = text.replace(/^﻿/, '')
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (q) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          field += '"'
          i++
        } else q = false
      } else field += c
    } else if (c === '"') q = true
    else if (c === ',') {
      row.push(field)
      field = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i++
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else field += c
  }
  if (field || row.length) {
    row.push(field)
    rows.push(row)
  }
  return rows.filter((r) => r.some((x) => x.trim() !== ''))
}

export type Field = 'ghl_id' | 'first_name' | 'last_name' | 'full_name' | 'company' | 'phone' | 'email' | 'city' | 'state' | 'website' | 'tags'

export const FIELD_LABEL: Record<Field, string> = {
  ghl_id: 'GHL contact ID',
  first_name: 'First name',
  last_name: 'Last name',
  full_name: 'Full name',
  company: 'Company',
  phone: 'Phone',
  email: 'Email',
  city: 'City',
  state: 'State',
  website: 'Website',
  tags: 'Tags',
}

// Header names seen in GHL contact exports and common scraper CSVs.
const GUESS: Record<Field, string[]> = {
  ghl_id: ['contact id', 'id', 'contact_id'],
  first_name: ['first name', 'firstname', 'first_name'],
  last_name: ['last name', 'lastname', 'last_name'],
  full_name: ['name', 'full name', 'contact name', 'owner name'],
  company: ['business name', 'company name', 'company', 'business', 'companyname'],
  phone: ['phone', 'phone number', 'mobile', 'phone 1', 'phone_number'],
  email: ['email', 'email address'],
  city: ['city'],
  state: ['state'],
  website: ['website', 'site', 'url', 'domain'],
  tags: ['tags', 'tag'],
}

export function guessMapping(headers: string[]): Partial<Record<Field, number>> {
  const norm = headers.map((h) => h.trim().toLowerCase())
  const map: Partial<Record<Field, number>> = {}
  for (const f of Object.keys(GUESS) as Field[]) {
    const i = norm.findIndex((h) => GUESS[f].includes(h))
    if (i >= 0) map[f] = i
  }
  return map
}

export function painFromTags(tags: string[]): Pain {
  if (tags.includes('ads-running')) return 'ads-running'
  if (tags.includes('ads-stopped')) return 'ads-stopped'
  if (tags.includes('never-ads')) return 'never-ads'
  return 'unknown'
}

export interface ImportOptions {
  onlyTag: string // keep rows carrying this tag ('' = all)
  skipTags: string[] // drop rows carrying any of these
  owner: string | null
}

export interface ImportResult {
  rows: Lead[]
  skippedNoPhone: number
  skippedDuplicate: number
  skippedByTag: number
}

export function buildLeads(
  table: string[][],
  map: Partial<Record<Field, number>>,
  opts: ImportOptions,
  existingPhones: Set<string>,
): ImportResult {
  const [, ...body] = table
  const get = (r: string[], f: Field) => (map[f] !== undefined ? (r[map[f]!] || '').trim() : '')
  const seen = new Set(existingPhones)
  const res: ImportResult = { rows: [], skippedNoPhone: 0, skippedDuplicate: 0, skippedByTag: 0 }
  const t = new Date().toISOString()
  const only = opts.onlyTag.trim().toLowerCase()
  const skip = opts.skipTags.map((s) => s.trim().toLowerCase()).filter(Boolean)

  for (const r of body) {
    const tags = get(r, 'tags')
      .split(/[,;|]/)
      .map((x) => x.trim().toLowerCase())
      .filter(Boolean)
    if ((only && !tags.includes(only)) || tags.some((x) => skip.includes(x))) {
      res.skippedByTag++
      continue
    }
    const phone = e164(get(r, 'phone'))
    const email = get(r, 'email').toLowerCase()
    const okPhone = phone.length >= 11
    if (!okPhone && !email) {
      res.skippedNoPhone++
      continue
    }
    if ((okPhone && seen.has(phone)) || (email && seen.has(email))) {
      res.skippedDuplicate++
      continue
    }
    if (okPhone) seen.add(phone)
    if (email) seen.add(email)
    let first = get(r, 'first_name')
    let last = get(r, 'last_name')
    if (!first && !last && get(r, 'full_name')) {
      const parts = get(r, 'full_name').split(/\s+/)
      first = parts.shift() || ''
      last = parts.join(' ')
    }
    res.rows.push({
      id: uid(),
      ghl_id: get(r, 'ghl_id') || null,
      first_name: first,
      last_name: last,
      company: get(r, 'company') || [first, last].filter(Boolean).join(' ') || 'Unknown company',
      phone: okPhone ? phone : '',
      email,
      city: get(r, 'city'),
      state: get(r, 'state'),
      website: get(r, 'website'),
      pain: painFromTags(tags),
      segment: tags.includes('shark') ? 'shark' : tags.includes('commercial') ? 'commercial' : 'growing',
      status: tags.includes('dnc') ? 'dnc' : 'new',
      stage: tags.includes('client') ? 'won' : null,
      deal_value: 0,
      source: 'GHL import',
      sequence_id: null,
      sequence_step: 0,
      sequence_state: null,
      email_status: 'ok',
      owner: opts.owner,
      tags,
      notes: '',
      attempts: 0,
      last_outcome: null,
      last_called_at: null,
      meeting_at: null,
      why_now: '',
      created_at: t,
      updated_at: t,
    })
  }
  return res
}
