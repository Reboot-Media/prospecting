# Reboot CRM

The CRM K and Ali run Reboot sales on, built to replace GHL. It started as a dialer to fix one leak (callbacks living in free-text notes) and now covers everything Reboot used GHL for, plus email tracking.

## Sections

**Workspace**
- **Home**: your dials against the daily goal, team stats, show rate, dials chart, "needs you now" (callbacks, approvals, replies), roofers who are hot from email, upcoming meetings, team table.
- **Dial**: one roofer at a time from a queue. Outcome required after every call (keys 1–8). Call back forces date, time, reason and owner; due callbacks jump the queue and beep. Booked records the time and his "Why now?" words, creates the meeting, and opens the Script M confirmation text. Booked stays booked until he replies YES.
- **Calls**: every dial and every inbound call with who, which line or tracking number, result, length and recording. Tabs for outbound, inbound, missed and recorded; filter by source, caller and date; call back or add an unknown caller as a contact. Missed calls not yet called back show on Home and in the sidebar badge.
- **Inbox**: one thread per roofer with every email in and out, opens and clicks under each one, and reply in place (replies go to Approvals).
- **Contacts**: every roofer with tabs (to dial, pipeline, clients, dead), smart-list filter, bulk enroll in a sequence or reassign. Each contact has a record page: a dial-to-signed stepper, call log, details, timeline, email tracking, sequence progress, meetings, tags, form fills and quick tasks.
- **Pipeline**: Booked → Confirmed → Showed → Proposal → Signed, plus No-show and Lost. Drag cards; deal value defaults to the first 90 days ($5K + 3 × $3K).
- **Calendar**: week or list view of booked calls. Mark YES, showed or no-show; resend the confirmation text.
- **Tasks**: callbacks, follow-ups and to-dos with overdue / today / upcoming / done.

**Outreach**
- **Workflows**: your own automations, built by drag and drop like GHL's. Pick a trigger (call outcome, booking, no-show, showed, tag, stage, form fill, email open/click/reply/bounce, missed call, or add contacts by hand), then stack steps: email, text, task, notify, tag, change a field, start or stop a sequence, webhook, wait (any time, business hours or the email window), wait for a reply/booking/click, and if/else splits. Ten ready-made ones ship as starting points (speed to lead, booked call YES, no-show recovery, replied, clicked, missed call, three voicemails, gatekeeper, not interested in 90 days, proposal follow-up). Each workflow shows who is in it, where they are, and the log for each person; skip a wait or stop someone by hand.
- **Sequences**: one cold email lane per pain (never ran ads, ads stopped, ads running, plus shark). Per-step open, click, reply and bounce rates. Daily cap shared by first emails and follow-ups. A reply stops the sequence for that roofer.
- **Campaigns**: branded blasts to a list with an A/B split judged by replies and bookings.
- **Approvals**: nothing sends without K's OK. Every draft (sequence, campaign, reply, one-off) waits here.
- **Scripts**: Script M split into opener, gatekeeper, objections, pain lanes and the booking text. The one you pick shows beside every dial with the roofer's name, company and city filled in.
- **Templates** and **Lists** (smart lists from tags, pain, segment, status).

**Insight**: **Reports** with the calling funnel against the Jul–Oct baseline, dials per day, best hours to call, inbound calls by source, talk time per caller, email results by lane, call outcomes and callers.

**Setup**: **Phone numbers** (calling lines for K and Ali, tracking numbers per source with 30-day stats), **Forms** (website fills), **Integrations**, **Import** (GHL CSV, all contacts, dedupe by phone or email), **Settings** (callers, dial goal, booking text, sender, CC, cap, bounce pause).

## How email works

Sending goes through **Resend** (K's pick, 2026-10-22). Free tier: 100 a day, 3,000 a month.

- `supabase/functions/crm-send`: every 5 minutes (pg_cron, `supabase/cron.sql`). Drafts the next due sequence email for each enrolled roofer into Approvals, then sends approved emails inside weekday 8–11 AM Central, under the daily cap, from `k.reid@rebootmedia.us` with Ali CC'd. Pauses new first emails if bounces pass the limit over 3 days.
- `supabase/functions/crm-webhook`: Resend tracking events (opened, clicked, bounced, complained) update each email and the roofer. Replies sent to the reply address are stored in the Inbox, stop the sequence, and get forwarded to K's normal inbox.
- `supabase/functions/crm-form`: the website's form handler posts here at cutover; fills become contacts.

Opens are a soft signal (Apple Mail opens everything). Clicks, replies and bookings are the numbers to trust.

## Roofer profile and buyer intent

- Every contact shows Google rating and reviews, which ads lane they are in, and what their website runs: Google Tag Manager, GA4, Google Ads tag, Meta pixel, call tracking, chat, reviews widget, instant estimator, CRM. Missing tags turn into talking points.
- `supabase/functions/crm-enrich` reads the website (and the GTM container) for 15 unchecked roofers every 15 minutes, or on "Check website". With a `GOOGLE_PLACES_KEY` secret it also fills rating and review count.
- Buyer intent (0 to 100) adds up the last 14 days: rebootmedia.us visits (pricing, case studies, Visibility Check count extra), replies, clicks, opens, inbound calls, form fills, callbacks asked for and booked calls.
- `supabase/functions/crm-track` takes page views from rebootmedia.us. `crm-send` adds `?rb=<contact id>` to rebootmedia.us links, and the site tag (Integrations → Setup details; one GTM Custom HTML tag) ties the visit to the roofer. Putting the tag on the site waits for K's go.

## Meta lead ads

`supabase/functions/crm-meta` is the webhook for Facebook and Instagram lead forms. Each lead becomes a contact (or matches one by email or phone), gets a "Meta lead ad" form fill and starts the "Meta lead: call in 5 minutes" workflow. Needs `META_VERIFY_TOKEN`, `META_APP_SECRET` and `META_PAGE_TOKEN` function secrets; refuses anything Meta did not sign.

## How workflows run

- Database triggers write every change a workflow can start on (calls, bookings, tags, stages, form fills, email events, missed calls) into `crm_flow_events`.
- `supabase/functions/crm-flow` runs every minute (pg_cron). It starts matching workflows, resumes people waiting for an event, stops runs on a reply when the workflow says so, and moves everyone whose wait is over. The step logic lives in `src/lib/flow.ts`, shared with the demo.
- Workflow emails land in Approvals unless the step is set to send on its own; either way `crm-send` sends them through Resend inside the weekday window and under the daily cap, with Ali CC'd. Text steps become a task until a carrier is on.

## How phone tracking works

- Every call from the CRM (Dial screen, contact page, Calls page) creates a call record the moment you press Call, and the outcome you log is attached to it. Settings → Phone picks how calls go out: **My phone** (opens your cell's dialer; the length is what you time in the call bar) or **Browser** (calls through the carrier from the laptop, recorded).
- `supabase/functions/crm-voice` (Twilio): browser calling tokens for K and Ali, recorded outbound calls with the real length, inbound calls to any tracking number logged with their source and rung through to the owner's browser and cell, missed calls turned into voicemail plus a callback task, and recordings streamed only to signed-in teammates.
- Turn it on: buy numbers in Twilio, add them under Phone numbers, point each number's voice webhook at `.../functions/v1/crm-voice/inbound`, create a TwiML app pointing at `.../crm-voice/outbound`, and add `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_API_KEY_SID`, `TWILIO_API_KEY_SECRET`, `TWILIO_TWIML_APP_SID` as Supabase function secrets. Until then the function answers 401/503 and everything else works with "My phone".

Transcripts: recorded calls of 20 seconds or more (Settings) go to Gemini (`GEMINI_API_KEY` secret, `gemini-2.5-flash`, about $0.002 a minute). Each call gets a transcript with speakers, a two-line summary, pain, "why now", objections and the next step, shown under Call notes. Inbound callers hear "This call may be recorded" first (Settings).

## Logging in

K and Ali open the CRM, choose "First time? Set your password", and use their rebootmedia.us email. Only emails on the team list can create a login. "Forgot password" emails a reset link.

## Run it

```bash
npm install
npm run dev        # http://localhost:5174
```

With no `.env`, it runs in **demo mode**: fictional roofers (555 numbers, example.com emails), data kept in the browser. Open two windows to see K and Ali stay in sync.

## Live setup (done 2026-10-22 unless noted)

- **Database**: Reboot's Supabase project `ops` (fqlgfmuiedrdowxnvcjv). `supabase/schema.sql` applied. Only emails in `crm_team` (K, Ali) can read or write anything, even if someone else signs up.
- **Functions**: `crm-send`, `crm-webhook`, `crm-form`, `crm-voice`, `crm-flow`, `crm-enrich`, `crm-track`, `crm-meta` deployed; Script M loaded; website checker on pg_cron. Workflow tables and triggers applied. Phone tables `crm_calls` and `crm_numbers` applied. `CRON_SECRET` and `FORM_SECRET` live in the database vault (`crm_cron_secret`, `crm_form_secret`); `supabase/cron.sql` applied.
- **Front end**: `.env.production` holds the public URL and publishable key. Build `npm run build`, output `dist`, host on Cloudflare Pages (project `reboot-crm`). Address: `crm.rebootmedia.us` (custom domain on the Pages project; only that subdomain, root email records untouched).
- **Waiting on K**: phone carrier pick and Twilio secrets (see phone tracking above); logins (K and Ali set their own on the login page); Resend account, domain and the `RESEND_API_KEY` / `RESEND_WEBHOOK_SECRET` function secrets; webhook → `…/functions/v1/crm-webhook` (opened, clicked, bounced, complained, received); optional `REPLY_TO` / `FORWARD_TO`.
- **Later**: point the website's `/api/lead` at `crm-form`, import the GHL export, run both side by side for a week, then cancel GHL.
