import { lazy, Suspense, type ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './lib/auth'
import { getActiveClinic } from './lib/api'
import AppShell from './components/layout/AppShell'
import Login from './pages/Login'
import { ListSkeleton } from './components/ui/bits'

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
            <Suspense fallback={<ListSkeleton rows={6} />}>
              <Platform />
            </Suspense>
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
            <Suspense fallback={<ListSkeleton rows={6} />}>
              <Dashboard />
            </Suspense>
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
              <Suspense fallback={<ListSkeleton rows={6} />}>
                <Comp />
              </Suspense>
            }
          />
        ))}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
