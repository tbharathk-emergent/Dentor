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
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  label: string
  to: string
  icon: LucideIcon
}

export interface NavGroup {
  label?: string
  items: NavItem[]
}

export const NAV_GROUPS: NavGroup[] = [
  {
    items: [{ label: 'Home', to: '/', icon: LayoutDashboard }],
  },
  {
    label: 'Front Desk',
    items: [
      { label: 'Patients', to: '/patients', icon: Users },
      { label: 'Appointments', to: '/appointments', icon: CalendarDays },
      { label: 'Book a Consultant', to: '/book-consultant', icon: UserPlus },
      { label: 'Billing & Accounts', to: '/accounts', icon: Receipt },
      { label: 'Schedule Notes', to: '/schedule-notes', icon: StickyNote },
    ],
  },
  {
    label: 'Clinical',
    items: [
      { label: 'Consultants', to: '/consultants', icon: Stethoscope },
      { label: 'Clinical Charts', to: '/clinical', icon: Activity },
      { label: 'FRS', to: '/frs', icon: ClipboardList },
      { label: 'E-Prescription', to: '/prescriptions', icon: FileText },
      { label: 'Certificates', to: '/certificates', icon: BadgeCheck },
    ],
  },
  {
    label: 'Operations',
    items: [
      { label: 'Pharmacy', to: '/pharmacy', icon: Pill },
      { label: 'Lab Orders', to: '/lab', icon: FlaskConical },
      { label: 'Inventory', to: '/inventory', icon: Boxes },
      { label: 'Staff', to: '/staff', icon: IdCard },
    ],
  },
  {
    label: 'Growth',
    items: [
      { label: 'Reports & Analytics', to: '/reports', icon: BarChart3 },
      { label: 'Reviews', to: '/reviews', icon: Star },
      { label: 'Omnichannel', to: '/omni', icon: MessageSquare },
      { label: 'Lead Generation', to: '/leads', icon: Megaphone },
    ],
  },
  {
    label: 'Administration',
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
  { label: 'Billing', to: '/accounts', icon: Receipt },
]
