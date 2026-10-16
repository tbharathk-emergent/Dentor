import { Component, lazy, Suspense, type ReactNode } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { TriangleAlert, WifiOff } from 'lucide-react'
import { useAuth } from './lib/auth'
import { getActiveClinic } from './lib/api'
import AppShell from './components/layout/AppShell'
import Login from './pages/Login'
import { Button } from './components/ui/Button'
import { EmptyState, ListSkeleton } from './components/ui/bits'

const Dashboard = lazy(() => import('./pages/Dashboard'))
const Patients = lazy(() => import('./pages/Patients'))
const PatientProfile = lazy(() => import('./pages/PatientProfile'))
const Appointments = lazy(() => import('./pages/Appointments'))
const BookConsultant = lazy(() => import('./pages/BookConsultant'))
const Consultants = lazy(() => import('./pages/Consultants'))
const ClinicalCharts = lazy(() => import('./pages/ClinicalCharts'))
const Frs = lazy(() => import('./pages/Frs'))
const Prescriptions = lazy(() => import('./pages/Prescriptions'))
const Pharmacy = lazy(() => import('./pages/Pharmacy'))
const Lab = lazy(() => import('./pages/Lab'))
const Accounts = lazy(() => import('./pages/Accounts'))
const Expenses = lazy(() => import('./pages/Expenses'))
const Inventory = lazy(() => import('./pages/Inventory'))
const Staff = lazy(() => import('./pages/Staff'))
const Certificates = lazy(() => import('./pages/Certificates'))
const Reports = lazy(() => import('./pages/Reports'))
const Reviews = lazy(() => import('./pages/Reviews'))
const Omni = lazy(() => import('./pages/Omni'))
const Leads = lazy(() => import('./pages/Leads'))
const Masters = lazy(() => import('./pages/Masters'))
const Settings = lazy(() => import('./pages/Settings'))
const ScheduleNotes = lazy(() => import('./pages/ScheduleNotes'))
const Platform = lazy(() => import('./pages/Platform'))

type PageFailure = 'download' | 'error' | null

/**
 * A page's code is downloaded the first time the page is opened. If that download fails (no
 * connection, or a new release has replaced the file) React would otherwise unmount the whole app
 * and leave a blank screen. This keeps the rest of the app on screen and says what happened.
 */
class PageBoundary extends Component<{ at: string; children: ReactNode }, { failure: PageFailure; at: string }> {
  state: { failure: PageFailure; at: string } = { failure: null, at: this.props.at }

  static getDerivedStateFromError(error: unknown) {
    const download = /dynamically imported module|module script failed|Failed to fetch|Load failed/i.test(String(error))
    return { failure: (download ? 'download' : 'error') as PageFailure }
  }

  // Opening another page is a fresh start.
  static getDerivedStateFromProps(props: { at: string }, state: { at: string }) {
    return props.at === state.at ? null : { failure: null, at: props.at }
  }

  render() {
    const { failure } = this.state
    if (!failure) return this.props.children
    return (
      <EmptyState
        icon={failure === 'download' ? <WifiOff className="h-6 w-6" /> : <TriangleAlert className="h-6 w-6" />}
        title={failure === 'download' ? 'This page could not be loaded' : 'Something went wrong on this page'}
        message={
          failure === 'download'
            ? 'Check your internet connection, then try again.'
            : 'Try again. If it keeps happening, tell your administrator.'
        }
        action={
          <Button size="sm" onClick={() => window.location.reload()}>
            Try again
          </Button>
        }
      />
    )
  }
}

/** One page: its loading state, and its failure state kept inside the app. */
function Page({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  return (
    <PageBoundary at={pathname}>
      <Suspense fallback={<ListSkeleton rows={6} />}>{children}</Suspense>
    </PageBoundary>
  )
}

function Protected({ children }: { children: ReactNode }) {
  const { isAuthenticated, isSuperAdmin } = useAuth()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  // A super admin first picks the clinic to manage from the platform console.
  if (isSuperAdmin && !getActiveClinic()) return <Navigate to="/platform" replace />
  return <>{children}</>
}

function SuperAdminOnly({ children }: { children: ReactNode }) {
  const { isAuthenticated, isSuperAdmin } = useAuth()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (!isSuperAdmin) return <Navigate to="/" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/platform"
        element={
          <SuperAdminOnly>
            <Page>
              <Platform />
            </Page>
          </SuperAdminOnly>
        }
      />
      <Route
        element={
          <Protected>
            <AppShell />
          </Protected>
        }
      >
        <Route
          path="/"
          element={
            <Page>
              <Dashboard />
            </Page>
          }
        />
        {(
          [
            ['/patients', Patients],
            ['/patients/:id', PatientProfile],
            ['/appointments', Appointments],
            ['/book-consultant', BookConsultant],
            ['/consultants', Consultants],
            ['/clinical', ClinicalCharts],
            ['/frs', Frs],
            ['/prescriptions', Prescriptions],
            ['/pharmacy', Pharmacy],
            ['/lab', Lab],
            ['/accounts', Accounts],
            ['/expenses', Expenses],
            ['/inventory', Inventory],
            ['/staff', Staff],
            ['/certificates', Certificates],
            ['/reports', Reports],
            ['/reviews', Reviews],
            ['/omni', Omni],
            ['/leads', Leads],
            ['/masters', Masters],
            ['/settings', Settings],
            ['/schedule-notes', ScheduleNotes],
          ] as const
        ).map(([path, Comp]) => (
          <Route
            key={path}
            path={path}
            element={
              <Page>
                <Comp />
              </Page>
            }
          />
        ))}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
