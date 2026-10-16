import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeftRight, Building2, CalendarPlus, Download, LogOut, Menu, PanelLeftClose, PanelLeftOpen, Plus, Search, X } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useAuth } from '@/lib/auth'
import { getActiveClinic, setActiveClinic } from '@/lib/api'
import { useInstallPrompt } from '@/lib/pwa'
import { Button } from '@/components/ui/Button'
import { Avatar } from '@/components/ui/bits'
import { GlobalSearch } from './GlobalSearch'
import { NotificationBell } from './NotificationBell'
import { MOBILE_NAV, NAV_GROUPS } from './nav'
import logoCard from '@/assets/design/logo-card.png'

const COLLAPSED_KEY = 'dentor.sidebar.collapsed'

/** The desktop sidebar can shrink to its icons (cms.fig "cms / nav bar transform" 155:7575); remembered per browser. */
function useCollapsedSidebar() {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSED_KEY) === '1'
    } catch {
      return false
    }
  })
  const toggle = () =>
    setCollapsed((was) => {
      try {
        localStorage.setItem(COLLAPSED_KEY, was ? '0' : '1')
      } catch {
        // storage unavailable (private window): the choice lasts until the page reloads
      }
      return !was
    })
  return [collapsed, toggle] as const
}

function SidebarContent({ onNavigate, collapsed = false }: { onNavigate?: () => void; collapsed?: boolean }) {
  const navigate = useNavigate()
  const { logout, user, isSuperAdmin } = useAuth()
  const allowed = (roles?: string[]) => !roles || isSuperAdmin || roles.includes(user?.role ?? '')
  return (
    <div className="flex h-full flex-col">
      {/* Brand: the design's logo card (cms.fig, frame "cms" 247:4787) */}
      {!collapsed && (
        <div className="px-4 pb-3 pt-4">
          <img src={logoCard} alt="DENTOR — Dentistry Amassed" className="w-full max-w-[208px] rounded-[15px] shadow-sm" />
        </div>
      )}

      {/* Primary workflow action */}
      <div className={cn('pb-2', collapsed ? 'px-2 pt-4' : 'px-4')}>
        <Button
          className={cn('w-full !bg-white !text-brand-700 hover:!bg-brand-50', collapsed && '!px-0')}
          aria-label={collapsed ? 'New Appointment' : undefined}
          title={collapsed ? 'New Appointment' : undefined}
          onClick={() => {
            navigate('/appointments?new=1')
            onNavigate?.()
          }}
        >
          <CalendarPlus className="h-4 w-4" />
          {!collapsed && 'New Appointment'}
        </Button>
      </div>

      {/* Navigation: the design's groups, white on teal, the open page on a white pill */}
      <nav className={cn('flex-1 overflow-y-auto pb-2', collapsed ? 'px-2' : 'px-3')} aria-label="Main">
        {NAV_GROUPS.map((group, gi) => (
          <div key={gi} className={cn('mt-1', gi > 0 && 'border-t border-white/25 pt-1')}>
            {group.label && !collapsed && (
              <div className="px-2 pb-1 pt-3 font-display text-[11px] font-bold uppercase tracking-wider text-white/85">
                {group.label}
              </div>
            )}
            <ul className="space-y-0.5">
              {group.items.filter((item) => allowed(item.roles)).map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.to === '/'}
                    onClick={onNavigate}
                    title={collapsed ? item.label : undefined}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-2.5 rounded-lg py-2 text-[13.5px] font-medium transition-colors',
                        collapsed ? 'justify-center px-0' : 'px-2.5',
                        isActive ? 'bg-white text-brand-700 shadow-sm' : 'text-white hover:bg-white/15',
                      )
                    }
                  >
                    <item.icon className="h-[17px] w-[17px] shrink-0 opacity-90" aria-hidden="true" />
                    <span className={cn(collapsed && 'sr-only')}>{item.label}</span>
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {/* The design ends the sidebar with Logout */}
      <div className={cn('border-t border-white/25 py-2', collapsed ? 'px-2' : 'px-3')}>
        <button
          onClick={logout}
          title={collapsed ? 'Logout' : undefined}
          className={cn(
            'flex w-full items-center gap-2.5 rounded-lg py-2 text-[13.5px] font-medium text-white hover:bg-white/15',
            collapsed ? 'justify-center px-0' : 'px-2.5',
          )}
        >
          <LogOut className="h-[17px] w-[17px] shrink-0" aria-hidden="true" /> <span className={cn(collapsed && 'sr-only')}>Logout</span>
        </button>
      </div>
    </div>
  )
}

/** "Good Morning" and "8:00 am MONDAY - May 16th - 2026", as the design's header shows them. */
function useClock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(timer)
  }, [])
  const hour = now.getHours()
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening'
  const day = now.getDate()
  const suffix = day % 10 === 1 && day !== 11 ? 'st' : day % 10 === 2 && day !== 12 ? 'nd' : day % 10 === 3 && day !== 13 ? 'rd' : 'th'
  const time = now.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }).toLowerCase()
  const date = `${now.toLocaleDateString('en-IN', { weekday: 'long' }).toUpperCase()} - ${now.toLocaleDateString('en-IN', { month: 'long' })} ${day}${suffix} - ${now.getFullYear()}`
  return { greeting, time, date }
}

export default function AppShell() {
  const { user, logout, isSuperAdmin } = useAuth()
  const { canInstall, install } = useInstallPrompt()
  const activeClinic = getActiveClinic()
  const [mobileMenu, setMobileMenu] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const clock = useClock()
  const clinic = user?.clinic ?? activeClinic
  const [collapsed, toggleCollapsed] = useCollapsedSidebar()

  // Close the mobile drawer on navigation
  useEffect(() => setMobileMenu(false), [location.pathname])

  // Cmd/Ctrl+K opens global search
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="flex min-h-dvh">
      {/* Desktop sidebar */}
      <aside
        data-testid="desktop-sidebar"
        data-collapsed={collapsed ? 'true' : 'false'}
        className={cn('fixed inset-y-0 left-0 z-30 hidden bg-brand-500 transition-[width] lg:block', collapsed ? 'w-[68px]' : 'w-60')}
      >
        <SidebarContent collapsed={collapsed} />
      </aside>

      {/* Mobile slide-over menu */}
      {mobileMenu && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-ink-900/40" onClick={() => setMobileMenu(false)} />
          <div className="absolute inset-y-0 left-0 w-[280px] max-w-[85vw] bg-brand-500 shadow-pop animate-fade-up">
            <button
              onClick={() => setMobileMenu(false)}
              className="absolute right-3 top-4 rounded-lg bg-white/90 p-1.5 text-slate-600 hover:bg-white"
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </button>
            <SidebarContent onNavigate={() => setMobileMenu(false)} />
          </div>
        </div>
      )}

      {/* Main column */}
      <div className={cn('flex min-w-0 flex-1 flex-col', collapsed ? 'lg:pl-[68px]' : 'lg:pl-60')}>
        {/* Super admin: which clinic is being managed */}
        {isSuperAdmin && activeClinic && (
          <div className="sticky top-0 z-30 flex items-center gap-2 bg-ink-900 px-3 py-1.5 text-xs text-white sm:px-4">
            <Building2 className="h-3.5 w-3.5 shrink-0 text-brand-300" />
            <span className="min-w-0 truncate">
              Managing <b>{activeClinic.name}</b>
              <span className="ml-1 hidden text-slate-400 sm:inline">{activeClinic.code}</span>
            </span>
            <button
              onClick={() => {
                setActiveClinic(null)
                window.location.assign('/platform')
              }}
              className="ml-auto flex shrink-0 items-center gap-1 rounded-md bg-white/10 px-2 py-1 font-medium hover:bg-white/20"
            >
              <ArrowLeftRight className="h-3 w-3" /> Switch clinic
            </button>
          </div>
        )}
        {/* Top header */}
        <header
          className={cn(
            // The design's teal band (cms.fig, frame "cms" 247:4787): greeting and clock in Manrope, white.
            'sticky z-20 flex h-16 items-center gap-2 bg-brand-500 px-3 text-white shadow-sm sm:px-4',
            isSuperAdmin && activeClinic ? 'top-7' : 'top-0',
          )}
        >
          <button
            className="hidden rounded-lg p-2 text-white hover:bg-white/15 lg:inline-flex"
            onClick={toggleCollapsed}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!collapsed}
            data-testid="sidebar-toggle"
          >
            {collapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
          </button>
          <button
            className="rounded-lg p-2 text-white hover:bg-white/15 lg:hidden"
            onClick={() => setMobileMenu(true)}
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="hidden shrink-0 flex-col leading-tight xl:flex">
            <span className="font-display text-lg font-bold">{clock.greeting}</span>
            <span className="font-display text-[11px] font-semibold text-white/90">
              {clock.time} · {clock.date}
            </span>
          </div>

          {/* Search trigger */}
          <button
            onClick={() => setSearchOpen(true)}
            className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-lg border border-white/40 bg-white px-3 text-sm text-slate-400 transition hover:border-white sm:max-w-md xl:ml-4"
          >
            <Search className="h-4 w-4" />
            <span className="truncate">Search patients, appointments, invoices…</span>
            <kbd className="ml-auto hidden rounded border border-slate-200 bg-white px-1.5 text-[10px] font-medium text-slate-400 sm:block">
              ⌘K
            </kbd>
          </button>

          <div className="ml-auto flex shrink-0 items-center gap-1.5">
            {/* The design's "Welcome" box: the clinic's name and code */}
            {clinic && (
              <div className="hidden min-w-0 max-w-[260px] flex-col rounded-lg border border-white/60 px-3 py-1 leading-tight 2xl:flex">
                <span className="text-[11px] font-semibold text-white/90">Welcome</span>
                <span className="truncate font-display text-sm font-bold uppercase">{clinic.name}</span>
                {!!clinic.code && <span className="text-[11px] text-white/90">Clinic ID: {clinic.code}</span>}
              </div>
            )}
            {/* Wrapper carries the breakpoint: Button's own inline-flex would override `hidden`. */}
            <div className="hidden sm:block">
              <Button variant="secondary" size="sm" onClick={() => navigate('/appointments?new=1')}>
                <Plus className="h-4 w-4" />
                Appointment
              </Button>
            </div>
            <NotificationBell />
            <div className="group relative">
              <button className="flex items-center gap-2 rounded-full p-1 pr-2 hover:bg-white/15">
                <Avatar name={user?.name} className="h-8 w-8" />
              </button>
              <div className="invisible absolute right-0 top-full z-40 mt-1 w-56 rounded-xl border border-slate-200 bg-white p-1.5 opacity-0 shadow-pop transition-all group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
                <div className="border-b border-slate-100 px-3 py-2">
                  <div className="truncate text-sm font-semibold text-slate-900">{user?.name}</div>
                  <div className="truncate text-xs text-slate-500">{user?.email}</div>
                </div>
                <button
                  onClick={() => navigate('/settings')}
                  className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-600 hover:bg-slate-100"
                >
                  Settings
                </button>
                {canInstall && (
                  <button
                    onClick={install}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-600 hover:bg-slate-100"
                  >
                    <Download className="h-4 w-4" /> Install app
                  </button>
                )}
                <button
                  onClick={logout}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                >
                  <LogOut className="h-4 w-4" /> Sign out
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-4 pb-24 sm:px-6 sm:py-6 lg:pb-8">
          <Outlet />
        </main>

        {/* Mobile bottom navigation */}
        <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur pb-safe lg:hidden">
          <div className="grid grid-cols-5">
            {MOBILE_NAV.slice(0, 2).map((item) => (
              <MobileNavLink key={item.to} {...item} />
            ))}
            {/* Center action */}
            <div className="relative flex justify-center">
              <button
                onClick={() => navigate('/appointments?new=1')}
                aria-label="New appointment"
                className="absolute -top-5 flex h-12 w-12 items-center justify-center rounded-full bg-brand-700 text-white shadow-lg shadow-brand-900/30 active:scale-95 transition"
              >
                <Plus className="h-6 w-6" />
              </button>
              <span className="pt-7 pb-1.5 text-[10px] font-medium text-slate-400">New</span>
            </div>
            {MOBILE_NAV.slice(2).map((item) => (
              <MobileNavLink key={item.to} {...item} />
            ))}
          </div>
        </nav>
      </div>

      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />

    </div>
  )
}

function MobileNavLink({ label, to, icon: Icon }: (typeof MOBILE_NAV)[number]) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        cn(
          'flex flex-col items-center gap-0.5 pb-1.5 pt-2 text-[10px] font-medium',
          isActive ? 'text-brand-700' : 'text-slate-400',
        )
      }
    >
      <Icon className="h-5 w-5" />
      {label}
    </NavLink>
  )
}
