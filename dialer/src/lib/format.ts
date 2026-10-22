export function digits(phone: string): string {
  return (phone || '').replace(/\D/g, '')
}

// Normalise to +1XXXXXXXXXX for US numbers so tel:/sms: links and dedupe work.
export function e164(phone: string): string {
  const d = digits(phone)
  if (d.length === 10) return `+1${d}`
  if (d.length === 11 && d.startsWith('1')) return `+${d}`
  return d ? `+${d}` : ''
}

export function prettyPhone(phone: string): string {
  const d = digits(phone)
  const n = d.length === 11 && d.startsWith('1') ? d.slice(1) : d
  if (n.length !== 10) return phone
  return `(${n.slice(0, 3)}) ${n.slice(3, 6)}-${n.slice(6)}`
}

export function fullName(l: { first_name: string; last_name: string }): string {
  return [l.first_name, l.last_name].filter(Boolean).join(' ')
}

const dayFmt = new Intl.DateTimeFormat(undefined, {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
})
const timeFmt = new Intl.DateTimeFormat(undefined, {
  hour: 'numeric',
  minute: '2-digit',
})

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

export function when(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const now = new Date()
  const tomorrow = new Date(now)
  tomorrow.setDate(now.getDate() + 1)
  if (isSameDay(d, now)) return `Today ${timeFmt.format(d)}`
  if (isSameDay(d, tomorrow)) return `Tomorrow ${timeFmt.format(d)}`
  return `${dayFmt.format(d)}, ${timeFmt.format(d)}`
}

// Spoken form for texts: "tomorrow at 9:00 AM"
export function whenSpoken(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const tomorrow = new Date(now)
  tomorrow.setDate(now.getDate() + 1)
  const t = timeFmt.format(d)
  if (isSameDay(d, now)) return `today at ${t}`
  if (isSameDay(d, tomorrow)) return `tomorrow at ${t}`
  return `${dayFmt.format(d)} at ${t}`
}

export function ago(iso: string | null): string {
  if (!iso) return 'Never'
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'just now'
  const m = Math.round(s / 60)
  if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h} h ago`
  const dd = Math.round(h / 24)
  return `${dd} d ago`
}

export function startOfToday(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

// Value for <input type="datetime-local">
export function toLocalInput(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

export function nextWeekdayAt(hour: number, minDaysAhead = 1): Date {
  const d = new Date()
  d.setDate(d.getDate() + minDaysAhead)
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1)
  d.setHours(hour, 0, 0, 0)
  return d
}

export function uid(): string {
  return crypto.randomUUID()
}
