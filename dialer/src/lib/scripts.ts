import type { Lead, Script, ScriptKind } from './types'

// Script M (K, 2026-10-16), split into the pieces you reach for mid-call.
// {first} {company} {city} {me} fill in from the roofer on screen.

export const SCRIPT_KIND_LABEL: Record<ScriptKind, string> = {
  opener: 'Opener',
  gatekeeper: 'Gatekeeper',
  objections: 'Objections',
  pain: 'Pain lanes',
  confirm: 'Booking + YES text',
  voicemail: 'Voicemail',
  other: 'Other',
}

const M_CALL = `BEFORE YOU DIAL
Owner only, by name. Have the roofer search results for {city} open. Familiar tone, a little unsure who you need, certain about the problem. Ask for the meeting once. End every answer with a question.

YOU: "{first}? Hey {first}, it's... it's {me}. I'm looking at the roofer search results for {city} right now, and I was wondering if you could possibly help me out for a moment."

HIM: "Sure. Who is this?"

YOU: "Well, I'm not even sure it makes sense for us to talk yet. I called to see who'd be responsible at {company} for any hidden gaps in how homeowners find you when they search for a roofer in {city}, that could be sending those jobs to someone else. Who should I be talking to about that?"

HIM: "That's me. What's this about?"

YOU: "I work with roofers on how homeowners find them. But before I get into any of that, how are most of your jobs coming in right now?"
(Let him finish. Don't fill the silence.)

YOU: "So when referrals slow down, where does the next job come from?"

YOU: "And when storm season slows down, what happens to the phone?"

YOU: "Is that something you'd want fixed before spring, or is it not that big a deal right now?"

YOU: "Why now?"
(Write his words down word for word. They go in the YES text.)

YOU: "Makes sense. Would you be opposed to taking 30 minutes tomorrow morning so I can show you exactly where it's leaking? 8 or 9?"

YOU: "Anyone else need to be there to decide?"

YOU: "So that's tomorrow at 9, your time. Is there anything that would stop you from being there?"

YOU: "I'm going to text you from my cell right now. Text me back YES so I know to hold 9 for you. Is this the best number?"

IF HE WON'T NAME A PAIN
"Sounds like you've got it handled. Would it be crazy if I checked back in with you after storm season?" Log it as a callback.

IF HE SAYS "JUST TELL ME WHAT YOU DO"
"I build and run the system that puts you in front of homeowners searching for a roofer, and I show you which ones turn into signed jobs. But I don't know yet if any of that fits you. How are most of your jobs coming in right now?"`

const M_GATE = `YOU: "Hey, it's... it's {me}. I'm looking at the roofer search results for {city} right now, and I was wondering if you could possibly help me out for a moment."

THEM: "Sure, what's this about?"

YOU: "I'm not even sure who I should be talking to. I'm trying to reach whoever's responsible for any hidden gaps in how homeowners find the company when they search for a roofer in {city}, that could be sending those jobs to someone else. Who should I be talking to about that?"

THEM: "That'd be {first}, the owner."

YOU: "Should I have you transfer me to his voicemail, so he can call me back if he'd like?"

IF {first} PICKS UP
"{first}, hey, it's {me}. [Her name] transferred me over. She said you'd be the one responsible for how homeowners find the company online. Are you the person I should be talking to about that?" Then ask how most of his jobs are coming in.

NOT IN
"What time's he usually in?" Call him then. Never let staff book it. Message only if you must: "Tell him {me} called about keeping his crews booked."`

const M_OBJ = `"NOT INTERESTED."
"That's fine. Just so I know, is that because you've got that side handled, or because you're booked out right now?" → "How are most of your jobs coming in right now?"

"WE ALREADY HAVE SOMEONE."
"Oh, good. How's that going for you?" → "Would you be opposed to a second set of eyes on it, tomorrow at 8?"

"WE'RE BOOKED OUT."
"Good. What's the plan when the backlog clears?" → "Would it be crazy to have it ready before that happens?"

"I'VE BEEN BURNED."
"What happened?" Let him tell it. "What would have to be different this time?" → "If I show you exactly what we'd do before you spend a dollar, would you be opposed to that?"

"WHAT MAKES YOU DIFFERENT?"
"I don't sell leads. I build and run every account myself. What have you tried before?" → "Would you be against seeing it for yourself, tomorrow at 9?"

"HOW MUCH?"
"Depends what I find. That's what the 30 minutes is for." → "If the numbers make sense, price won't be the problem, right?"

"SEND ME SOMETHING."
"I could, but every company's different, so I wouldn't know what to send yet. What would you want to see in it?" → "Would you be opposed to 30 minutes so I can build it for yours? Tomorrow at 8, or 9:30?"`

const M_PAIN = `1. NOT FOUND (never ran ads) — live now
Use the main opener word for word.
Text reason: "...to look at where the {city} roofing searches are going instead of to you."

2. RAN ADS, THEN STOPPED — later
Tagline: "I'm looking at the ads {company} was running a while back, and I was wondering if you could possibly help me out for a moment."
Gap: "...responsible at {company} for looking at any hidden gaps in why those ads stopped working, that could be costing you jobs that are going to other roofers right now. Who should I be talking to about that?"
Pain: "What happened with those?"  Consequence: "And since you turned them off, what's filled that gap?"
Text reason: "...to look at what went wrong with your last ads and how to fix it."

3. RUNNING ADS NOW — later
Tagline: "I'm looking at the ads {company} is running right now, and I was wondering if you could possibly help me out for a moment."
Gap: "...responsible at {company} for looking at any hidden gaps in which of those ads actually turn into signed jobs, that could have you paying for clicks that never become roofs. Who should I be talking to about that?"
Pain: "Right now, can you tell which ads turned into signed jobs last month?"  Consequence: "So how do you know where to spend more and where to cut?"
Text reason: "...to look at which of your ads are turning into signed jobs."`

const M_CONFIRM = `THE TEXT (send before you dial the next number)
"Hey {first}, it's {me}. You're locked for tomorrow at 9 to look at [his words from Why now?]. Text me back YES so I hold it."

No YES by end of day: call him. Still nothing: it's a callback, not a booking. Same time in every message.

BOOKING RULES
Mornings, next business day. Two days out only if he picks it. No morning in the next 2 business days: callback.
"Maybe" or "if I have time" is a callback. Never offer the out.
15-minute round only: "Would you be against 15 minutes tomorrow at 8? If it fits and you want to keep going, we keep going."`

export function defaultScripts(id: () => string, at: string): Script[] {
  const mk = (sort: number, name: string, kind: ScriptKind, body: string): Script => ({ id: id(), name, kind, body, sort, created_at: at, updated_at: at })
  return [
    mk(1, 'Script M: the call', 'opener', M_CALL),
    mk(2, 'Gatekeeper', 'gatekeeper', M_GATE),
    mk(3, 'Objections', 'objections', M_OBJ),
    mk(4, 'Pain lanes', 'pain', M_PAIN),
    mk(5, 'Booking + YES text', 'confirm', M_CONFIRM),
  ]
}

export function fillScript(body: string, l: Pick<Lead, 'first_name' | 'company' | 'city'> | undefined, me: string) {
  const name = me === 'K' ? 'Kendall' : me
  return body
    .replaceAll('{first}', l?.first_name || 'there')
    .replaceAll('{company}', l?.company || 'the company')
    .replaceAll('{city}', l?.city || 'your city')
    .replaceAll('{me}', name)
}
