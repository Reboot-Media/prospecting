import type { Outcome, Pain, Status } from './types'

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

export const STATUS_TONE: Record<Status, string> = {
  new: 'bg-sky-50 text-sky-700 ring-sky-600/15',
  attempting: 'bg-zinc-100 text-zinc-700 ring-zinc-500/15',
  callback: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  booked: 'bg-violet-50 text-violet-700 ring-violet-600/15',
  confirmed: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  not_interested: 'bg-zinc-50 text-zinc-500 ring-zinc-400/20',
  bad_number: 'bg-rose-50 text-rose-700 ring-rose-600/15',
  dnc: 'bg-rose-50 text-rose-700 ring-rose-600/15',
}

// Statuses that belong in a dialing queue. Booked, confirmed and dead leads stay out.
export const DIALABLE: Status[] = ['new', 'attempting', 'callback']

export const PAIN_LABEL: Record<Pain, string> = {
  'never-ads': 'Never ran ads',
  'ads-stopped': 'Ads stopped',
  'ads-running': 'Ads running',
  unknown: 'Unknown',
}

export const PAIN_TONE: Record<Pain, string> = {
  'never-ads': 'bg-sky-500',
  'ads-stopped': 'bg-amber-500',
  'ads-running': 'bg-emerald-500',
  unknown: 'bg-zinc-300',
}

export interface OutcomeDef {
  key: Outcome
  label: string
  hotkey: string
  status: Status | null // status the lead moves to; null = depends on attempts
  conversation: boolean // counted as an owner conversation
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
}

export const CALLBACK_REASONS = [
  'Busy, on a roof',
  'Driving',
  'Talk to partner first',
  'Send info first',
  'After storm season',
  'Gatekeeper: owner back later',
]

// From Script M: the confirmation text, sent from your own cell before the next dial.
export const DEFAULT_BOOKING_TEXT =
  "Hey {first}, it's {me}. You're locked for {when} to look at {why}. Text me back YES so I hold it."

export const DEFAULT_CALLERS = ['K', 'Ali']
