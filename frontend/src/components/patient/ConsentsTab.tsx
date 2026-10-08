import { useEffect, useState, type FormEvent } from 'react'
import { FileSignature, Pencil, Plus, Trash2 } from 'lucide-react'
import { fmtDate, todayISO, useCreate, useDelete, useList, useUpdate, type Doc } from '@/lib/hooks'
import { StatusBadge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import { ConfirmDialog, Dialog } from '@/components/ui/Dialog'
import { Field, Input, Select, Textarea } from '@/components/ui/Field'
import { EmptyState, ListSkeleton } from '@/components/ui/bits'

const CONSENT_TITLES = [
  'General Treatment Consent',
  'Extraction Consent',
  'Implant Surgery Consent',
  'Orthodontic Consent',
  'Anaesthesia Consent',
  'Photography Consent',
]
const CONSENT_STATUSES = ['Pending', 'Signed', 'Declined']

interface ConsentForm {
  title: string
  date: string
  status: string
  notes: string
}

const emptyForm: ConsentForm = { title: CONSENT_TITLES[0], date: todayISO(), status: 'Pending', notes: '' }

export function ConsentsTab({ patientCode }: { patientCode: string }) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Doc | null>(null)
  const [deleting, setDeleting] = useState<Doc | null>(null)
  const [form, setForm] = useState<ConsentForm>(emptyForm)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const { data, isLoading } = useList('patient_consents', { patientId: patientCode, sort: 'date', order: 'desc', limit: 200 })
  const create = useCreate('patient_consents', { successMessage: 'Consent recorded' })
  const update = useUpdate('patient_consents', { successMessage: 'Consent updated' })
  const remove = useDelete('patient_consents', { successMessage: 'Consent deleted' })
  const consents = data?.items ?? []

  useEffect(() => {
    if (dialogOpen) {
      setErrors({})
      setForm(
        editing
          ? { title: editing.title || CONSENT_TITLES[0], date: editing.date || todayISO(), status: editing.status || 'Pending', notes: editing.notes || '' }
          : emptyForm,
      )
    }
  }, [dialogOpen, editing])

  const openAdd = () => { setEditing(null); setDialogOpen(true) }
  const openEdit = (c: Doc) => { setEditing(c); setDialogOpen(true) }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (!form.date) errs.date = 'Pick a date.'
    setErrors(errs)
    if (Object.keys(errs).length) return
    const payload = { patientId: patientCode, ...form, notes: form.notes.trim() }
    if (editing) {
      update.mutate({ id: editing.id, ...payload }, { onSuccess: () => setDialogOpen(false) })
    } else {
      create.mutate(payload as Partial<Doc>, { onSuccess: () => setDialogOpen(false) })
    }
  }

  return (
    <Card>
      <CardHeader
        title="Consent Forms"
        subtitle="Informed consent records linked to this patient"
        actions={
          <Button size="sm" onClick={openAdd}>
            <Plus className="h-4 w-4" /> New Consent
          </Button>
        }
      />
      {isLoading ? (
        <ListSkeleton rows={4} />
      ) : !consents.length ? (
        <EmptyState
          icon={<FileSignature className="h-6 w-6" />}
          title="No consent forms saved"
          message="Record treatment, extraction, implant and other consents here."
          action={
            <Button size="sm" onClick={openAdd}>
              <Plus className="h-4 w-4" /> New Consent
            </Button>
          }
        />
      ) : (
        <ul className="divide-y divide-slate-100">
          {consents.map((c) => (
            <li key={c.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                <FileSignature className="h-4.5 w-4.5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate text-sm font-semibold text-slate-800">{c.title}</span>
                  <StatusBadge status={c.status} />
                </div>
                <div className="mt-0.5 truncate text-xs text-slate-500">
                  {fmtDate(c.date)}{c.notes ? ` · ${c.notes}` : ''}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button variant="ghost" size="icon-sm" aria-label="Edit consent" onClick={() => openEdit(c)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon-sm" className="text-red-600 hover:bg-red-50" aria-label="Delete consent" onClick={() => setDeleting(c)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title={editing ? 'Edit Consent' : 'New Consent'}
        subtitle={`Patient ${patientCode}`}
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={submit as never} loading={create.isPending || update.isPending}>
              {editing ? 'Save Changes' : 'Save Consent'}
            </Button>
          </>
        }
      >
        <form onSubmit={submit} className="space-y-4">
          <Field label="Consent Type" required>
            <Select value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}>
              {CONSENT_TITLES.map((t) => <option key={t}>{t}</option>)}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Date" required error={errors.date}>
              <Input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
            </Field>
            <Field label="Status">
              <Select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
                {CONSENT_STATUSES.map((s) => <option key={s}>{s}</option>)}
              </Select>
            </Field>
          </div>
          <Field label="Notes">
            <Textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Witness, signing method, scope of consent…" className="min-h-[64px]" />
          </Field>
          <button type="submit" className="hidden" />
        </form>
      </Dialog>

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) remove.mutate(deleting.id, { onSuccess: () => setDeleting(null) })
        }}
        loading={remove.isPending}
        title="Delete this consent?"
        message={deleting ? `${deleting.title} · ${fmtDate(deleting.date)} will be permanently removed.` : ''}
      />
    </Card>
  )
}
