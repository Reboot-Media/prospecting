// Calling status: where a roofer sits in the dial queue.
export type Status = 'new' | 'attempting' | 'callback' | 'booked' | 'confirmed' | 'not_interested' | 'bad_number' | 'dnc'

// Deal stage: what happens after a call gets booked.
export type Stage = 'booked' | 'confirmed' | 'showed' | 'no_show' | 'proposal' | 'won' | 'lost'

export type Pain = 'never-ads' | 'ads-stopped' | 'ads-running' | 'unknown'
export type Segment = 'growing' | 'shark' | 'commercial'

export type Outcome =
  | 'no_answer'
  | 'voicemail'
  | 'gatekeeper'
  | 'callback'
  | 'booked'
  | 'confirmed'
  | 'not_interested'
  | 'bad_number'
  | 'dnc'
  | 'note'
  | 'stage'
  | 'email'
  | 'form'

export interface Lead {
  id: string
  ghl_id: string | null
  first_name: string
  last_name: string
  company: string
  phone: string
  email: string
  city: string
  state: string
  website: string
  pain: Pain
  segment: Segment
  status: Status
  stage: Stage | null
  deal_value: number
  owner: string | null
  tags: string[]
  notes: string
  source: string
  attempts: number
  last_outcome: Outcome | null
  last_called_at: string | null
  meeting_at: string | null
  why_now: string
  sequence_id: string | null
  sequence_step: number
  sequence_state: 'active' | 'replied' | 'finished' | 'paused' | 'bounced' | null
  email_status: 'ok' | 'bounced' | 'unsubscribed'
  created_at: string
  updated_at: string
}

export interface Activity {
  id: string
  lead_id: string
  user_name: string
  outcome: Outcome
  note: string
  created_at: string
}

export type TaskKind = 'callback' | 'follow_up' | 'todo'

export interface Task {
  id: string
  lead_id: string | null
  kind: TaskKind
  owner: string
  due_at: string
  reason: string
  done_at: string | null
  created_by: string
  created_at: string
}

export type MeetingStatus = 'scheduled' | 'confirmed' | 'showed' | 'no_show' | 'canceled'

export interface Meeting {
  id: string
  lead_id: string
  owner: string
  starts_at: string
  minutes: number
  status: MeetingStatus
  why_now: string
  source: 'dialer' | 'calendly' | 'manual'
  created_at: string
}

export type EmailStatus = 'draft' | 'approved' | 'sent' | 'bounced' | 'failed' | 'received'

export interface Email {
  id: string
  lead_id: string
  direction: 'out' | 'in'
  from_addr: string
  to_addr: string
  cc: string
  subject: string
  body: string
  branded: boolean
  status: EmailStatus
  sequence_id: string | null
  step: number | null
  campaign_id: string | null
  variant: string | null
  sent_at: string | null
  opens: number
  clicks: number
  first_open_at: string | null
  last_open_at: string | null
  replied_at: string | null
  created_by: string
  created_at: string
}

export type EmailEventType = 'sent' | 'open' | 'click' | 'reply' | 'bounce' | 'unsubscribe'

export interface EmailEvent {
  id: string
  email_id: string
  lead_id: string
  type: EmailEventType
  url: string
  created_at: string
}

export interface SequenceStep {
  day: number
  subject: string
  body: string
  branded: boolean
}

export interface Sequence {
  id: string
  name: string
  lane: Pain | 'shark' | 'commercial'
  status: 'active' | 'paused'
  steps: SequenceStep[]
  created_at: string
}

export interface Campaign {
  id: string
  name: string
  list_id: string | null
  status: 'draft' | 'scheduled' | 'sent'
  variants: { key: string; subject: string; body: string }[]
  scheduled_at: string | null
  created_at: string
}

export interface ListFilter {
  tags_any: string[]
  tags_none: string[]
  pain: Pain[]
  segment: Segment[]
  status: Status[]
  has_email: boolean
}

export interface SmartList {
  id: string
  name: string
  filter: ListFilter
  created_at: string
}

export interface Template {
  id: string
  name: string
  kind: 'plain' | 'branded' | 'text'
  subject: string
  body: string
  created_at: string
}

export interface FormSubmission {
  id: string
  form: 'visibility-check' | 'grow' | 'scale' | 'commercial'
  lead_id: string | null
  fields: Record<string, string>
  page: string
  created_at: string
}

export interface Settings {
  booking_text: string
  callers: string[]
  daily_dial_goal: number
  daily_email_cap: number
  cc: string
  sender: string
  bounce_pause_pct: number
  booking_link: string
}

export type NewLead = Partial<Lead> & { company: string; phone: string }
