import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowLeft,
  CalendarPlus,
  Copy,
  MoreVertical,
  Pencil,
  Phone,
  Trash2,
  Users,
} from 'lucide-react'
import { toast } from 'sonner'
import { useDelete, useItem, type Doc } from '@/lib/hooks'
import { Badge } from '@/components/ui/Badge'
import { StatusBadge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ConfirmDialog } from '@/components/ui/Dialog'
import { Tabs } from '@/components/ui/Tabs'
import { Avatar, EmptyState, Skeleton } from '@/components/ui/bits'
import { PatientFormDialog } from './Patients'
import { OverviewTab } from '@/components/patient/OverviewTab'
import { RecordsTab } from '@/components/patient/RecordsTab'
import { DentalChartTab } from '@/components/patient/DentalChartTab'
import { FilesTab } from '@/components/patient/FilesTab'
import { InvoicesTab } from '@/components/patient/InvoicesTab'
import { ConsentsTab } from '@/components/patient/ConsentsTab'
import { TimelineTab } from '@/components/patient/TimelineTab'

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'treatments', label: 'Treatments' },
  { key: 'procedures', label: 'Procedures' },
  { key: 'chart', label: 'Dental Chart' },
  { key: 'files', label: 'Files' },
  { key: 'invoices', label: 'Invoices' },
  { key: 'consents', label: 'Consents' },
  { key: 'timeline', label: 'Timeline' },
]

export default function PatientProfile() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [tab, setTab] = useState('overview')
  const [editOpen, setEditOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const { data: patient, isLoading, isError } = useItem<Doc>('patients', id)
  const remove = useDelete('patients', { successMessage: 'Patient deleted' })

  if (isLoading) {
    return (
      <div>
        <Skeleton className="mb-4 h-8 w-36" />
        <Card className="p-5">
          <div className="flex items-center gap-4">
            <Skeleton className="h-16 w-16 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-4 w-72" />
            </div>
          </div>
        </Card>
        <Skeleton className="mt-4 h-10 w-full" />
        <Skeleton className="mt-4 h-64 w-full" />
      </div>
    )
  }

  if (isError || !patient) {
    return (
      <Card>
        <EmptyState
          icon={<Users className="h-6 w-6" />}
          title="Patient not found"
          message="This record may have been deleted, or the link is out of date."
          action={
            <Button size="sm" onClick={() => navigate('/patients')}>
              <ArrowLeft className="h-4 w-4" /> All Patients
            </Button>
          }
        />
      </Card>
    )
  }

  const hasAllergy =
    patient.allergy && !['none', 'none recorded', 'not recorded'].includes(String(patient.allergy).toLowerCase())

  const copyId = () => {
    navigator.clipboard?.writeText(patient.code).then(
      () => toast.success(`Patient ID ${patient.code} copied`),
      () => toast.error('Could not copy to clipboard'),
    )
    setMenuOpen(false)
  }

  return (
    <div>
      <Button variant="ghost" size="sm" className="mb-3 -ml-2" onClick={() => navigate('/patients')}>
        <ArrowLeft className="h-4 w-4" /> All Patients
      </Button>

      {/* Banner */}
      <Card className="mb-4 p-4 sm:p-5">
        <div className="flex flex-wrap items-start gap-4">
          <Avatar name={patient.name} src={patient.photo} className="h-14 w-14 text-lg sm:h-16 sm:w-16 sm:text-xl" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <h1 className="text-lg font-bold tracking-tight text-slate-900 sm:text-xl">{patient.name}</h1>
              <Badge tone="slate" className="font-mono">{patient.code}</Badge>
              <Badge tone={patient.risk === 'High' ? 'red' : patient.risk === 'Medium' ? 'amber' : 'green'}>
                {patient.risk} Risk
              </Badge>
              <StatusBadge status={patient.status} />
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[13px] text-slate-500">
              <span>{patient.age ?? '—'} yrs · {patient.gender || '—'}</span>
              {patient.blood && <span>Blood {patient.blood}</span>}
              {patient.mobile && (
                <a href={`tel:${patient.mobile}`} className="flex items-center gap-1 text-brand-700 hover:underline">
                  <Phone className="h-3.5 w-3.5" /> {patient.mobile}
                </a>
              )}
              {patient.doctor && <span>{patient.doctor}</span>}
            </div>
            {hasAllergy && (
              <div className="mt-2.5 flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-[13px] font-semibold text-red-700 ring-1 ring-inset ring-red-200">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>Allergy alert: {patient.allergy}</span>
              </div>
            )}
          </div>

          {/* Quick actions */}
          <div className="flex w-full items-center gap-2 sm:w-auto">
            <Button variant="outline" size="sm" className="flex-1 sm:flex-none" onClick={() => setEditOpen(true)}>
              <Pencil className="h-4 w-4" /> Edit
            </Button>
            <Button size="sm" className="flex-1 sm:flex-none" onClick={() => navigate('/appointments?new=1')}>
              <CalendarPlus className="h-4 w-4" /> Book Appointment
            </Button>
            <div className="relative">
              <Button variant="outline" size="icon-sm" aria-label="More actions" onClick={() => setMenuOpen((o) => !o)}>
                <MoreVertical className="h-4 w-4" />
              </Button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 top-full z-20 mt-1 w-48 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-pop">
                    <button
                      onClick={copyId}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] font-medium text-slate-700 hover:bg-slate-50"
                    >
                      <Copy className="h-4 w-4 text-slate-400" /> Copy Patient ID
                    </button>
                    <button
                      onClick={() => { setMenuOpen(false); setDeleteOpen(true) }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] font-medium text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" /> Delete Patient
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </Card>

      <Tabs tabs={TABS} value={tab} onChange={setTab} className="mb-4" />

      {tab === 'overview' && <OverviewTab patient={patient} onGoTab={setTab} />}
      {tab === 'treatments' && (
        <RecordsTab resource="patient_treatments" singular="Treatment" plural="Treatments" patientCode={patient.code} />
      )}
      {tab === 'procedures' && (
        <RecordsTab resource="patient_procedures" singular="Procedure" plural="Procedures" patientCode={patient.code} />
      )}
      {tab === 'chart' && <DentalChartTab patientCode={patient.code} />}
      {tab === 'files' && <FilesTab patientCode={patient.code} />}
      {tab === 'invoices' && <InvoicesTab patientCode={patient.code} />}
      {tab === 'consents' && <ConsentsTab patientCode={patient.code} />}
      {tab === 'timeline' && <TimelineTab patientCode={patient.code} />}

      <PatientFormDialog open={editOpen} onClose={() => setEditOpen(false)} editing={patient} />

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() =>
          remove.mutate(patient.id, {
            onSuccess: () => navigate('/patients'),
          })
        }
        loading={remove.isPending}
        title="Delete this patient?"
        message={`${patient.name} (${patient.code}) and their profile record will be permanently removed. Related clinical records are kept.`}
        confirmLabel="Delete Patient"
      />
    </div>
  )
}
