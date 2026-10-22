# Reboot CRM

The CRM K and Ali run Reboot sales on, built to replace GHL. It started as a dialer to fix one leak (callbacks living in free-text notes) and now covers everything Reboot used GHL for, plus email tracking.

## Sections

**Workspace**
- **Home**: your dials against the daily goal, team stats, show rate, dials chart, "needs you now" (callbacks, approvals, replies), roofers who are hot from email, upcoming meetings, team table.
- **Dial**: one roofer at a time from a queue. Outcome required after every call (keys 1–8). Call back forces date, time, reason and owner; due callbacks jump the queue and beep. Booked records the time and his "Why now?" words, creates the meeting, and opens the Script M confirmation text. Booked stays booked until he replies YES.
- **Inbox**: one thread per roofer with every email in and out, opens and clicks under each one, and reply in place (replies go to Approvals).
- **Contacts**: every roofer with tabs (to dial, pipeline, clients, dead), smart-list filter, bulk enroll in a sequence or reassign. Each contact has a record page: a dial-to-signed stepper, call log, details, timeline, email tracking, sequence progress, meetings, tags, form fills and quick tasks.
- **Pipeline**: Booked → Confirmed → Showed → Proposal → Signed, plus No-show and Lost. Drag cards; deal value defaults to the first 90 days ($5K + 3 × $3K).
- **Calendar**: week or list view of booked calls. Mark YES, showed or no-show; resend the confirmation text.
- **Tasks**: callbacks, follow-ups and to-dos with overdue / today / upcoming / done.

**Outreach**
- **Sequences**: one cold email lane per pain (never ran ads, ads stopped, ads running, plus shark). Per-step open, click, reply and bounce rates. Daily cap shared by first emails and follow-ups. A reply stops the sequence for that roofer.
- **Campaigns**: branded blasts to a list with an A/B split judged by replies and bookings.
- **Approvals**: nothing sends without K's OK. Every draft (sequence, campaign, reply, one-off) waits here.
- **Templates** and **Lists** (smart lists from tags, pain, segment, status).

**Insight**: **Reports** with the calling funnel against the Jul–Oct baseline, dials per day, email results by lane, call outcomes and callers.

**Setup**: **Forms** (website fills), **Integrations**, **Import** (GHL CSV, all contacts, dedupe by phone or email), **Settings** (callers, dial goal, booking text, sender, CC, cap, bounce pause).

## How email works

Sending goes through **Resend** (K's pick, 2026-10-22). Free tier: 100 a day, 3,000 a month.

- `supabase/functions/crm-send`: every 5 minutes (pg_cron, `supabase/cron.sql`). Drafts the next due sequence email for each enrolled roofer into Approvals, then sends approved emails inside weekday 8–11 AM Central, under the daily cap, from `k.reid@rebootmedia.us` with Ali CC'd. Pauses new first emails if bounces pass the limit over 3 days.
- `supabase/functions/crm-webhook`: Resend tracking events (opened, clicked, bounced, complained) update each email and the roofer. Replies sent to the reply address are stored in the Inbox, stop the sequence, and get forwarded to K's normal inbox.
- `supabase/functions/crm-form`: the website's form handler posts here at cutover; fills become contacts.

Opens are a soft signal (Apple Mail opens everything). Clicks, replies and bookings are the numbers to trust.

## Run it

```bash
npm install
npm run dev        # http://localhost:5174
```

With no `.env`, it runs in **demo mode**: fictional roofers (555 numbers, example.com emails), data kept in the browser. Open two windows to see K and Ali stay in sync.

## Go live

1. Supabase → run `supabase/schema.sql`. Turn **off** public sign-ups; add users for K and Ali with metadata `{"name": "K"}` / `{"name": "Ali"}`.
2. Resend: verify `rebootmedia.us` (DKIM + a `send.` subdomain for bounces; the root MX is not touched) and turn on open and click tracking. Add a receiving subdomain for replies (e.g. `reply.rebootmedia.us`). Webhook → `…/functions/v1/crm-webhook` for opened, clicked, bounced, complained, received.
3. Deploy the three functions (`crm-webhook` and `crm-form` with JWT check off; they check their own secrets). Function secrets: `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`, `CRON_SECRET`, `FORM_SECRET`, `REPLY_TO`, `FORWARD_TO`. Then run `supabase/cron.sql`.
4. Cloudflare Pages: root `dialer`, build `npm run build`, output `dist`, env `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (public key only).
5. Import the GHL export, run both side by side for a week, then cancel GHL.
