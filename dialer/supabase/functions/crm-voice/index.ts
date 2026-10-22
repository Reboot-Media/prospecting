// crm-voice: phone calls through Twilio.
//
//   POST /token          browser calling token for K or Ali (Supabase login required)
//   POST /outbound       TwiML app voice URL: browser -> roofer, recorded
//   POST /dial-done      end of an outbound call: real length and result
//   POST /inbound        voice URL on every Twilio number: rings the owner's cell
//                        and browser, logs the call with its tracking source
//   POST /inbound-done   end of an inbound call: missed -> voicemail + callback task
//   POST /recording      recording finished
//   GET  /recording      streams a recording to a signed-in teammate
//
// Twilio requests are checked against TWILIO_AUTH_TOKEN (X-Twilio-Signature).
// Secrets: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_API_KEY_SID,
// TWILIO_API_KEY_SECRET, TWILIO_TWIML_APP_SID.
import { db, json, settings } from '../_shared/common.ts'

const env = (k: string) => Deno.env.get(k) || ''
const PUBLIC = `${env('SUPABASE_URL')}/functions/v1/crm-voice`

const xml = (body: string) => new Response(`<?xml version="1.0" encoding="UTF-8"?><Response>${body}</Response>`, { headers: { 'content-type': 'text/xml' } })
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const b64url = (b: Uint8Array | string) =>
  btoa(typeof b === 'string' ? b : String.fromCharCode(...b))
    .replace(/=+$/, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
const digits = (p: string) => (p || '').replace(/\D/g, '').replace(/^1(\d{10})$/, '$1')

async function hmac(alg: 'SHA-1' | 'SHA-256', key: string, data: string) {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(key), { name: 'HMAC', hash: alg }, false, ['sign'])
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(data)))
}

// Twilio signs the full public URL plus the POST params sorted by name.
async function fromTwilio(req: Request, path: string, params: Record<string, string>) {
  const sig = req.headers.get('x-twilio-signature') || ''
  const token = env('TWILIO_AUTH_TOKEN')
  if (!sig || !token) return false
  const url = `${PUBLIC}${path}${new URL(req.url).search}`
  const data =
    url +
    Object.keys(params)
      .sort()
      .map((k) => k + params[k])
      .join('')
  const mac = await hmac('SHA-1', token, data)
  return btoa(String.fromCharCode(...mac)) === sig
}

// Signed-in teammate from a Supabase access token.
async function teammate(token: string) {
  if (!token) return null
  const sb = db()
  const { data } = await sb.auth.getUser(token)
  const email = data.user?.email?.toLowerCase()
  if (!email) return null
  const { data: t } = await sb.from('crm_team').select('name').eq('email', email).maybeSingle()
  return t ? (t.name as string) : null
}

async function accessToken(identity: string) {
  const now = Math.floor(Date.now() / 1000)
  const header = { typ: 'JWT', alg: 'HS256', cty: 'twilio-fpa;v=1' }
  const payload = {
    jti: `${env('TWILIO_API_KEY_SID')}-${now}`,
    iss: env('TWILIO_API_KEY_SID'),
    sub: env('TWILIO_ACCOUNT_SID'),
    iat: now,
    exp: now + 3600,
    grants: {
      identity,
      voice: {
        incoming: { allow: true },
        outgoing: { application_sid: env('TWILIO_TWIML_APP_SID') },
      },
    },
  }
  const body = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`
  return `${body}.${b64url(await hmac('SHA-256', env('TWILIO_API_KEY_SECRET'), body))}`
}

const DIAL_STATUS: Record<string, string> = {
  completed: 'completed',
  answered: 'completed',
  'no-answer': 'no_answer',
  busy: 'busy',
  failed: 'failed',
  canceled: 'no_answer',
}

Deno.serve(async (req) => {
  const url = new URL(req.url)
  const path = url.pathname.replace(/^.*\/crm-voice/, '') || '/'
  const q = url.searchParams
  const sb = db()

  /* streaming a recording to the app ----------------------------------- */
  if (req.method === 'GET' && path === '/recording') {
    if (!(await teammate(q.get('t') || ''))) return json({ error: 'unauthorized' }, 401)
    const { data: c } = await sb
      .from('crm_calls')
      .select('recording_url')
      .eq('id', q.get('call') || '')
      .maybeSingle()
    if (!c?.recording_url) return json({ error: 'not found' }, 404)
    const r = await fetch(`${c.recording_url}.mp3`, {
      headers: {
        authorization: `Basic ${btoa(`${env('TWILIO_ACCOUNT_SID')}:${env('TWILIO_AUTH_TOKEN')}`)}`,
      },
    })
    return new Response(r.body, {
      status: r.status,
      headers: {
        'content-type': 'audio/mpeg',
        'cache-control': 'private, max-age=3600',
      },
    })
  }
  if (req.method !== 'POST') return json({ ok: true })

  /* browser token -------------------------------------------------------- */
  if (path === '/token') {
    const name = await teammate((req.headers.get('authorization') || '').replace(/^Bearer /, ''))
    if (!name) return json({ error: 'unauthorized' }, 401)
    if (!env('TWILIO_API_KEY_SECRET') || !env('TWILIO_TWIML_APP_SID')) return json({ error: 'Phone carrier is not connected yet' }, 503)
    return json({ token: await accessToken(name), identity: name })
  }

  // Everything below is Twilio calling us.
  const form: Record<string, string> = {}
  ;(await req.formData()).forEach((v, k) => (form[k] = String(v)))
  if (!(await fromTwilio(req, path, form))) return json({ error: 'bad signature' }, 401)
  const s = await settings(sb)

  /* outbound from the browser ------------------------------------------ */
  if (path === '/outbound') {
    const to = form.To || ''
    const callId = form.CallId || ''
    const { data: line } = await sb
      .from('crm_numbers')
      .select('*')
      .eq('number', form.From || '')
      .eq('kind', 'line')
      .eq('active', true)
      .maybeSingle()
    if (!line || !/^\+1\d{10}$/.test(to)) return xml('<Say>This call could not be placed.</Say>')
    if (callId)
      await sb
        .from('crm_calls')
        .update({
          provider_id: form.CallSid,
          from_number: line.number,
          number_id: line.id,
        })
        .eq('id', callId)
    const rec = form.Record === '1' && line.record
    const cb = `${PUBLIC}/dial-done?call=${encodeURIComponent(callId)}`
    const recAttrs = rec ? ` record="record-from-answer" recordingStatusCallback="${esc(`${PUBLIC}/recording?call=${encodeURIComponent(callId)}`)}"` : ''
    return xml(`<Dial callerId="${esc(line.number)}" answerOnBridge="true" timeout="30" action="${esc(cb)}"${recAttrs}><Number>${esc(to)}</Number></Dial>`)
  }

  if (path === '/dial-done') {
    const id = q.get('call') || ''
    const status = DIAL_STATUS[form.DialCallStatus || ''] || 'failed'
    const dur = Number(form.DialCallDuration || 0)
    const { data: c } = await sb.from('crm_calls').select('*').eq('id', id).maybeSingle()
    if (c) {
      // Keep the caller's outcome (voicemail, etc.) if one is already logged.
      const keep = c.outcome && ['no_answer', 'voicemail', 'failed'].includes(c.status)
      await sb
        .from('crm_calls')
        .update({
          duration_sec: dur,
          status: keep ? c.status : status === 'completed' && c.outcome === 'voicemail' ? 'voicemail' : status,
        })
        .eq('id', id)
    }
    return xml('')
  }

  /* inbound to any of our numbers -------------------------------------- */
  if (path === '/inbound') {
    const { data: n } = await sb
      .from('crm_numbers')
      .select('*')
      .eq('number', form.To || '')
      .maybeSingle()
    const from = form.From || ''
    const { data: leads } = await sb
      .from('crm_leads')
      .select('id, owner')
      .like('phone', `%${digits(from).slice(-10)}`)
      .limit(1)
    const lead = leads?.[0]
    const owner = n?.owner || lead?.owner || (s.callers as string[] | undefined)?.[0] || 'K'
    const { data: c } = await sb
      .from('crm_calls')
      .insert({
        lead_id: lead?.id ?? null,
        direction: 'in',
        user_name: owner,
        from_number: from,
        to_number: form.To || '',
        number_id: n?.id ?? null,
        source: n?.source || 'Unknown',
        status: 'live',
        started_at: new Date().toISOString(),
        via: 'forward',
        provider_id: form.CallSid,
      })
      .select('id')
      .single()
    const id = c?.id || ''
    const rec = n?.record !== false && s.record_calls !== false
    const recAttrs = rec ? ` record="record-from-answer" recordingStatusCallback="${esc(`${PUBLIC}/recording?call=${id}`)}"` : ''
    const targets = `<Client>${esc(owner)}</Client>${n?.forward_to ? `<Number>${esc(n.forward_to)}</Number>` : ''}`
    return xml(`<Dial timeout="22" answerOnBridge="true" action="${esc(`${PUBLIC}/inbound-done?call=${id}`)}"${recAttrs}>${targets}</Dial>`)
  }

  if (path === '/inbound-done') {
    const id = q.get('call') || ''
    const answered = form.DialCallStatus === 'completed' || form.DialCallStatus === 'answered'
    const { data: c } = await sb.from('crm_calls').select('*').eq('id', id).maybeSingle()
    if (answered) {
      if (c)
        await sb
          .from('crm_calls')
          .update({
            status: 'completed',
            duration_sec: Number(form.DialCallDuration || 0),
          })
          .eq('id', id)
      return xml('')
    }
    if (c) {
      await sb.from('crm_calls').update({ status: 'missed', duration_sec: 0, user_name: '' }).eq('id', id)
      if (s.missed_call_task !== false) {
        const { data: n } = c.number_id ? await sb.from('crm_numbers').select('label, owner').eq('id', c.number_id).maybeSingle() : { data: null }
        await sb.from('crm_tasks').insert({
          lead_id: c.lead_id,
          kind: 'callback',
          owner: n?.owner || c.user_name || 'K',
          due_at: new Date().toISOString(),
          reason: `Missed call from ${c.from_number} on ${n?.label || c.source}`,
          created_by: 'Phone',
        })
      }
    }
    // Voicemail: up to two minutes, recorded onto the same call.
    return xml(
      `<Say voice="Polly.Matthew">Sorry we missed you. Leave your name, company and the best time to call back.</Say><Record maxLength="120" playBeep="true" recordingStatusCallback="${esc(`${PUBLIC}/recording?call=${id}`)}" action="${esc(`${PUBLIC}/hangup`)}"/>`,
    )
  }

  if (path === '/hangup') return xml('<Hangup/>')

  if (path === '/recording') {
    if (form.RecordingStatus === 'completed' && form.RecordingUrl) {
      const id = q.get('call') || ''
      const { data: c } = await sb.from('crm_calls').select('status').eq('id', id).maybeSingle()
      await sb
        .from('crm_calls')
        .update({
          recording_url: form.RecordingUrl,
          ...(c?.status === 'missed'
            ? {
                status: 'voicemail',
                duration_sec: Number(form.RecordingDuration || 0),
              }
            : {}),
        })
        .eq('id', id)
    }
    return json({ ok: true })
  }

  return json({ error: 'unknown route' }, 404)
})
