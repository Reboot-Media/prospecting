import { advance, isDue, startRun, triggerLabel, type FlowRun, type Workflow } from './flow'
import { recipes } from './recipes'
import { defaultScripts } from './scripts'
import { CALL_EXTRAS } from './constants'
import type {
  CallInsights,
  SiteTags,
  SiteVisit,
  Activity,
  Call,
  Campaign,
  Email,
  EmailEvent,
  FormSubmission,
  Lead,
  Meeting,
  Outcome,
  Pain,
  PhoneNumber,
  Segment,
  Sequence,
  SmartList,
  Stage,
  Status,
  Task,
  Template,
} from './types'

// Fictional sample data for demo mode only. Phone numbers use the 555-01xx
// range reserved for fiction and emails use example.com, so nothing is real.

const FIRST = [
  'Mike',
  'Jason',
  'Travis',
  'Cody',
  'Ray',
  'Derek',
  'Luis',
  'Brent',
  'Marcus',
  'Wade',
  'Tony',
  'Kyle',
  'Shane',
  'Hector',
  'Dale',
  'Rusty',
  'Aaron',
  'Blake',
  'Cole',
  'Grant',
]
const LAST = [
  'Hollis',
  'Garza',
  'Pruitt',
  'Whitaker',
  'Moreno',
  'Kessler',
  'Dunlap',
  'Arnett',
  'Salinas',
  'Bowers',
  'Crane',
  'Teague',
  'Villa',
  'Hutto',
  'Ramsey',
  'Odom',
  'Pace',
  'Lyle',
]
const WORD = [
  'Lone Star',
  'Hill Country',
  'Bluebonnet',
  'Trinity',
  'Pecos',
  'Brazos',
  'Redline',
  'Summit',
  'Ironclad',
  'Cedar Ridge',
  'Frontier',
  'Keystone',
  'Liberty',
  'Mesa',
  'Caprock',
  'Guadalupe',
  'Big Sky',
  'Sabine',
  'Llano',
  'Comal',
]
const KIND = ['Roofing', 'Roofing & Exteriors', 'Roof Co.', 'Roofing Group', 'Roofing LLC', 'Roof Pros']
const CITY: [string, string][] = [
  ['Austin', 'TX'],
  ['San Antonio', 'TX'],
  ['Round Rock', 'TX'],
  ['New Braunfels', 'TX'],
  ['Waco', 'TX'],
  ['Georgetown', 'TX'],
  ['San Marcos', 'TX'],
  ['Temple', 'TX'],
  ['Killeen', 'TX'],
  ['Pflugerville', 'TX'],
  ['Fort Worth', 'TX'],
  ['Plano', 'TX'],
]
const PAINS: Pain[] = ['never-ads', 'never-ads', 'never-ads', 'ads-stopped', 'ads-running']

// Small seeded random so the demo looks the same on every reset.
function rng(seed: number) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

// Profile-card data for a sample roofer: reviews and what their website runs.
function demoProfile(i: number, r: () => number) {
  const tags: SiteTags = {}
  if (i % 3 !== 0) tags.gtm = [`GTM-${(100000 + i * 7919).toString(36).toUpperCase().slice(0, 7)}`]
  if (i % 2 === 0) tags.ga4 = [`G-${(900000 + i * 31).toString(36).toUpperCase()}`]
  if (i % 5 === 1 || i % 5 === 2) tags.google_ads = [`AW-${11000000000 + i * 97}`]
  if (i % 4 === 1) tags.meta_pixel = [String(400000000000000 + i * 131)]
  if (i % 7 === 2) tags.call_tracking = ['CallRail']
  if (i % 6 === 3) tags.chat = ['Podium']
  if (i % 8 === 5) tags.reviews_widget = ['Birdeye']
  if (i % 9 === 4) tags.estimator = ['Roofle']
  tags.builder = ['WordPress', 'Wix', 'Squarespace', 'Webflow', 'GoDaddy'][i % 5]
  const noSite = i % 13 === 7
  return {
    google_rating: i % 10 === 9 ? null : Math.round((3.6 + r() * 1.4) * 10) / 10,
    review_count: i % 10 === 9 ? null : Math.round(4 + r() * (i % 3 === 0 ? 40 : 260)),
    gbp_url: i % 10 === 9 ? '' : 'https://maps.google.com/?cid=demo',
    site_tags: noSite ? { error: 'No website on file' } : tags,
    site_checked_at: noSite ? null : new Date(Date.now() - (i % 9) * 864e5).toISOString(),
  }
}

// A believable summary for a recorded sample call.
function demoTranscript(outcome: string, status: string, first: string, r: () => number): { transcript: string; summary: string; insights: CallInsights | null } {
  if (status !== 'completed') return { ...CALL_EXTRAS }
  const pick = <T>(a: T[]) => a[Math.floor(r() * a.length)]
  const why = pick(['slow months after storm season', 'losing bids to a bigger roofer', 'wants to stop relying on referrals', 'new crew needs steady work'])
  const S: Record<string, [string, CallInsights]> = {
    booked: [
      `${first} runs mostly on referrals and said the phone goes quiet after storm season. Agreed to 30 minutes tomorrow at 9 and will text YES.`,
      { next_step: 'Watch for the YES text; call by end of day if it does not come', pain: 'Phone goes quiet after storm season', why_now: why, sentiment: 'hot', objections: [] },
    ],
    callback: [
      `${first} was on a roof and asked for a call back. Open to talking about slow months.`,
      { next_step: 'Call back at the time he gave', pain: 'Slow months', sentiment: 'warm', objections: ['Busy right now'] },
    ],
    gatekeeper: ['Office manager answered. Owner is out on estimates until the afternoon.', { next_step: 'Try the owner after 3 PM', sentiment: 'warm', objections: [] }],
    not_interested: [
      `${first} said they already have someone handling marketing and are booked out for a month.`,
      { next_step: 'Check back after the backlog clears', sentiment: 'cold', objections: ['We already have someone', "We're booked out"] },
    ],
    dnc: [`${first} asked not to be called again.`, { next_step: 'Do not call', sentiment: 'cold', objections: ['Asked not to be called'] }],
    inbound: [
      `${first} called back about the email and wants to know how the Visibility Check works. Asked about cost.`,
      { next_step: 'Book the call; price comes after the 30 minutes', pain: 'Unsure where jobs are going', sentiment: 'hot', objections: ['How much?'] },
    ],
  }
  const [summary, insights] = S[outcome] || S.callback
  return {
    summary,
    insights,
    transcript: `Kendall: Hey ${first}, it's Kendall with Reboot.\n${first}: Hey, what's this about?\nKendall: How are most of your jobs coming in right now?\n${first}: Mostly referrals, honestly.\n(sample transcript)`,
  }
}

export function demoData() {
  const r = rng(42)
  const now = Date.now()
  const H = 3600e3
  const D = 864e5
  const iso = (ms: number) => new Date(ms).toISOString()
  const id = () => crypto.randomUUID()
  const at = (dayOffset: number, hour: number, min = 0) => {
    const d = new Date()
    d.setDate(d.getDate() + dayOffset)
    d.setHours(hour, min, 0, 0)
    return d.getTime()
  }

  /* sequences ---------------------------------------------------------- */
  const seq = (name: string, lane: Sequence['lane'], hook: string): Sequence => ({
    id: id(),
    name,
    lane,
    status: 'active',
    created_at: iso(now - 20 * D),
    steps: [
      {
        day: 0,
        subject: `Quick Question About {company}`,
        body: `Hi {first},\n\nI searched "roofer {city}" and saw ${hook}.\n\nWorth a quick look at where your next jobs could come from? I can send a free Visibility Check of your area.\n\nKendall Reid\nReboot Media, Austin, Texas`,
        branded: false,
      },
      {
        day: 3,
        subject: `Your Visibility Check, {first}`,
        body: `Hi {first},\n\nHere's how {company} stacks up against the top 3 roofers in {city}. Tap here to see it.\n\nKendall`,
        branded: true,
      },
      {
        day: 7,
        subject: `Jobs That Actually Close`,
        body: `Hi {first},\n\nShort video on how roofers in {city} are getting signed jobs from homeowners who already want to work with them. Tap here.\n\nKendall`,
        branded: true,
      },
      {
        day: 12,
        subject: `Closing The Loop`,
        body: `Hi {first},\n\nShould I close your file? If timing is off, reply "later" and I'll check back after storm season.\n\nKendall`,
        branded: true,
      },
    ],
  })
  const sequences: Sequence[] = [
    seq('Never ran ads', 'never-ads', 'you are not in the map top 3 yet'),
    seq('Ads stopped', 'ads-stopped', 'your ads stopped showing this month'),
    seq('Ads running', 'ads-running', 'your ads are live and I was curious how they are going'),
    {
      ...seq('Shark: scale per market', 'shark', 'you are already a top roofer in {city}'),
      status: 'paused',
    },
  ]
  const seqByLane = (p: Pain) => sequences.find((s) => s.lane === p) || sequences[0]

  /* leads ---------------------------------------------------------------- */
  const leads: Lead[] = []
  const N = 64
  for (let i = 0; i < N; i++) {
    const [city, state] = CITY[i % CITY.length]
    const pain = PAINS[i % PAINS.length]
    const segment: Segment = i % 17 === 5 ? 'shark' : i % 13 === 7 ? 'commercial' : 'growing'
    let status: Status = 'new'
    let stage: Stage | null = null
    if (i >= 24 && i < 36) status = 'attempting'
    else if (i >= 36 && i < 40) status = 'callback'
    else if (i >= 40 && i < 52) {
      status = i % 3 === 0 ? 'booked' : 'confirmed'
      stage = (['booked', 'confirmed', 'showed', 'proposal', 'won', 'no_show', 'confirmed', 'booked', 'showed', 'lost', 'proposal', 'confirmed'] as Stage[])[i - 40]
    } else if (i >= 52 && i < 57) status = 'not_interested'
    else if (i === 57) status = 'bad_number'
    const first = FIRST[i % FIRST.length]
    const company = `${WORD[i % WORD.length]} ${KIND[i % KIND.length]}`
    const slug = company.toLowerCase().replace(/[^a-z]+/g, '')
    const lastOutcome: Outcome | null =
      status === 'new'
        ? null
        : status === 'attempting'
          ? i % 2
            ? 'voicemail'
            : 'no_answer'
          : status === 'callback'
            ? 'callback'
            : status === 'booked'
              ? 'booked'
              : status === 'confirmed'
                ? 'confirmed'
                : status === 'bad_number'
                  ? 'bad_number'
                  : 'not_interested'
    const inSeq = i % 3 !== 2 && segment === 'growing'
    leads.push({
      id: id(),
      ghl_id: null,
      first_name: first,
      last_name: LAST[(i * 7) % LAST.length],
      company,
      phone: `+1512555${String(100 + i).padStart(4, '0')}`,
      email: `${first.toLowerCase()}@${slug}.example.com`,
      city,
      state,
      website: `${slug}.example.com`,
      pain,
      segment,
      status,
      stage,
      deal_value: stage ? 5000 + 3000 * 3 : 0,
      owner: i % 2 === 0 ? 'K' : 'Ali',
      tags: ['call', 'email', pain, ...(segment !== 'growing' ? [segment] : []), ...(i % 2 ? ['ab-growing-a'] : ['ab-growing-b'])],
      notes: '',
      source: i % 11 === 3 ? 'Website form' : 'GHL import',
      attempts: status === 'new' ? 0 : 1 + (i % 4),
      last_outcome: lastOutcome,
      last_called_at: status === 'new' ? null : iso(now - (i % 6) * H - 20 * 60e3),
      meeting_at: null,
      why_now: stage ? ['slow months after storm season', 'losing bids to a bigger roofer', 'wants to stop relying on referrals'][i % 3] : '',
      sequence_id: inSeq ? seqByLane(pain).id : null,
      sequence_step: inSeq ? 1 + (i % 4) : 0,
      sequence_state: inSeq ? (i % 9 === 0 ? 'replied' : i % 14 === 1 ? 'bounced' : 'active') : null,
      email_status: inSeq && i % 14 === 1 ? 'bounced' : 'ok',
      ...demoProfile(i, r),
      created_at: iso(now - 20 * D),
      updated_at: iso(now - H),
    })
  }

  /* activities: two weeks of dialing for the charts --------------------- */
  const activities: Activity[] = []
  const outs: Outcome[] = ['no_answer', 'no_answer', 'no_answer', 'voicemail', 'voicemail', 'gatekeeper', 'not_interested', 'callback', 'booked']
  for (let d = -13; d <= 0; d++) {
    const day = new Date(at(d, 9))
    if (day.getDay() === 0 || day.getDay() === 6) continue
    for (const who of ['K', 'Ali']) {
      const n = d === 0 ? 18 + Math.floor(r() * 10) : 55 + Math.floor(r() * 50)
      for (let k = 0; k < n; k++) {
        const l = leads[Math.floor(r() * N)]
        const minute = Math.floor((k / n) * 8 * 60)
        if (at(d, 8, 30) + minute * 60e3 > now - 10 * 60e3) continue // nothing in the future
        activities.push({
          id: id(),
          lead_id: l.id,
          user_name: who,
          outcome: outs[Math.floor(r() * outs.length)],
          note: '',
          created_at: iso(at(d, 8, 30) + minute * 60e3),
        })
      }
    }
  }
  for (const l of leads) {
    if (l.last_outcome && l.last_called_at) {
      activities.push({
        id: id(),
        lead_id: l.id,
        user_name: l.owner || 'K',
        outcome: l.last_outcome,
        note: l.last_outcome === 'callback' ? 'Asked to call back' : '',
        created_at: l.last_called_at,
      })
    }
  }

  /* tasks ---------------------------------------------------------------- */
  const cbLeads = leads.filter((l) => l.status === 'callback')
  const dues = [now - 25 * 60e3, now + 2 * 60e3, now + 3 * H, now + D]
  const reasons = ['Busy, on a roof', 'Talk to partner first', 'Driving', 'After storm season']
  const tasks: Task[] = cbLeads.map((l, i) => ({
    id: id(),
    lead_id: l.id,
    kind: 'callback',
    owner: i === 2 ? 'Ali' : 'K',
    due_at: iso(dues[i]),
    reason: reasons[i],
    done_at: null,
    created_by: 'K',
    created_at: iso(now - 3 * H),
  }))
  tasks.push({
    id: id(),
    lead_id: null,
    kind: 'todo',
    owner: 'K',
    due_at: iso(at(0, 16)),
    reason: 'Export GHL contacts and import here',
    done_at: null,
    created_by: 'K',
    created_at: iso(now - H),
  })

  /* meetings ------------------------------------------------------------- */
  const meetings: Meeting[] = []
  const booked = leads.filter((l) => l.stage)
  const slots: [number, number][] = [
    [1, 9],
    [1, 11],
    [-2, 10],
    [-3, 14],
    [-6, 9],
    [-1, 13],
    [2, 10],
    [0, 15],
    [-2, 16],
    [-5, 11],
    [-4, 9],
    [3, 14],
  ]
  booked.forEach((l, i) => {
    const [dd, hh] = slots[i % slots.length]
    const t = at(dd, hh)
    const past = t < now
    const status = l.stage === 'no_show' ? 'no_show' : l.stage === 'booked' ? 'scheduled' : past && l.stage !== 'confirmed' ? 'showed' : 'confirmed'
    meetings.push({
      id: id(),
      lead_id: l.id,
      owner: l.owner || 'K',
      starts_at: iso(t),
      minutes: 30,
      status,
      why_now: l.why_now,
      source: i % 4 === 3 ? 'calendly' : 'dialer',
      created_at: iso(t - 2 * D),
    })
    l.meeting_at = iso(t)
  })

  /* emails + tracking ---------------------------------------------------- */
  const emails: Email[] = []
  const events: EmailEvent[] = []
  const fill = (s: string, l: Lead) => s.replaceAll('{first}', l.first_name).replaceAll('{company}', l.company).replaceAll('{city}', l.city)
  for (const l of leads) {
    if (!l.sequence_id) continue
    const s = sequences.find((x) => x.id === l.sequence_id)!
    for (let step = 0; step < l.sequence_step; step++) {
      const sentAt = now - (12 - s.steps[step].day) * D * 0.8 - r() * 6 * H
      const bounced = l.email_status === 'bounced' && step === 0
      const opens = bounced ? 0 : r() < 0.55 ? 1 + Math.floor(r() * 4) : 0
      const clicks = opens && r() < 0.3 ? 1 : 0
      const replied = l.sequence_state === 'replied' && step === l.sequence_step - 1
      const e: Email = {
        id: id(),
        lead_id: l.id,
        direction: 'out',
        from_addr: 'k.reid@rebootmedia.us',
        to_addr: l.email,
        cc: 's.kazmi@rebootmedia.us',
        subject: fill(s.steps[step].subject, l),
        body: fill(s.steps[step].body, l),
        branded: s.steps[step].branded,
        status: bounced ? 'bounced' : 'sent',
        sequence_id: s.id,
        step,
        campaign_id: null,
        variant: null,
        sent_at: iso(sentAt),
        opens,
        clicks,
        first_open_at: opens ? iso(sentAt + 2 * H) : null,
        last_open_at: opens ? iso(sentAt + (2 + opens * 5) * H) : null,
        replied_at: replied ? iso(sentAt + 9 * H) : null,
        created_by: 'K',
        created_at: iso(sentAt - H),
      }
      emails.push(e)
      events.push({
        id: id(),
        email_id: e.id,
        lead_id: l.id,
        type: bounced ? 'bounce' : 'sent',
        url: '',
        created_at: iso(sentAt),
      })
      for (let o = 0; o < opens; o++)
        events.push({
          id: id(),
          email_id: e.id,
          lead_id: l.id,
          type: 'open',
          url: '',
          created_at: iso(sentAt + (2 + o * 5) * H),
        })
      if (clicks)
        events.push({
          id: id(),
          email_id: e.id,
          lead_id: l.id,
          type: 'click',
          url: 'https://rebootmedia.us/visibility-check',
          created_at: iso(sentAt + 3 * H),
        })
      if (replied) {
        events.push({
          id: id(),
          email_id: e.id,
          lead_id: l.id,
          type: 'reply',
          url: '',
          created_at: iso(sentAt + 9 * H),
        })
        emails.push({
          ...e,
          id: id(),
          direction: 'in',
          from_addr: l.email,
          to_addr: 'k.reid@rebootmedia.us',
          cc: '',
          subject: `Re: ${e.subject}`,
          body: ['Sure, send the check over. What does it cost?', 'Not right now, maybe after hail season.', 'Who is this? How did you get my email?'][emails.length % 3],
          branded: false,
          status: 'received',
          opens: 0,
          clicks: 0,
          first_open_at: null,
          last_open_at: null,
          replied_at: null,
          sent_at: iso(sentAt + 9 * H),
          created_at: iso(sentAt + 9 * H),
        })
      }
    }
  }
  // A few drafts waiting on approval.
  for (const l of leads.filter((x) => x.status === 'new').slice(0, 6)) {
    const s = seqByLane(l.pain)
    emails.push({
      id: id(),
      lead_id: l.id,
      direction: 'out',
      from_addr: 'k.reid@rebootmedia.us',
      to_addr: l.email,
      cc: 's.kazmi@rebootmedia.us',
      subject: fill(s.steps[0].subject, l),
      body: fill(s.steps[0].body, l),
      branded: false,
      status: 'draft',
      sequence_id: s.id,
      step: 0,
      campaign_id: null,
      variant: null,
      sent_at: null,
      opens: 0,
      clicks: 0,
      first_open_at: null,
      last_open_at: null,
      replied_at: null,
      created_by: 'Drafter',
      created_at: iso(now - 40 * 60e3),
    })
  }

  /* lists, campaigns, templates, forms ---------------------------------- */
  const blank = {
    tags_any: [],
    tags_none: [],
    pain: [],
    segment: [],
    status: [],
    has_email: false,
  }
  const lists: SmartList[] = [
    {
      id: id(),
      name: 'Dial list: never ran ads',
      filter: {
        ...blank,
        tags_any: ['call'],
        pain: ['never-ads'],
        segment: ['growing'],
      },
      created_at: iso(now - 9 * D),
    },
    {
      id: id(),
      name: 'Growing email list',
      filter: {
        ...blank,
        tags_any: ['email'],
        tags_none: ['shark', 'commercial'],
        has_email: true,
      },
      created_at: iso(now - 9 * D),
    },
    {
      id: id(),
      name: 'Shark ($5M+)',
      filter: { ...blank, segment: ['shark'] },
      created_at: iso(now - 9 * D),
    },
    {
      id: id(),
      name: 'Commercial',
      filter: { ...blank, segment: ['commercial'] },
      created_at: iso(now - 9 * D),
    },
  ]
  const campaigns: Campaign[] = [
    {
      id: id(),
      name: 'Growing A/B: consistent jobs vs extra million',
      list_id: lists[1].id,
      status: 'sent',
      variants: [
        {
          key: 'A',
          subject: 'Consistent Jobs, Even In Slow Months',
          body: 'Hi {first}, ...',
        },
        {
          key: 'B',
          subject: 'Your Next Extra Million In Roofs',
          body: 'Hi {first}, ...',
        },
      ],
      scheduled_at: iso(now - 6 * D),
      created_at: iso(now - 8 * D),
    },
    {
      id: id(),
      name: 'Shark: per-market ads',
      list_id: lists[2].id,
      status: 'draft',
      variants: [{ key: 'A', subject: 'Owning {city} Search', body: 'Hi {first}, ...' }],
      scheduled_at: null,
      created_at: iso(now - 2 * D),
    },
  ]
  // Campaign sends for the A/B so the results table has numbers.
  leads
    .filter((l) => l.segment === 'growing')
    .slice(0, 40)
    .forEach((l, i) => {
      const v = l.tags.includes('ab-growing-a') ? 'A' : 'B'
      const sentAt = now - 6 * D + i * 60e3
      const opens = r() < (v === 'A' ? 0.48 : 0.39) ? 1 + Math.floor(r() * 2) : 0
      const clicks = opens && r() < (v === 'A' ? 0.25 : 0.12) ? 1 : 0
      const e: Email = {
        id: id(),
        lead_id: l.id,
        direction: 'out',
        from_addr: 'k.reid@rebootmedia.us',
        to_addr: l.email,
        cc: '',
        subject: campaigns[0].variants[v === 'A' ? 0 : 1].subject,
        body: 'Branded blast',
        branded: true,
        status: 'sent',
        sequence_id: null,
        step: null,
        campaign_id: campaigns[0].id,
        variant: v,
        sent_at: iso(sentAt),
        opens,
        clicks,
        first_open_at: opens ? iso(sentAt + 3 * H) : null,
        last_open_at: opens ? iso(sentAt + 5 * H) : null,
        replied_at: null,
        created_by: 'K',
        created_at: iso(sentAt),
      }
      emails.push(e)
      if (opens)
        events.push({
          id: id(),
          email_id: e.id,
          lead_id: l.id,
          type: 'open',
          url: '',
          created_at: iso(sentAt + 3 * H),
        })
      if (clicks)
        events.push({
          id: id(),
          email_id: e.id,
          lead_id: l.id,
          type: 'click',
          url: 'https://rebootmedia.us/grow',
          created_at: iso(sentAt + 4 * H),
        })
    })

  const templates: Template[] = [
    {
      id: id(),
      name: 'Booking confirmation text',
      kind: 'text',
      subject: '',
      body: "Hey {first}, it's {me}. You're locked for {when} to look at {why}. Text me back YES so I hold it.",
      created_at: iso(now - 9 * D),
    },
    {
      id: id(),
      name: 'Cold email 1 (plain)',
      kind: 'plain',
      subject: 'Quick Question About {company}',
      body: sequences[0].steps[0].body,
      created_at: iso(now - 9 * D),
    },
    {
      id: id(),
      name: 'Branded follow-up',
      kind: 'branded',
      subject: 'Your Visibility Check, {first}',
      body: sequences[0].steps[1].body,
      created_at: iso(now - 9 * D),
    },
    {
      id: id(),
      name: 'No-book follow-up',
      kind: 'branded',
      subject: 'Still Want That Look, {first}?',
      body: 'Hi {first},\n\nYou started booking but did not pick a time. Tap here to grab one.\n\nKendall',
      created_at: iso(now - 9 * D),
    },
  ]

  const forms: FormSubmission[] = leads
    .filter((l) => l.source === 'Website form')
    .map((l, i) => ({
      id: id(),
      form: (['visibility-check', 'grow', 'scale', 'commercial'] as const)[i % 4],
      lead_id: l.id,
      page: ['/visibility-check', '/grow', '/scale', '/commercial'][i % 4],
      fields: {
        name: `${l.first_name} ${l.last_name}`,
        company: l.company,
        email: l.email,
        phone: l.phone,
        city: l.city,
        website: l.website,
      },
      created_at: iso(now - (i + 1) * 9 * H),
    }))
  for (const f of forms)
    activities.push({
      id: id(),
      lead_id: f.lead_id!,
      user_name: 'Website',
      outcome: 'form',
      note: `Filled ${f.page}`,
      created_at: f.created_at,
    })

  /* phone numbers + calls -------------------------------------------------- */
  const num = (n: number) => `+1512555${String(100 + n).padStart(4, '0')}`
  const mk = (label: string, kind: PhoneNumber['kind'], source: string, owner: string | null, n: number): PhoneNumber => ({
    id: id(),
    number: num(n),
    label,
    kind,
    source,
    owner,
    forward_to: owner === 'Ali' ? num(91) : num(90),
    record: true,
    active: true,
    created_at: iso(now - 30 * D),
  })
  const numbers: PhoneNumber[] = [
    mk("K's line", 'line', 'Cold calling', 'K', 1),
    mk("Ali's line", 'line', 'Cold calling', 'Ali', 2),
    mk('Website', 'tracking', 'Website', 'K', 3),
    mk('Google Business Profile', 'tracking', 'Google Business Profile', 'K', 4),
    mk('Cold email signature', 'tracking', 'Cold email', 'K', 5),
    mk('Meta Ads', 'tracking', 'Meta Ads', 'Ali', 6),
  ]
  const line = (who: string) => numbers.find((x) => x.kind === 'line' && x.owner === who)!
  const DUR: Partial<Record<Outcome, [number, number, Call['status']]>> = {
    no_answer: [18, 30, 'no_answer'],
    voicemail: [22, 45, 'voicemail'],
    gatekeeper: [35, 110, 'completed'],
    callback: [60, 200, 'completed'],
    booked: [260, 640, 'completed'],
    not_interested: [25, 140, 'completed'],
    bad_number: [4, 10, 'failed'],
    dnc: [20, 60, 'completed'],
  }
  const calls: Call[] = []
  for (const a of activities) {
    const d = DUR[a.outcome]
    if (!d || a.user_name === 'Website') continue
    const l = leads.find((x) => x.id === a.lead_id)!
    const ln = line(a.user_name) || numbers[0]
    const dur = Math.round(d[0] + r() * (d[1] - d[0]))
    calls.push({
      id: id(),
      lead_id: l.id,
      direction: 'out',
      user_name: a.user_name,
      from_number: ln.number,
      to_number: l.phone,
      number_id: ln.id,
      source: 'Cold calling',
      status: d[2],
      started_at: iso(new Date(a.created_at).getTime() - dur * 1000),
      duration_sec: dur,
      recording_url: d[2] === 'completed' ? 'demo' : '',
      outcome: a.outcome,
      via: 'browser',
      provider_id: null,
      ...demoTranscript(a.outcome, d[2], l.first_name, r),
      created_at: a.created_at,
    })
  }
  // Inbound: roofers calling back the tracking numbers, some missed.
  const tracking = numbers.filter((x) => x.kind === 'tracking')
  for (let k = 0; k < 26; k++) {
    const t = now - Math.floor(r() * 13 * D) - 2 * H
    const hr = new Date(t).getHours()
    if (hr < 7 || hr > 19) continue
    const tn = tracking[k % tracking.length]
    const known = r() < 0.7 ? leads[Math.floor(r() * N)] : null
    const missed = r() < 0.3
    const dur = missed ? 0 : Math.round(45 + r() * 400)
    calls.push({
      id: id(),
      lead_id: known?.id ?? null,
      direction: 'in',
      user_name: missed ? '' : tn.owner || 'K',
      from_number: known?.phone ?? `+1737555${String(200 + k).padStart(4, '0')}`,
      to_number: tn.number,
      number_id: tn.id,
      source: tn.source,
      status: missed ? 'missed' : 'completed',
      started_at: iso(t),
      duration_sec: dur,
      recording_url: missed ? '' : 'demo',
      outcome: null,
      via: 'forward',
      provider_id: null,
      ...(missed ? CALL_EXTRAS : demoTranscript('inbound', 'completed', known?.first_name || 'there', r)),
      created_at: iso(t),
    })
  }
  // The latest missed inbound from a known roofer becomes a callback task.
  const lastMissed = calls.filter((c) => c.direction === 'in' && c.status === 'missed' && c.lead_id).sort((a, b) => b.started_at.localeCompare(a.started_at))[0]
  if (lastMissed) {
    tasks.push({
      id: id(),
      lead_id: lastMissed.lead_id,
      kind: 'callback',
      owner: numbers.find((x) => x.id === lastMissed.number_id)?.owner || 'K',
      due_at: lastMissed.started_at,
      reason: `Missed call on ${numbers.find((x) => x.id === lastMissed.number_id)?.label}`,
      done_at: null,
      created_by: 'Phone',
      created_at: lastMissed.started_at,
    })
  }

  /* workflows ---------------------------------------------------------- */
  const workflows: Workflow[] = recipes(id).map((w, i) => ({
    ...w,
    id: id(),
    status: i < 7 ? 'active' : 'draft',
    created_by: 'K',
    created_at: iso(now - (12 - i) * D),
    updated_at: iso(now - 2 * D),
  }))
  // Replay a few contacts through each live workflow so the history has depth.
  const flow_runs: FlowRun[] = []
  for (const w of workflows.filter((x) => x.status === 'active')) {
    const n = 3 + Math.floor(r() * 6)
    for (let k = 0; k < n; k++) {
      const lead = leads[Math.floor(r() * leads.length)]
      const startMs = now - Math.floor(r() * 9 * D) - H
      const base = {
        lead,
        opened: r() < 0.5,
        clicked: r() < 0.2,
        replied: r() < 0.15,
        meeting_upcoming: r() < 0.3,
        booking_link: 'https://calendly.com/hello-rebootmedia/strategycall',
        callers: ['K', 'Ali'],
      }
      let run = startRun(w, lead.id, new Date(startMs), id(), `Triggered: ${triggerLabel(w.trigger.type)}${w.trigger.value ? ` · ${w.trigger.value.replace(/_/g, ' ')}` : ''}`)
      run = advance(run, w, { ...base, now: new Date(startMs) }).run
      for (let g = 0; g < 4 && run.status === 'waiting' && run.wake_at && Date.parse(run.wake_at) < now; g++) {
        const wake = new Date(run.wake_at)
        if (!isDue(run, wake)) break
        run = advance(run, w, { ...base, now: wake }).run
      }
      if (r() < 0.08 && run.status === 'waiting') run = { ...run, status: 'stopped', log: [...run.log, { at: iso(now - H), step: '', text: 'Stopped: replied' }] }
      flow_runs.push(run)
    }
  }

  /* scripts + website visits ----------------------------------------- */
  const scripts = defaultScripts(id, iso(now - 6 * D))
  const site_visits: SiteVisit[] = []
  const PAGES = ['/', '/grow', '/case-studies', '/pricing', '/visibility-check', '/about']
  for (let k = 0; k < 60; k++) {
    const l = leads[Math.floor(r() * N)]
    const t = now - Math.floor(r() * 10 * D)
    site_visits.push({
      id: id(),
      lead_id: l.id,
      visitor: `v-${l.id.slice(0, 8)}`,
      page: PAGES[Math.floor(r() * PAGES.length)],
      referrer: r() < 0.7 ? 'email' : 'google',
      created_at: iso(t),
    })
  }

  return {
    scripts,
    site_visits,
    workflows,
    flow_runs,
    leads,
    activities,
    tasks,
    meetings,
    emails,
    email_events: events,
    sequences,
    campaigns,
    lists,
    templates,
    forms,
    calls,
    numbers,
  }
}
