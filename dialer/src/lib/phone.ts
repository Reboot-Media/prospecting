// Places calls three ways:
//  - cell: hands the number to the phone (tel:). The CRM times the call and
//    asks for the outcome; no recording.
//  - browser + live: calls through the carrier from the browser (Twilio Voice).
//    The carrier records, and its webhooks fill in the real duration.
//  - browser + demo: a pretend call so the screens can be tried.
import { backend } from './backend'

export type PhoneState = 'ringing' | 'live' | 'ended'

export interface ActiveCall {
  hangup(): void
  mute(on: boolean): void
  digits(d: string): void
}

export interface PlaceOpts {
  to: string
  from: string
  callId: string
  via: 'cell' | 'browser'
  record: boolean
  onState(s: PhoneState, error?: string): void
}

let device: any = null

async function getDevice() {
  if (device) return device
  const { Device } = await import('@twilio/voice-sdk')
  const { token } = await backend.invoke<{ token: string }>('crm-voice/token')
  device = new Device(token, {
    codecPreferences: ['opus', 'pcmu'] as any,
    closeProtection: true,
  })
  device.on('tokenWillExpire', async () => {
    const r = await backend.invoke<{ token: string }>('crm-voice/token')
    device.updateToken(r.token)
  })
  return device
}

export async function placeCall(o: PlaceOpts): Promise<ActiveCall> {
  if (o.via === 'cell') {
    window.location.href = `tel:${o.to}`
    o.onState('live')
    return { hangup: () => o.onState('ended'), mute() {}, digits() {} }
  }
  if (backend.mode === 'demo') {
    o.onState('ringing')
    const t = setTimeout(() => o.onState('live'), 1800)
    return {
      hangup() {
        clearTimeout(t)
        o.onState('ended')
      },
      mute() {},
      digits() {},
    }
  }
  const d = await getDevice()
  const call = await d.connect({
    params: {
      To: o.to,
      From: o.from,
      CallId: o.callId,
      Record: o.record ? '1' : '0',
    },
  })
  o.onState('ringing')
  call.on('accept', () => o.onState('live'))
  call.on('disconnect', () => o.onState('ended'))
  call.on('cancel', () => o.onState('ended'))
  call.on('reject', () => o.onState('ended'))
  call.on('error', (e: any) => o.onState('ended', e?.message || 'Call failed'))
  return {
    hangup: () => call.disconnect(),
    mute: (on) => call.mute(on),
    digits: (x) => call.sendDigits(x),
  }
}

// Recordings sit behind the carrier's login, so live ones stream through our
// function with the user's token.
export async function recordingSrc(url: string, callId: string): Promise<string> {
  if (!url || url === 'demo') return ''
  if (backend.mode === 'demo') return url
  return `${backend.functionsUrl}/crm-voice/recording?call=${callId}&t=${encodeURIComponent(await backend.accessToken())}`
}
