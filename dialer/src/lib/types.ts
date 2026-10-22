export type Status =
  | 'new'
  | 'attempting'
  | 'callback'
  | 'booked'
  | 'confirmed'
  | 'not_interested'
  | 'bad_number'
  | 'dnc'

export type Pain = 'never-ads' | 'ads-stopped' | 'ads-running' | 'unknown'

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
  status: Status
  owner: string | null
  tags: string[]
  notes: string
  attempts: number
  last_outcome: Outcome | null
  last_called_at: string | null
  meeting_at: string | null
  why_now: string
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

export interface Callback {
  id: string
  lead_id: string
  owner: string
  due_at: string
  reason: string
  done_at: string | null
  created_by: string
  created_at: string
}

export interface Settings {
  booking_text: string
  callers: string[]
}

export type NewLead = Partial<Lead> & { company: string; phone: string }
