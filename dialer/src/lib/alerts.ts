// Callback alerts: a short beep plus a desktop notification when a callback comes due.

export type Perm = NotificationPermission | 'unsupported'

export function notifyPermission(): Perm {
  return typeof Notification === 'undefined' ? 'unsupported' : Notification.permission
}

export async function requestNotify(): Promise<Perm> {
  if (typeof Notification === 'undefined') return 'unsupported'
  return Notification.requestPermission()
}

let ctx: AudioContext | null = null
export function beep() {
  try {
    ctx ??= new AudioContext()
    const t = ctx.currentTime
    for (const [i, f] of [880, 1175].entries()) {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.frequency.value = f
      g.gain.setValueAtTime(0.0001, t + i * 0.18)
      g.gain.exponentialRampToValueAtTime(0.25, t + i * 0.18 + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.18 + 0.16)
      o.connect(g).connect(ctx.destination)
      o.start(t + i * 0.18)
      o.stop(t + i * 0.18 + 0.17)
    }
  } catch {
    /* audio blocked until the page gets a click; the visual alert still shows */
  }
}

export function notify(title: string, body: string, onClick?: () => void) {
  beep()
  if (notifyPermission() !== 'granted') return
  try {
    const n = new Notification(title, { body, tag: title + body, requireInteraction: true })
    n.onclick = () => {
      window.focus()
      onClick?.()
      n.close()
    }
  } catch {
    /* some browsers only allow notifications from a service worker */
  }
}

export function testAlert() {
  notify('Callback due: Test Roofing', 'Busy, on a roof · this is what an alert looks like')
}

const SEEN_KEY = 'reboot-dialer:alerted'
export function alreadyAlerted(): Set<string> {
  try {
    return new Set(JSON.parse(sessionStorage.getItem(SEEN_KEY) || '[]'))
  } catch {
    return new Set()
  }
}
export function markAlerted(ids: Set<string>) {
  try {
    sessionStorage.setItem(SEEN_KEY, JSON.stringify([...ids]))
  } catch {
    /* ignore */
  }
}
