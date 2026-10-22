import type { IconName } from '../components/ui'

export type Route =
  | 'home'
  | 'dial'
  | 'calls'
  | 'inbox'
  | 'contacts'
  | 'contact'
  | 'pipeline'
  | 'calendar'
  | 'tasks'
  | 'sequences'
  | 'workflows'
  | 'workflow'
  | 'scripts'
  | 'campaigns'
  | 'approvals'
  | 'templates'
  | 'lists'
  | 'reports'
  | 'forms'
  | 'numbers'
  | 'integrations'
  | 'import'
  | 'settings'

export interface Loc {
  route: Route
  id: string
}

export interface NavItem {
  key: Route
  label: string
  icon: IconName
}

export const NAV: { section: string; items: NavItem[] }[] = [
  {
    section: 'Workspace',
    items: [
      { key: 'home', label: 'Home', icon: 'home' },
      { key: 'dial', label: 'Dial', icon: 'phone' },
      { key: 'calls', label: 'Calls', icon: 'calls' },
      { key: 'inbox', label: 'Inbox', icon: 'inbox' },
      { key: 'contacts', label: 'Contacts', icon: 'users' },
      { key: 'pipeline', label: 'Pipeline', icon: 'kanban' },
      { key: 'calendar', label: 'Calendar', icon: 'calendar' },
      { key: 'tasks', label: 'Tasks', icon: 'task' },
    ],
  },
  {
    section: 'Outreach',
    items: [
      { key: 'workflows', label: 'Workflows', icon: 'bolt' },
      { key: 'scripts', label: 'Scripts', icon: 'script' },
      { key: 'sequences', label: 'Sequences', icon: 'flow' },
      { key: 'campaigns', label: 'Campaigns', icon: 'send' },
      { key: 'approvals', label: 'Approvals', icon: 'approve' },
      { key: 'templates', label: 'Templates', icon: 'file' },
      { key: 'lists', label: 'Lists', icon: 'layers' },
    ],
  },
  {
    section: 'Insight',
    items: [{ key: 'reports', label: 'Reports', icon: 'chart' }],
  },
  {
    section: 'Setup',
    items: [
      { key: 'numbers', label: 'Phone numbers', icon: 'hash' },
      { key: 'forms', label: 'Forms', icon: 'form' },
      { key: 'integrations', label: 'Integrations', icon: 'plug' },
      { key: 'import', label: 'Import', icon: 'upload' },
      { key: 'settings', label: 'Settings', icon: 'settings' },
    ],
  },
]

export const ALL_ROUTES: Route[] = [...NAV.flatMap((s) => s.items.map((i) => i.key)), 'contact', 'workflow']

export function sectionOf(r: Route): { section: string; label: string } {
  if (r === 'contact') return { section: 'Workspace', label: 'Contacts' }
  if (r === 'workflow') return { section: 'Outreach', label: 'Workflows' }
  for (const s of NAV) for (const i of s.items) if (i.key === r) return { section: s.section, label: i.label }
  return { section: 'Workspace', label: 'Home' }
}

export function parseHash(): Loc {
  const [r, id = ''] = location.hash.replace(/^#\/?/, '').split('/')
  const route = (ALL_ROUTES.includes(r as Route) ? r : r === 'today' ? 'home' : 'home') as Route
  return { route, id: decodeURIComponent(id) }
}

export function href(route: Route, id = '') {
  return `#/${route}${id ? `/${encodeURIComponent(id)}` : ''}`
}
