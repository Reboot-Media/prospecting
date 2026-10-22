import type { Activity, Callback, Lead, Pain, Status } from './types'

// Fictional sample data for demo mode only. Phone numbers use the 555-01xx
// range reserved for fiction, so nothing here can ring a real person.

const FIRST = ['Mike', 'Jason', 'Travis', 'Cody', 'Ray', 'Derek', 'Luis', 'Brent', 'Marcus', 'Wade', 'Tony', 'Kyle', 'Shane', 'Hector', 'Dale', 'Rusty', 'Aaron', 'Blake']
const LAST = ['Hollis', 'Garza', 'Pruitt', 'Whitaker', 'Moreno', 'Kessler', 'Dunlap', 'Arnett', 'Salinas', 'Bowers', 'Crane', 'Teague', 'Villa', 'Hutto', 'Ramsey', 'Odom', 'Pace', 'Lyle']
const WORD = ['Lone Star', 'Hill Country', 'Bluebonnet', 'Trinity', 'Pecos', 'Brazos', 'Redline', 'Summit', 'Ironclad', 'Cedar Ridge', 'Frontier', 'Keystone', 'Liberty', 'Mesa', 'Caprock', 'Guadalupe', 'Big Sky', 'Sabine']
const KIND = ['Roofing', 'Roofing & Exteriors', 'Roof Co.', 'Roofing Group', 'Roofing LLC', 'Roof Pros']
const CITY: [string, string][] = [
  ['Austin', 'TX'], ['San Antonio', 'TX'], ['Round Rock', 'TX'], ['New Braunfels', 'TX'], ['Waco', 'TX'],
  ['Georgetown', 'TX'], ['San Marcos', 'TX'], ['Temple', 'TX'], ['Killeen', 'TX'], ['Pflugerville', 'TX'],
]
const PAINS: Pain[] = ['never-ads', 'never-ads', 'never-ads', 'ads-stopped', 'ads-running']

export function demoData(): { leads: Lead[]; activities: Activity[]; callbacks: Callback[] } {
  const now = Date.now()
  const iso = (ms: number) => new Date(ms).toISOString()
  const leads: Lead[] = []
  for (let i = 0; i < 36; i++) {
    const [city, state] = CITY[i % CITY.length]
    const status: Status = i < 24 ? 'new' : i < 30 ? 'attempting' : i < 33 ? 'callback' : i < 35 ? 'booked' : 'not_interested'
    const company = `${WORD[i % WORD.length]} ${KIND[i % KIND.length]}`
    leads.push({
      id: crypto.randomUUID(),
      ghl_id: null,
      first_name: FIRST[i % FIRST.length],
      last_name: LAST[(i * 7) % LAST.length],
      company,
      phone: `+1512555${String(100 + i).padStart(4, '0')}`,
      email: '',
      city,
      state,
      website: '',
      pain: PAINS[i % PAINS.length],
      status,
      owner: i % 2 === 0 ? 'K' : 'Ali',
      tags: ['call', PAINS[i % PAINS.length]],
      notes: '',
      attempts: status === 'new' ? 0 : 1 + (i % 3),
      last_outcome: status === 'new' ? null : status === 'attempting' ? 'voicemail' : status === 'callback' ? 'callback' : status === 'booked' ? 'booked' : 'not_interested',
      last_called_at: status === 'new' ? null : iso(now - (i % 5) * 3600e3 - 600e3),
      meeting_at: status === 'booked' ? iso(now + 864e5 + (i % 2) * 3600e3) : null,
      why_now: status === 'booked' ? 'slow months after storm season' : '',
      created_at: iso(now - 864e5 * 3),
      updated_at: iso(now - 3600e3),
    })
  }

  const activities: Activity[] = leads
    .filter((l) => l.last_outcome)
    .map((l) => ({
      id: crypto.randomUUID(),
      lead_id: l.id,
      user_name: l.owner || 'K',
      outcome: l.last_outcome!,
      note: l.last_outcome === 'callback' ? 'Asked to call back' : '',
      created_at: l.last_called_at!,
    }))

  const cbLeads = leads.filter((l) => l.status === 'callback')
  const dues = [now - 25 * 60e3, now + 2 * 60e3, now + 864e5]
  const reasons = ['Busy, on a roof', 'Talk to partner first', 'Driving']
  const callbacks: Callback[] = cbLeads.map((l, i) => ({
    id: crypto.randomUUID(),
    lead_id: l.id,
    owner: i === 2 ? 'Ali' : 'K',
    due_at: iso(dues[i]),
    reason: reasons[i],
    done_at: null,
    created_by: 'K',
    created_at: iso(now - 3 * 3600e3),
  }))

  return { leads, activities, callbacks }
}
