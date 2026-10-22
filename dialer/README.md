# Reboot Dialer

A small calling CRM for K and Ali. Built to fix one leak: callbacks living in free-text notes with nothing to remind you.

## What it does

- **Dial**: one lead at a time from a queue (filter by status, pain tag, owner). Click the number to call from your own phone (`tel:` link).
- **Outcome required after every call**: No answer, Voicemail, Gatekeeper, Call back, Booked, Not interested, Bad number, Do not call. Keys 1–8.
- **Call back** forces a date, time, reason and owner. Due callbacks jump to the top of the queue, show on Today, and fire a beep plus desktop notification while the app is open.
- **Booked** records the meeting time and his "Why now?" words, then opens a text from your phone with the Script M confirmation. It stays *Booked* until he replies YES and you mark it *Confirmed* (booked ≠ confirmed).
- **Today**: your dials, conversations, bookings, callbacks due, the team table, upcoming meetings.
- **Leads**: search and filter every roofer, open one to edit status, pain, owner, notes and see history.
- **Import**: GHL contact export CSV. Keeps rows tagged `call`, skips client / not-a-lead / commercial / shark, dedupes by phone, maps `never-ads` / `ads-stopped` / `ads-running` tags to pain, splits owners between callers.

Numbers dialed in the last 2 hours sit out of the queue so K and Ali don't double-dial.

## Not in this version

Calls go through your own phone, so there is no in-app recording yet. In-browser calling with recording (Telnyx or Twilio) is the next step once a carrier account exists. Callback alerts need the tab open; a phone push (Slack or text) is a later add.

## Run it

```bash
npm install
npm run dev        # http://localhost:5174
```

With no `.env`, it runs in **demo mode**: sample roofers with fictional 555 numbers, data kept in the browser.

## Go live (shared between K and Ali)

1. Supabase project → SQL editor → run `supabase/schema.sql`.
2. Authentication → Providers → Email: turn **off** "Allow new users to sign up". Authentication → Users → **Add user** for K and Ali (email + password). Optional: set user metadata `{"name": "K"}` / `{"name": "Ali"}` so names match the callers list.
3. Cloudflare Pages → new project from this repo, root directory `dialer`, build `npm run build`, output `dist`. Environment variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (the public anon key, never the service role key).
4. Open the Pages URL, sign in, Import → upload the GHL export.
