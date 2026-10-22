import type { Step, Workflow } from './flow'

// Ready-made workflows for how Reboot sells: speed to lead, show rate,
// no-show recovery, cold email replies and callbacks. Each one opens in the
// builder as a draft, so nothing runs until you switch it on.

type Draft = Omit<Workflow, 'id' | 'created_at' | 'updated_at' | 'created_by' | 'status'>

const recipe = (r: Draft) => r
type NoId = Step extends infer T ? (T extends Step ? Omit<T, 'id'> : never) : never

export function recipes(id: () => string): Draft[] {
  const s = (step: NoId): Step => ({ id: id(), ...step }) as Step
  return [
    recipe({
      name: 'Speed to lead: Visibility Check',
      description: 'A roofer asks for a Visibility Check. Ping the owner, call inside 5 minutes, and email the booking link.',
      trigger: { type: 'form_submitted', value: 'visibility-check', conditions: [] },
      reentry: false,
      stop_on_reply: false,
      steps: [
        s({ type: 'tag', mode: 'add', tag: 'visibility-check' }),
        s({ type: 'notify', to: '', text: '{company} just asked for a Visibility Check. Call now.' }),
        s({ type: 'task', kind: 'callback', owner: '', due_minutes: 5, reason: 'Visibility Check request: call inside 5 minutes' }),
        s({
          type: 'email',
          subject: 'Your Visibility Check, {first}',
          body: 'Hi {first},\n\nGot your request. I am pulling how {company} shows up against the other roofers in {city} right now.\n\nGrab 15 minutes and I will walk you through it: {booking_link}\n\nKendall',
          branded: true,
          auto_send: false,
        }),
        s({
          type: 'wait_for',
          event: 'meeting_booked',
          days: 1,
          yes: [],
          no: [s({ type: 'task', kind: 'callback', owner: '', due_minutes: 0, reason: 'Visibility Check not booked after a day: call again' })],
        }),
      ],
    }),
    recipe({
      name: 'Booked call: get the YES',
      description: 'Every booked call gets the confirmation text, then a callback if no YES comes back the same day.',
      trigger: { type: 'meeting_booked', value: '', conditions: [] },
      reentry: true,
      stop_on_reply: false,
      steps: [
        s({ type: 'text', body: "Hi {first}, it's Kendall with Reboot. Locking in our call. Reply YES and you're set." }),
        s({ type: 'wait', amount: 3, unit: 'hours', window: 'business' }),
        s({
          type: 'branch',
          match: 'any',
          conditions: [
            { field: 'status', op: 'is', value: 'confirmed' },
            { field: 'stage', op: 'is', value: 'confirmed' },
          ],
          yes: [s({ type: 'end' })],
          no: [s({ type: 'task', kind: 'callback', owner: '', due_minutes: 0, reason: 'No YES on the booked call yet: call to confirm' })],
        }),
      ],
    }),
    recipe({
      name: 'No-show recovery',
      description: 'Text and call right away, then a branded reschedule email if they still have nothing booked.',
      trigger: { type: 'meeting_status', value: 'no_show', conditions: [] },
      reentry: true,
      stop_on_reply: true,
      steps: [
        s({ type: 'text', body: 'Missed you today, {first}. Want another time? {booking_link}' }),
        s({ type: 'task', kind: 'callback', owner: '', due_minutes: 30, reason: 'No-show: call to rebook' }),
        s({ type: 'wait', amount: 1, unit: 'days', window: 'business' }),
        s({
          type: 'branch',
          match: 'all',
          conditions: [{ field: 'meeting_upcoming', op: 'is', value: 'yes' }],
          yes: [s({ type: 'end' })],
          no: [
            s({
              type: 'email',
              subject: 'Another time this week, {first}?',
              body: 'Hi {first},\n\nWe missed each other. Still worth 15 minutes to see where {company} could pick up more signed jobs.\n\nPick a time here: {booking_link}\n\nKendall',
              branded: true,
              auto_send: false,
            }),
            s({ type: 'wait', amount: 2, unit: 'days', window: 'business' }),
            s({
              type: 'branch',
              match: 'all',
              conditions: [{ field: 'meeting_upcoming', op: 'is', value: 'no' }],
              yes: [s({ type: 'tag', mode: 'add', tag: 'no-show-cold' })],
              no: [],
            }),
          ],
        }),
      ],
    }),
    recipe({
      name: 'Replied to cold email: call now',
      description: 'A reply stops the sequence, tags them and puts a 15-minute callback on the owner.',
      trigger: { type: 'email_replied', value: '', conditions: [] },
      reentry: true,
      stop_on_reply: false,
      steps: [
        s({ type: 'tag', mode: 'add', tag: 'replied' }),
        s({ type: 'sequence', mode: 'stop', sequence_id: '' }),
        s({ type: 'notify', to: '', text: '{company} replied. Call while it is warm.' }),
        s({ type: 'task', kind: 'callback', owner: '', due_minutes: 15, reason: 'Replied to email: call now' }),
      ],
    }),
    recipe({
      name: 'Clicked a link: hot lead',
      description: 'Someone clicked your email and has not booked. Call within 30 minutes.',
      trigger: { type: 'email_clicked', value: '', conditions: [{ field: 'meeting_upcoming', op: 'is', value: 'no' }] },
      reentry: false,
      stop_on_reply: false,
      steps: [
        s({ type: 'tag', mode: 'add', tag: 'clicked' }),
        s({ type: 'task', kind: 'callback', owner: '', due_minutes: 30, reason: 'Clicked your email link: call now' }),
      ],
    }),
    recipe({
      name: 'Missed call: text back',
      description: 'A known roofer called and nobody picked up. Text right away and call back.',
      trigger: { type: 'missed_call', value: '', conditions: [] },
      reentry: true,
      stop_on_reply: false,
      steps: [
        s({ type: 'text', body: 'Sorry I missed you, {first}. Calling you right back.' }),
        s({ type: 'task', kind: 'callback', owner: '', due_minutes: 0, reason: 'Missed their call: call back now' }),
      ],
    }),
    recipe({
      name: 'Three voicemails: start email lane',
      description: 'After the third voicemail, start the cold email lane for their pain and keep dialing.',
      trigger: {
        type: 'call_outcome',
        value: 'voicemail',
        conditions: [
          { field: 'attempts', op: 'gte', value: '3' },
          { field: 'has_email', op: 'is', value: 'yes' },
        ],
      },
      reentry: false,
      stop_on_reply: false,
      steps: [s({ type: 'tag', mode: 'add', tag: 'voicemail-3x' }), s({ type: 'sequence', mode: 'enroll', sequence_id: '' })],
    }),
    recipe({
      name: 'Gatekeeper: try the owner again',
      description: 'Got the front desk. Try again in two working days at a different time.',
      trigger: { type: 'call_outcome', value: 'gatekeeper', conditions: [] },
      reentry: true,
      stop_on_reply: false,
      steps: [
        s({ type: 'wait', amount: 2, unit: 'days', window: 'business' }),
        s({ type: 'task', kind: 'callback', owner: '', due_minutes: 0, reason: 'Gatekeeper last time: try the owner at a different hour' }),
      ],
    }),
    recipe({
      name: 'Not interested: back in 90 days',
      description: 'Park them, then put them back in the queue in 90 days.',
      trigger: { type: 'call_outcome', value: 'not_interested', conditions: [] },
      reentry: true,
      stop_on_reply: false,
      steps: [
        s({ type: 'tag', mode: 'add', tag: 'not-now' }),
        s({ type: 'wait', amount: 90, unit: 'days', window: 'business' }),
        s({ type: 'field', field: 'status', value: 'new' }),
        s({ type: 'task', kind: 'callback', owner: '', due_minutes: 0, reason: 'Said not interested 90 days ago: try again' }),
      ],
    }),
    recipe({
      name: 'Showed: proposal follow-up',
      description: 'They showed. Move to proposal, send a recap, chase it if there is no reply in three days.',
      trigger: { type: 'meeting_status', value: 'showed', conditions: [] },
      reentry: false,
      stop_on_reply: false,
      steps: [
        s({ type: 'field', field: 'stage', value: 'proposal' }),
        s({ type: 'wait', amount: 2, unit: 'hours', window: 'business' }),
        s({
          type: 'email',
          subject: 'Next steps for {company}',
          body: 'Hi {first},\n\nGood talking today. Here is the plan we went over and what the first 90 days look like.\n\nAny questions, just reply here.\n\nKendall',
          branded: true,
          auto_send: false,
        }),
        s({
          type: 'wait_for',
          event: 'email_replied',
          days: 3,
          yes: [s({ type: 'notify', to: '', text: '{company} replied to the proposal' })],
          no: [s({ type: 'task', kind: 'follow_up', owner: '', due_minutes: 0, reason: 'No reply to the proposal in 3 days: call' })],
        }),
      ],
    }),
  ]
}
