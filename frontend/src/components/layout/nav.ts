import {
  LayoutDashboard,
  Users,
  CalendarDays,
  Stethoscope,
  UserPlus,
  ClipboardList,
  FileText,
  Pill,
  FlaskConical,
  Receipt,
  Boxes,
  BadgeCheck,
  BarChart3,
  Star,
  MessageSquare,
  Megaphone,
  Database,
  Settings,
  IdCard,
  StickyNote,
  Activity,
  Wallet,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  label: string
  to: string
  icon: LucideIcon
  /** Only these roles see the entry (the API refuses the others); a super admin sees everything. */
  roles?: string[]
}

/** The roles that may see the clinic's money going out (backend/app/roles.py FINANCE_ROLES). */
export const FINANCE_ROLES = ['Clinic Owner', 'Administrator', 'Accountant']

export interface NavGroup {
  label?: string
  items: NavItem[]
}

/**
 * The sidebar, in the CMS design's groups and with its names where a page is the same feature
 * (docs/design/cms.fig, e.g. frame "cms" 247:4787). Pages the design does not list keep their
 * names and sit in the nearest group. Design entries with no page behind them yet (Receipts,
 * Consent, Help & Support, Social Media, a separate Non-clinical Staff list) are not shown.
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    items: [
      { label: 'Home', to: '/', icon: LayoutDashboard },
      { label: 'Patients', to: '/patients', icon: Users },
    ],
  },
  {
    label: 'Team Management',
    items: [
      { label: 'Staff', to: '/staff', icon: IdCard },
      { label: 'Appointments', to: '/appointments', icon: CalendarDays },
      { label: 'Clinical Chart', to: '/clinical', icon: Activity },
      { label: 'Consultants', to: '/consultants', icon: Stethoscope },
      { label: 'Book a Consultant', to: '/book-consultant', icon: UserPlus },
      { label: 'Schedule Notes', to: '/schedule-notes', icon: StickyNote },
    ],
  },
  {
    label: 'Financials',
    items: [
      { label: 'Accounts', to: '/accounts', icon: Receipt },
      { label: 'Expenses', to: '/expenses', icon: Wallet, roles: FINANCE_ROLES },
      { label: 'FRS', to: '/frs', icon: ClipboardList },
      { label: 'Certificates', to: '/certificates', icon: BadgeCheck },
    ],
  },
  {
    label: 'Clinical & Operations',
    items: [
      { label: 'Inventory', to: '/inventory', icon: Boxes },
      { label: 'E-prescription', to: '/prescriptions', icon: FileText },
      { label: 'Pharmacy', to: '/pharmacy', icon: Pill },
      { label: 'Lab Orders', to: '/lab', icon: FlaskConical },
    ],
  },
  {
    label: 'Analytics & Engagement',
    items: [
      { label: 'Reports', to: '/reports', icon: BarChart3 },
      { label: 'Reviews & Ratings', to: '/reviews', icon: Star },
      { label: 'Omni-channel', to: '/omni', icon: MessageSquare },
      { label: 'Lead Generation', to: '/leads', icon: Megaphone },
    ],
  },
  {
    label: 'System',
    items: [
      { label: 'Masters', to: '/masters', icon: Database },
      { label: 'Settings', to: '/settings', icon: Settings },
    ],
  },
]

/** Mobile bottom navigation — the 4 highest-frequency reception destinations. */
export const MOBILE_NAV: NavItem[] = [
  { label: 'Home', to: '/', icon: LayoutDashboard },
  { label: 'Patients', to: '/patients', icon: Users },
  { label: 'Appointments', to: '/appointments', icon: CalendarDays },
  { label: 'Accounts', to: '/accounts', icon: Receipt },
]
