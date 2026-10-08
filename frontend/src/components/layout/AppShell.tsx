import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeftRight, Building2, CalendarPlus, LogOut, Menu, Plus, Search, X } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useAuth } from '@/lib/auth'
import { getActiveClinic, setActiveClinic } from '@/lib/api'
import { Button } from '@/components/ui/Button'
import { Avatar } from '@/components/ui/bits'
import { GlobalSearch } from './GlobalSearch'
import { MOBILE_NAV, NAV_GROUPS } from './nav'

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const navigate = useNavigate()
  return (
    <div className="flex h-full flex-col">
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-5 pb-4 pt-5">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-sm">
          <svg viewBox="0 0 32 32" className="h-5 w-5 fill-current">
            <path d="M16 4c-4.4 0-8 3.2-8 7.6 0 3 1.1 5 2.1 7.4.9 2 1.5 5.4 2 7.6.3 1.1 1.7 1.2 2.2.1l1.2-5.1c.2-.6.9-.6 1 0l1.2 5.1c.4 1.1 1.9 1 2.2-.1.5-2.2 1.1-5.6 2-7.6 1-2.4 2.1-4.4 2.1-7.4C24 7.2 20.4 4 16 4z" />
          </svg>
        </span>
        <div>
          <div className="text-[17px] font-bold tracking-tight text-slate-900">Dentor</div>
          <div className="text-[10px] font-semibold uppercase tracking-widest text-brand-700">
            Clinic Management
          </div>
        </div>
      </div>

      {/* Primary workflow action */}
      <div className="px-4 pb-3">
        <Button
          className="w-full"
          onClick={() => {
            navigate('/appointments?new=1')
            onNavigate?.()
          }}
        >
          <CalendarPlus className="h-4 w-4" />
          New Appointment
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 pb-4">
        {NAV_GROUPS.map((group, gi) => (
          <div key={gi} className="mt-1">
            {group.label && (
              <div className="px-2 pb-1 pt-4 text-[10.5px] font-semibold uppercase tracking-wider text-slate-400">
                {group.label}
              </div>
            )}
            <ul className="space-y-0.5">
              {group.items.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.to === '/'}
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13.5px] font-medium transition-colors',
                        isActive
                          ? 'bg-brand-50 text-brand-800'
                          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                      )
                    }
                  >
                    <item.icon className="h-[17px] w-[17px] shrink-0 opacity-80" />
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
    </div>
  )
}

export default function AppShell() {
  const { user, logout, isSuperAdmin } = useAuth()
  const activeClinic = getActiveClinic()
  const [mobileMenu, setMobileMenu] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()

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
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 border-r border-slate-200 bg-white lg:block">
        <SidebarContent />
      </aside>

      {/* Mobile slide-over menu */}
      {mobileMenu && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-ink-900/40" onClick={() => setMobileMenu(false)} />
          <div className="absolute inset-y-0 left-0 w-[280px] max-w-[85vw] bg-white shadow-pop animate-fade-up">
            <button
              onClick={() => setMobileMenu(false)}
              className="absolute right-3 top-4 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </button>
            <SidebarContent onNavigate={() => setMobileMenu(false)} />
          </div>
        </div>
      )}

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col lg:pl-60">
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
            'sticky z-20 flex h-14 items-center gap-2 border-b border-slate-200 bg-white/90 px-3 backdrop-blur sm:px-4',
            isSuperAdmin && activeClinic ? 'top-7' : 'top-0',
          )}
        >
          <button
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
            onClick={() => setMobileMenu(true)}
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* Search trigger */}
          <button
            onClick={() => setSearchOpen(true)}
            className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-400 transition hover:border-slate-300 hover:bg-white sm:max-w-md"
          >
            <Search className="h-4 w-4" />
            <span className="truncate">Search patients, appointments, invoices…</span>
            <kbd className="ml-auto hidden rounded border border-slate-200 bg-white px-1.5 text-[10px] font-medium text-slate-400 sm:block">
              ⌘K
            </kbd>
          </button>

          <div className="ml-auto flex shrink-0 items-center gap-1.5">
            {/* Wrapper carries the breakpoint: Button's own inline-flex would override `hidden`. */}
            <div className="hidden sm:block">
              <Button variant="primary" size="sm" onClick={() => navigate('/appointments?new=1')}>
                <Plus className="h-4 w-4" />
                Appointment
              </Button>
            </div>
            <div className="group relative">
              <button className="flex items-center gap-2 rounded-full p-1 pr-2 hover:bg-slate-100">
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
