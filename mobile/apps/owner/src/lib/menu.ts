import type { IconName } from '@dentor/shared'
import type { Area } from '@/lib/access'

export interface MenuEntry {
  key: string
  label: string
  icon: IconName
  href: string
  area: Area
  /** Entries shown indented under the one before (the design's "My Appointments" and "Clinical" groups). */
  children?: MenuEntry[]
}

/**
 * The side menu, in the order of the Clinic app design (dentor.fig "Home menu" 3624:2263 and its
 * two expanded states). Entries appear as their screens are built (docs/IMPLEMENTATION_PLAN.md);
 * the app's own screens the design does not have (clinic figures, team, clinic rules) follow.
 */
export const MENU: MenuEntry[] = [
  {
    key: 'appointments', label: 'My Appointments', icon: 'calendar', href: '/appointments', area: 'everyone',
    children: [{ key: 'appointments-month', label: 'Monthly', icon: 'grid', href: '/appointments/month', area: 'everyone' }],
  },
  { key: 'patients', label: 'Patients', icon: 'users', href: '/patients', area: 'everyone' },
  { key: 'consult', label: 'Consultant Bookings', icon: 'user-check', href: '/consult', area: 'everyone' },
  {
    key: 'clinical', label: 'Clinical', icon: 'clipboard', href: '/certificates', area: 'everyone',
    children: [
      { key: 'rx', label: 'E-prescription', icon: 'file-text', href: '/rx/new', area: 'clinical' },
      { key: 'certificates', label: 'Certificates', icon: 'award', href: '/certificates', area: 'everyone' },
    ],
  },
  { key: 'labs', label: 'Labs', icon: 'droplet', href: '/labs', area: 'everyone' },
  { key: 'recall', label: 'Recall', icon: 'bell', href: '/recall', area: 'front-desk' },
  { key: 'revisit', label: 'Re-Visit', icon: 'rotate-ccw', href: '/revisit', area: 'everyone' },
  { key: 'tariff', label: 'Treatment Tariff', icon: 'tag', href: '/tariff', area: 'everyone' },
  { key: 'chat', label: 'Chat', icon: 'message-circle', href: '/chat', area: 'everyone' },
  { key: 'tracking', label: 'Live Tracking', icon: 'navigation', href: '/tracking', area: 'everyone' },
  { key: 'offers', label: 'Post an Offer', icon: 'gift', href: '/offers', area: 'admin' },
  { key: 'store', label: 'E-com', icon: 'shopping-bag', href: '/store', area: 'everyone' },
  { key: 'jobs', label: 'Job Posts', icon: 'briefcase', href: '/jobs', area: 'everyone' },
  { key: 'wallet', label: 'Refer and Earn', icon: 'award', href: '/wallet', area: 'everyone' },
  { key: 'plans', label: 'Premium Membership', icon: 'star', href: '/plans', area: 'admin' },
  { key: 'support', label: 'Raise a Ticket', icon: 'life-buoy', href: '/support', area: 'everyone' },
  { key: 'help', label: 'Help & Support', icon: 'help-circle', href: '/help', area: 'everyone' },
  { key: 'figures', label: 'Clinic Overview', icon: 'bar-chart-2', href: '/overview', area: 'everyone' },
  { key: 'accounts', label: 'Accounts', icon: 'credit-card', href: '/accounts', area: 'money' },
  { key: 'operations', label: 'Operations', icon: 'activity', href: '/operations', area: 'everyone' },
  { key: 'team', label: 'Team', icon: 'users', href: '/team', area: 'admin' },
  { key: 'clinic-rules', label: 'Clinic Rules', icon: 'sliders', href: '/clinic-rules', area: 'admin' },
]
