import type { EmailEventType, MeetingStatus, Outcome, Pain, Segment, Settings, Stage, Status } from './types'

// Soft badge tones. Each is a light wash, a dark text of the same hue and a faint ring.
export const TONE = {
  stone: 'bg-wash text-ink-700 ring-ink-300/40',
  violet: 'bg-accent-50 text-accent-700 ring-accent-400/30',
  sage: 'bg-sage-50 text-sage-700 ring-sage-400/40',
  sand: 'bg-sand-50 text-sand-700 ring-sand-400/40',
  clay: 'bg-clay-50 text-clay-700 ring-clay-400/40',
  mist: 'bg-mist-50 text-mist-700 ring-mist-400/40',
} as const
export type Tone = keyof typeof TONE

export const STATUS_LABEL: Record<Status, string> = {
  new: 'New',
  attempting: 'Attempting',
  callback: 'Callback',
  booked: 'Booked',
  confirmed: 'Confirmed',
  not_interested: 'Not interested',
  bad_number: 'Bad number',
  dnc: 'Do not call',
}

export const STATUS_TONE: Record<Status, Tone> = {
  new: 'mist',
  attempting: 'stone',
  callback: 'sand',
  booked: 'violet',
  confirmed: 'sage',
  not_interested: 'stone',
  bad_number: 'clay',
  dnc: 'clay',
}

export const DIALABLE: Status[] = ['new', 'attempting', 'callback']

export const STAGES: Stage[] = ['booked', 'confirmed', 'showed', 'proposal', 'won', 'no_show', 'lost']
export const STAGE_LABEL: Record<Stage, string> = {
  booked: 'Booked',
  confirmed: 'Confirmed',
  showed: 'Showed',
  no_show: 'No-show',
  proposal: 'Proposal',
  won: 'Signed',
  lost: 'Lost',
}
export const STAGE_TONE: Record<Stage, Tone> = {
  booked: 'violet',
  confirmed: 'mist',
  showed: 'sand',
  no_show: 'clay',
  proposal: 'sand',
  won: 'sage',
  lost: 'stone',
}

export const PAIN_LABEL: Record<Pain, string> = {
  'never-ads': 'Never ran ads',
  'ads-stopped': 'Ads stopped',
  'ads-running': 'Ads running',
  unknown: 'Unknown',
}
export const PAIN_DOT: Record<Pain, string> = {
  'never-ads': 'bg-mist-400',
  'ads-stopped': 'bg-sand-400',
  'ads-running': 'bg-sage-400',
  unknown: 'bg-ink-300',
}

export const SEGMENT_LABEL: Record<Segment, string> = { growing: 'Growing', shark: 'Shark', commercial: 'Commercial' }

export const MEETING_LABEL: Record<MeetingStatus, string> = {
  scheduled: 'Waiting on YES',
  confirmed: 'Confirmed',
  showed: 'Showed',
  no_show: 'No-show',
  canceled: 'Canceled',
}
export const MEETING_TONE: Record<MeetingStatus, Tone> = {
  scheduled: 'sand',
  confirmed: 'sage',
  showed: 'violet',
  no_show: 'clay',
  canceled: 'stone',
}

export const EVENT_LABEL: Record<EmailEventType, string> = {
  sent: 'Sent',
  open: 'Opened',
  click: 'Clicked',
  reply: 'Replied',
  bounce: 'Bounced',
  unsubscribe: 'Unsubscribed',
}

export interface OutcomeDef {
  key: Outcome
  label: string
  hotkey: string
  status: Status | null
  conversation: boolean
}

export const OUTCOMES: OutcomeDef[] = [
  { key: 'no_answer', label: 'No answer', hotkey: '1', status: null, conversation: false },
  { key: 'voicemail', label: 'Voicemail', hotkey: '2', status: null, conversation: false },
  { key: 'gatekeeper', label: 'Gatekeeper', hotkey: '3', status: null, conversation: false },
  { key: 'callback', label: 'Call back', hotkey: '4', status: 'callback', conversation: true },
  { key: 'booked', label: 'Booked', hotkey: '5', status: 'booked', conversation: true },
  { key: 'not_interested', label: 'Not interested', hotkey: '6', status: 'not_interested', conversation: true },
  { key: 'bad_number', label: 'Bad number', hotkey: '7', status: 'bad_number', conversation: false },
  { key: 'dnc', label: 'Do not call', hotkey: '8', status: 'dnc', conversation: false },
]

export const OUTCOME_LABEL: Record<Outcome, string> = {
  no_answer: 'No answer',
  voicemail: 'Voicemail',
  gatekeeper: 'Gatekeeper',
  callback: 'Call back set',
  booked: 'Booked',
  confirmed: 'Confirmed (got YES)',
  not_interested: 'Not interested',
  bad_number: 'Bad number',
  dnc: 'Do not call',
  note: 'Note',
  stage: 'Stage changed',
  email: 'Email',
  form: 'Form filled',
}

export const CALLBACK_REASONS = [
  'Busy, on a roof',
  'Driving',
  'Talk to partner first',
  'Send info first',
  'After storm season',
  'Gatekeeper: owner back later',
]

export const DEFAULT_BOOKING_TEXT =
  "Hey {first}, it's {me}. You're locked for {when} to look at {why}. Text me back YES so I hold it."

export const DEFAULT_SETTINGS: Settings = {
  booking_text: DEFAULT_BOOKING_TEXT,
  callers: ['K', 'Ali'],
  daily_dial_goal: 100,
  daily_email_cap: 50,
  cc: 's.kazmi@rebootmedia.us',
  sender: 'k.reid@rebootmedia.us',
  bounce_pause_pct: 3,
  booking_link: 'https://calendly.com/hello-rebootmedia/strategycall',
}

export const FORM_LABEL = {
  'visibility-check': 'Visibility Check',
  grow: 'Grow',
  scale: 'Scale',
  commercial: 'Commercial',
} as const
