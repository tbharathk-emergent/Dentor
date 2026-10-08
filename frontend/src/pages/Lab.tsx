import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  Check,
  FlaskConical,
  IndianRupee,
  Pencil,
  Plus,
  ReceiptText,
  Wallet,
} from 'lucide-react'
import { toast } from 'sonner'
import { fmtDate, fmtINR, todayISO, useCreate, useList, useUpdate, type Doc } from '@/lib/hooks'
import { Badge, StatusBadge, type Tone } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { Dialog } from '@/components/ui/Dialog'
import { Field, Input, Select, Textarea } from '@/components/ui/Field'
import { Tabs } from '@/components/ui/Tabs'
import { EmptyState, ListSkeleton, PageHeader, SearchInput, StatCard } from '@/components/ui/bits'
import { PatientPicker } from '@/components/ops/PatientPicker'
import { cn } from '@/lib/cn'

const STAGES = ['Order Received', 'CAD Design', 'Milling', 'Quality Check', 'Dispatch', 'Delivered']
const CASE_TYPES = [
  'Zirconia Crown', 'Implant Crown', 'Bridge', 'Veneer', 'Complete Denture',
  'Partial Denture', 'Clear Retainer', 'Aligner', 'Night Guard', '3 Unit Bridge',
]
const MATERIALS = ['Multilayer Zirconia', 'Monolithic Zirconia', 'Lithium Disilicate', 'PFM', 'PMMA', 'Thermoplastic']
const SHADES = ['A1', 'A2', 'A3', 'A3.5', 'A4', 'B1', 'B2', 'B3', 'B4', 'C1', 'C2', 'C3', 'C4', 'D2', 'D3', 'D4', 'Bleach', 'Clear']
const DOCTORS = ['Dr. Kumar', 'Dr. Anitha', 'Dr. Gowtham']
const LABS = ['ZIREX Dental Lab', 'SmileCraft Lab', 'Precision Dental Studio', 'OrthoFab']
const TECHNICIANS = ['Unassigned', 'R. Prakash', 'M. Deepak', 'S. Naren', 'A. Sam', 'P. Vimal']
const PRIORITIES = ['Normal', 'High', 'Urgent']
const ORDER_STATUSES = ['Draft', 'In Progress', 'Ready', 'Delayed', 'Delivered']
const PAY_METHODS = ['Cash', 'UPI', 'Card', 'Bank Transfer', 'Cheque']
const ACCOUNTS = ['Cash in Hand', 'DENTOR Current Account', 'HDFC Bank', 'State Bank of India', 'UPI Collection Account']
const PAY_STATUSES = ['Cleared', 'Pending Confirmation', 'Post-dated']

const stageIdx = (stage: string | undefined) => Math.max(0, STAGES.indexOf(stage || STAGES[0]))
const stageProgress = (idx: number) => Math.round(((idx + 1) / 6) * 100)
const outstandingOf = (o: Doc) => Math.max(0, Number(o.amount || 0) - Number(o.paid || 0))

const priorityTone = (p: string | undefined): Tone =>
  p === 'Urgent' ? 'red' : p === 'High' ? 'amber' : 'slate'

function ProgressBar({ value, className }: { value: number; className?: string }) {
  return (
    <div className={cn('h-1.5 w-full overflow-hidden rounded-full bg-slate-200', className)}>
      <div
        className={cn('h-full rounded-full transition-all', value >= 100 ? 'bg-emerald-500' : 'bg-brand-600')}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* New / Edit order dialog                                            */
/* ------------------------------------------------------------------ */

interface OrderForm {
  patient: string
  patientCode: string
  caseType: string
  teeth: string
  shade: string
  material: string
  doctor: string
  lab: string
  technician: string
  received: string
  due: string
  priority: string
  status: string
  amount: string
  notes: string
}

const emptyOrder: OrderForm = {
  patient: '', patientCode: '', caseType: CASE_TYPES[0], teeth: '', shade: 'A2',
  material: MATERIALS[0], doctor: DOCTORS[0], lab: LABS[0], technician: 'Unassigned',
  received: todayISO(), due: '', priority: 'Normal', status: 'In Progress', amount: '8500', notes: '',
}

function OrderFormDialog({
  open,
  onClose,
  editing,
}: {
  open: boolean
  onClose: () => void
  editing?: Doc | null
}) {
  const [form, setForm] = useState<OrderForm>(emptyOrder)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const create = useCreate('lab_orders')
  const update = useUpdate('lab_orders', { successMessage: 'Lab order updated' })

  useEffect(() => {
    if (open) {
      setErrors({})
      setForm(
        editing
          ? {
              patient: editing.patient || '', patientCode: editing.patientCode || '',
              caseType: editing.caseType || CASE_TYPES[0], teeth: editing.teeth || '',
              shade: editing.shade || 'A2', material: editing.material || MATERIALS[0],
              doctor: editing.doctor || DOCTORS[0], lab: editing.lab || LABS[0],
              technician: editing.technician || 'Unassigned', received: editing.received || todayISO(),
              due: editing.due || '', priority: editing.priority || 'Normal',
              status: editing.status || 'In Progress', amount: String(editing.amount ?? ''),
              notes: editing.notes || '',
            }
          : emptyOrder,
      )
    }
  }, [open, editing])

  const set = (k: keyof OrderForm) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (!form.patient.trim()) errs.patient = 'Choose a patient for this lab case.'
    if (!form.teeth.trim()) errs.teeth = 'Enter the tooth / region (FDI number or arch).'
    if (!form.due) errs.due = 'Pick the required-by date.'
    if (form.amount === '' || Number(form.amount) < 0) errs.amount = 'Enter a valid lab cost.'
    setErrors(errs)
    if (Object.keys(errs).length) return

    if (editing) {
      // Stage is managed from the board / detail stepper; keep progress monotonic.
      const payload = { ...form, amount: Number(form.amount) }
      update.mutate({ id: editing.id, ...payload }, { onSuccess: onClose })
    } else {
      const payload = {
        ...form,
        amount: Number(form.amount),
        paid: 0,
        stage: STAGES[0],
        progress: stageProgress(0),
        notes: form.notes || 'Standard laboratory prescription.',
      }
      create.mutate(payload as Partial<Doc>, {
        onSuccess: (o) => {
          onClose()
          toast.success(`Lab order ${(o as Doc).code} submitted`)
        },
      })
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={editing ? 'Edit Lab Order' : 'New Lab Order'}
      subtitle={editing ? `${editing.code} · ${editing.patient}` : 'Create a complete digital laboratory prescription.'}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit as never} loading={create.isPending || update.isPending}>
            {editing ? 'Save Changes' : 'Submit Lab Order'}
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <PatientPicker
            required
            error={errors.patient}
            enabled={open}
            name={form.patient}
            code={form.patientCode}
            onSelect={(p) => setForm((f) => ({ ...f, patient: p.name, patientCode: p.code }))}
            onClear={() => setForm((f) => ({ ...f, patient: '', patientCode: '' }))}
          />
        </div>
        <Field label="Case Type" required>
          <Select value={form.caseType} onChange={set('caseType')}>
            {CASE_TYPES.map((c) => <option key={c}>{c}</option>)}
          </Select>
        </Field>
        <Field label="Tooth / Region" required error={errors.teeth}>
          <Input value={form.teeth} onChange={set('teeth')} placeholder="FDI number / arch, e.g. 46 or Full Arch" />
        </Field>
        <Field label="Shade">
          <Select value={form.shade} onChange={set('shade')}>
            {SHADES.map((s) => <option key={s}>{s}</option>)}
          </Select>
        </Field>
        <Field label="Material">
          <Select value={form.material} onChange={set('material')}>
            {MATERIALS.map((m) => <option key={m}>{m}</option>)}
          </Select>
        </Field>
        <Field label="Doctor">
          <Select value={form.doctor} onChange={set('doctor')}>
            {DOCTORS.map((d) => <option key={d}>{d}</option>)}
          </Select>
        </Field>
        <Field label="Laboratory">
          <Select value={form.lab} onChange={set('lab')}>
            {LABS.map((l) => <option key={l}>{l}</option>)}
          </Select>
        </Field>
        <Field label="Technician">
          <Select value={form.technician} onChange={set('technician')}>
            {TECHNICIANS.map((t) => <option key={t}>{t}</option>)}
          </Select>
        </Field>
        <Field label="Priority">
          <Select value={form.priority} onChange={set('priority')}>
            {PRIORITIES.map((p) => <option key={p}>{p}</option>)}
          </Select>
        </Field>
        <Field label="Received Date">
          <Input type="date" value={form.received} onChange={set('received')} />
        </Field>
        <Field label="Required By" required error={errors.due}>
          <Input type="date" value={form.due} onChange={set('due')} />
        </Field>
        <Field label="Status">
          <Select value={form.status} onChange={set('status')}>
            {ORDER_STATUSES.map((s) => <option key={s}>{s}</option>)}
          </Select>
        </Field>
        <Field label="Lab Cost (₹)" required error={errors.amount}>
          <Input type="number" min={0} value={form.amount} onChange={set('amount')} placeholder="8500" />
        </Field>
        <Field label="Design & Clinical Instructions" className="sm:col-span-2">
          <Textarea
            value={form.notes}
            onChange={set('notes')}
            placeholder="Margin, emergence profile, anatomy, staining, implant system, pontic design…"
            className="min-h-[64px]"
          />
        </Field>
        <button type="submit" className="hidden" />
      </form>
    </Dialog>
  )
}

/* ------------------------------------------------------------------ */
/* Record payment dialog                                              */
/* ------------------------------------------------------------------ */

function PaymentDialog({
  open,
  onClose,
  order,
}: {
  open: boolean
  onClose: () => void
  order: Doc | null
}) {
  const [form, setForm] = useState({
    date: todayISO(), amount: '', adjustment: '0', tds: '0', method: 'Cash',
    account: ACCOUNTS[0], reference: '', status: 'Cleared', notes: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const createPayment = useCreate('lab_payments', { invalidate: ['lab_orders'] })
  const updateOrder = useUpdate('lab_orders')

  useEffect(() => {
    if (open) {
      setErrors({})
      setForm({
        date: todayISO(), amount: '', adjustment: '0', tds: '0', method: 'Cash',
        account: ACCOUNTS[0], reference: '', status: 'Cleared', notes: '',
      })
    }
  }, [open])

  if (!order) return null
  const outstanding = outstandingOf(order)
  const amount = Number(form.amount || 0)
  const adjustment = Number(form.adjustment || 0)
  const tds = Number(form.tds || 0)
  const allocated = amount + adjustment + tds

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (!amount || amount <= 0) errs.amount = 'Enter the payment amount.'
    else if (amount > outstanding) errs.amount = `Amount cannot exceed the outstanding ${fmtINR(outstanding)}.`
    if (adjustment < 0) errs.adjustment = 'Adjustment cannot be negative.'
    if (tds < 0) errs.tds = 'TDS cannot be negative.'
    if (!errs.amount && !errs.adjustment && !errs.tds && allocated > outstanding)
      errs.adjustment = `Amount + adjustment + TDS (${fmtINR(allocated)}) exceeds the outstanding ${fmtINR(outstanding)}.`
    if (form.method !== 'Cash' && !form.reference.trim())
      errs.reference = 'Enter the transaction, UTR or cheque reference for non-cash payments.'
    setErrors(errs)
    if (Object.keys(errs).length) return

    const payload = {
      date: form.date,
      order: order.code,
      orderId: order.id,
      patient: order.patient,
      lab: order.lab,
      method: form.method,
      account: form.account,
      reference: form.reference.trim() || 'Cash',
      amount,
      adjustment,
      tds,
      status: form.status,
      notes: form.notes,
      enteredBy: 'Dr. Admin',
    }
    createPayment.mutate(payload as Partial<Doc>, {
      onSuccess: () => {
        const finish = () => {
          toast.success(`Payment of ${fmtINR(amount)} recorded for ${order.code}`)
          onClose()
        }
        if (form.status === 'Cleared') {
          updateOrder.mutate(
            { id: order.id, paid: Number(order.paid || 0) + amount + adjustment },
            { onSuccess: finish },
          )
        } else finish()
      },
    })
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Record Lab Payment"
      subtitle={`${order.code} · ${order.lab} · Outstanding ${fmtINR(outstanding)}`}
      size="md"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit as never} loading={createPayment.isPending || updateOrder.isPending}>
            <Wallet className="h-4 w-4" /> Record Payment
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="grid grid-cols-3 gap-2 sm:col-span-2">
          {[
            { label: 'Order value', value: fmtINR(order.amount) },
            { label: 'Paid so far', value: fmtINR(order.paid) },
            { label: 'Outstanding', value: fmtINR(outstanding), red: true },
          ].map((t) => (
            <div key={t.label} className="rounded-lg bg-slate-50 px-3 py-2">
              <div className="text-[10px] font-medium uppercase tracking-wide text-slate-400">{t.label}</div>
              <div className={cn('text-sm font-bold', t.red ? 'text-red-600' : 'text-slate-800')}>{t.value}</div>
            </div>
          ))}
        </div>
        <Field label="Payment Date" required>
          <Input type="date" value={form.date} onChange={set('date')} />
        </Field>
        <Field label="Amount (₹)" required error={errors.amount}>
          <Input type="number" min={1} max={outstanding} value={form.amount} onChange={set('amount')} placeholder={String(outstanding)} autoFocus />
        </Field>
        <Field label="Adjustment / Discount (₹)" error={errors.adjustment}>
          <Input type="number" min={0} value={form.adjustment} onChange={set('adjustment')} />
        </Field>
        <Field label="TDS Deducted (₹)" error={errors.tds}>
          <Input type="number" min={0} value={form.tds} onChange={set('tds')} />
        </Field>
        <Field label="Method">
          <Select value={form.method} onChange={set('method')}>
            {PAY_METHODS.map((m) => <option key={m}>{m}</option>)}
          </Select>
        </Field>
        <Field label="Bank / Account">
          <Select value={form.account} onChange={set('account')}>
            {ACCOUNTS.map((a) => <option key={a}>{a}</option>)}
          </Select>
        </Field>
        <Field
          label="Transaction / UTR / Cheque No."
          required={form.method !== 'Cash'}
          error={errors.reference}
          className={form.method === 'Cash' ? 'sm:col-span-2' : ''}
        >
          <Input value={form.reference} onChange={set('reference')} placeholder={form.method === 'Cash' ? 'Optional for cash' : 'Required for non-cash payment'} />
        </Field>
        {form.method !== 'Cash' && (
          <Field label="Payment Status">
            <Select value={form.status} onChange={set('status')}>
              {PAY_STATUSES.map((s) => <option key={s}>{s}</option>)}
            </Select>
          </Field>
        )}
        {form.method === 'Cash' && (
          <Field label="Payment Status" className="sm:col-span-2">
            <Select value={form.status} onChange={set('status')}>
              {PAY_STATUSES.map((s) => <option key={s}>{s}</option>)}
            </Select>
          </Field>
        )}
        <Field label="Narration" className="sm:col-span-2" hint="Only cleared payments update the order balance.">
          <Textarea value={form.notes} onChange={set('notes')} className="min-h-[42px]" placeholder="Against laboratory order, adjustments or approval notes" />
        </Field>
        <button type="submit" className="hidden" />
      </form>
    </Dialog>
  )
}

/* ------------------------------------------------------------------ */
/* Order detail dialog                                                */
/* ------------------------------------------------------------------ */

function OrderDetailDialog({
  order,
  onClose,
  onEdit,
  onRecordPayment,
}: {
  order: Doc | null
  onClose: () => void
  onEdit: (o: Doc) => void
  onRecordPayment: (o: Doc) => void
}) {
  const update = useUpdate('lab_orders', { successMessage: 'Lab workflow updated' })
  const { data: paymentData, isLoading: paymentsLoading } = useList(
    'lab_payments',
    { orderId: order?.id ?? '', limit: 100 },
    { enabled: !!order },
  )
  const payments = paymentData?.items ?? []

  if (!order) return null
  const idx = stageIdx(order.stage)
  const outstanding = outstandingOf(order)

  const setStage = (i: number) => {
    const payload: Partial<Doc> & { id: string } = {
      id: order.id,
      stage: STAGES[i],
      progress: Math.max(Number(order.progress || 0), stageProgress(i)),
    }
    if (STAGES[i] === 'Delivered') payload.status = 'Delivered'
    update.mutate(payload)
  }

  const info: [string, string][] = [
    ['Patient', `${order.patient || '—'} · ${order.patientCode || '—'}`],
    ['Case', `${order.caseType || '—'} · ${order.teeth || '—'}`],
    ['Shade / Material', `${order.shade || '—'} · ${order.material || '—'}`],
    ['Doctor', order.doctor || '—'],
    ['Laboratory', order.lab || '—'],
    ['Technician', order.technician || '—'],
    ['Received', fmtDate(order.received)],
    ['Due', fmtDate(order.due)],
    ['Priority', order.priority || 'Normal'],
  ]

  return (
    <Dialog
      open={!!order}
      onClose={onClose}
      title={`${order.code} · ${order.caseType}`}
      subtitle={`${order.patient} · Due ${fmtDate(order.due)}`}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button variant="secondary" onClick={() => onEdit(order)}>
            <Pencil className="h-4 w-4" /> Edit Order
          </Button>
          <Button onClick={() => onRecordPayment(order)} disabled={outstanding <= 0}>
            <Wallet className="h-4 w-4" /> Record Payment
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={order.status} />
          <Badge tone={priorityTone(order.priority)}>{order.priority || 'Normal'}</Badge>
          <span className="ml-auto text-xs text-slate-500">Progress {order.progress ?? stageProgress(idx)}%</span>
        </div>
        <ProgressBar value={Number(order.progress ?? stageProgress(idx))} />

        {/* Stage stepper */}
        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Production Stage</h4>
          <ol className="space-y-1.5">
            {STAGES.map((s, i) => {
              const done = i < idx
              const current = i === idx
              return (
                <li key={s}>
                  <button
                    type="button"
                    disabled={update.isPending}
                    onClick={() => i !== idx && setStage(i)}
                    className={cn(
                      'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-sm transition',
                      current ? 'bg-brand-50 font-semibold text-brand-800' : 'text-slate-600 hover:bg-slate-50',
                    )}
                  >
                    <span
                      className={cn(
                        'flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold',
                        done ? 'bg-emerald-100 text-emerald-700' : current ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-400',
                      )}
                    >
                      {done ? <Check className="h-3 w-3" /> : i + 1}
                    </span>
                    {s}
                    {current && <span className="ml-auto text-[11px] font-medium text-brand-600">Current</span>}
                  </button>
                </li>
              )
            })}
          </ol>
          <p className="mt-1.5 text-xs text-slate-400">Tap a stage to update the workflow. Progress never moves backwards.</p>
        </div>

        {/* Details */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {info.map(([label, value]) => (
            <div key={label} className="rounded-lg bg-slate-50 px-2.5 py-2">
              <div className="text-[10px] font-medium uppercase tracking-wide text-slate-400">{label}</div>
              <div className="truncate text-[13px] font-semibold text-slate-800">{value}</div>
            </div>
          ))}
        </div>
        {order.notes && (
          <div className="rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2.5 text-[13px] text-slate-600">
            <span className="font-semibold text-slate-700">Lab instructions: </span>{order.notes}
          </div>
        )}

        {/* Financials */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Lab cost', value: fmtINR(order.amount) },
            { label: 'Paid', value: fmtINR(order.paid), green: true },
            { label: 'Balance', value: fmtINR(outstanding), red: outstanding > 0 },
          ].map((t) => (
            <div key={t.label} className="rounded-lg bg-slate-50 px-2.5 py-2">
              <div className="text-[10px] font-medium uppercase tracking-wide text-slate-400">{t.label}</div>
              <div className={cn('text-sm font-bold', t.green ? 'text-emerald-600' : t.red ? 'text-red-600' : 'text-slate-800')}>
                {t.value}
              </div>
            </div>
          ))}
        </div>

        {/* Payments */}
        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Payment History</h4>
          {paymentsLoading ? (
            <ListSkeleton rows={2} />
          ) : !payments.length ? (
            <p className="rounded-lg bg-slate-50 px-3 py-3 text-center text-[13px] text-slate-400">
              No payments recorded for this order yet.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100 rounded-lg border border-slate-100">
              {payments.map((p) => (
                <li key={p.id} className="flex items-center gap-3 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-semibold text-slate-800">{p.receipt}</div>
                    <div className="truncate text-xs text-slate-500">
                      {fmtDate(p.date)} · {p.method} · {p.account}
                    </div>
                  </div>
                  <span className="text-sm font-bold text-slate-800">{fmtINR(p.amount)}</span>
                  <StatusBadge status={p.status} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Dialog>
  )
}

/* ------------------------------------------------------------------ */
/* Page                                                               */
/* ------------------------------------------------------------------ */

export default function Lab() {
  const [tab, setTab] = useState<'board' | 'list' | 'payments'>('board')
  const [q, setQ] = useState('')
  const [stageFilter, setStageFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Doc | null>(null)
  const [detail, setDetail] = useState<Doc | null>(null)
  const [payTarget, setPayTarget] = useState<Doc | null>(null)

  const { data, isLoading } = useList('lab_orders', { q, sort: 'created_at', order: 'desc', limit: 500 })
  const orders = data?.items ?? []
  const { data: payData, isLoading: payLoading } = useList(
    'lab_payments',
    { sort: 'created_at', order: 'desc', limit: 500 },
    { enabled: tab === 'payments' },
  )
  const payments = payData?.items ?? []
  const update = useUpdate('lab_orders')

  // Keep open dialogs in sync with fresh query data.
  const liveDetail = useMemo(
    () => (detail ? orders.find((o) => o.id === detail.id) ?? detail : null),
    [detail, orders],
  )
  const livePayTarget = useMemo(
    () => (payTarget ? orders.find((o) => o.id === payTarget.id) ?? payTarget : null),
    [payTarget, orders],
  )

  const kpis = useMemo(() => {
    const today = todayISO()
    const weekEnd = new Date()
    weekEnd.setDate(weekEnd.getDate() + 7)
    const weekEndISO = weekEnd.toISOString().slice(0, 10)
    const active = orders.filter((o) => o.stage !== 'Delivered' && o.status !== 'Delivered').length
    const dueWeek = orders.filter(
      (o) => o.stage !== 'Delivered' && o.due && o.due >= today && o.due <= weekEndISO,
    ).length
    const delayed = orders.filter((o) => o.status === 'Delayed').length
    const outstanding = orders.reduce((s, o) => s + outstandingOf(o), 0)
    return { active, dueWeek, delayed, outstanding }
  }, [orders])

  const filtered = useMemo(
    () =>
      orders.filter(
        (o) =>
          (!stageFilter || o.stage === stageFilter) &&
          (!statusFilter || o.status === statusFilter) &&
          (!priorityFilter || o.priority === priorityFilter),
      ),
    [orders, stageFilter, statusFilter, priorityFilter],
  )

  const advance = (o: Doc) => {
    const idx = stageIdx(o.stage)
    if (idx >= STAGES.length - 1) return
    const next = idx + 1
    const payload: Partial<Doc> & { id: string } = {
      id: o.id,
      stage: STAGES[next],
      progress: Math.max(Number(o.progress || 0), stageProgress(next)),
    }
    if (STAGES[next] === 'Delivered') payload.status = 'Delivered'
    update.mutate(payload, { onSuccess: () => toast.success(`${o.code} moved to ${STAGES[next]}`) })
  }

  const openEdit = (o: Doc) => {
    setDetail(null)
    setEditing(o)
    setFormOpen(true)
  }

  const orderColumns: Column<Doc>[] = [
    {
      key: 'order',
      header: 'Order',
      cell: (o) => (
        <div>
          <div className="font-semibold text-brand-700">{o.code}</div>
          <div className="text-xs text-slate-400">Recd {fmtDate(o.received)}</div>
        </div>
      ),
    },
    {
      key: 'patient',
      header: 'Patient',
      cell: (o) => (
        <div>
          <div className="font-medium text-slate-800">{o.patient}</div>
          <div className="text-xs text-slate-500">{o.patientCode}</div>
        </div>
      ),
    },
    {
      key: 'case',
      header: 'Case',
      cell: (o) => (
        <div>
          <div className="text-slate-800">{o.caseType}</div>
          <div className="text-xs text-slate-500">{o.teeth} · Shade {o.shade}</div>
        </div>
      ),
    },
    {
      key: 'lab',
      header: 'Lab',
      cell: (o) => (
        <div>
          <div className="text-slate-700">{o.lab}</div>
          <div className="text-xs text-slate-500">{o.technician}</div>
        </div>
      ),
    },
    { key: 'due', header: 'Due', cell: (o) => <span className="whitespace-nowrap text-slate-700">{fmtDate(o.due)}</span> },
    {
      key: 'stage',
      header: 'Stage',
      cell: (o) => (
        <div className="min-w-[110px]">
          <div className="mb-1 text-xs font-medium text-slate-600">{o.stage}</div>
          <ProgressBar value={Number(o.progress ?? stageProgress(stageIdx(o.stage)))} />
        </div>
      ),
    },
    { key: 'status', header: 'Status', cell: (o) => <StatusBadge status={o.status} /> },
    { key: 'priority', header: 'Priority', cell: (o) => <Badge tone={priorityTone(o.priority)}>{o.priority || 'Normal'}</Badge> },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right',
      cell: (o) => (
        <div className="text-right">
          <div className="font-semibold text-slate-800">{fmtINR(o.amount)}</div>
          <div className={cn('text-xs', outstandingOf(o) > 0 ? 'text-red-500' : 'text-emerald-600')}>
            {outstandingOf(o) > 0 ? `Due ${fmtINR(outstandingOf(o))}` : 'Settled'}
          </div>
        </div>
      ),
    },
  ]

  const paymentColumns: Column<Doc>[] = [
    { key: 'receipt', header: 'Receipt', cell: (p) => <span className="font-semibold text-brand-700">{p.receipt}</span> },
    { key: 'date', header: 'Date', cell: (p) => <span className="whitespace-nowrap">{fmtDate(p.date)}</span> },
    {
      key: 'order',
      header: 'Order',
      cell: (p) => (
        <div>
          <div className="font-medium text-slate-800">{p.order}</div>
          <div className="text-xs text-slate-500">{p.patient}</div>
        </div>
      ),
    },
    { key: 'lab', header: 'Lab', cell: (p) => <span className="text-slate-700">{p.lab}</span> },
    { key: 'method', header: 'Method', cell: (p) => <span className="text-slate-700">{p.method}</span> },
    { key: 'amount', header: 'Amount', align: 'right', cell: (p) => <span className="font-semibold">{fmtINR(p.amount)}</span> },
    { key: 'status', header: 'Status', cell: (p) => <StatusBadge status={p.status} /> },
  ]

  const boardCard = (o: Doc) => {
    const idx = stageIdx(o.stage)
    return (
      <Card
        key={o.id}
        onClick={() => setDetail(o)}
        className="cursor-pointer p-3 transition hover:border-brand-300 hover:shadow-md"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate text-[13px] font-bold text-slate-900">{o.code}</div>
            <div className="truncate text-xs text-slate-500">{o.patient}</div>
          </div>
          <Badge tone={priorityTone(o.priority)}>{o.priority || 'Normal'}</Badge>
        </div>
        <div className="mt-2 truncate text-xs text-slate-600">
          {o.caseType} · {o.teeth} · {o.shade}
        </div>
        <div className="mt-0.5 truncate text-[11px] text-slate-400">{o.lab} · Due {fmtDate(o.due)}</div>
        <ProgressBar value={Number(o.progress ?? stageProgress(idx))} className="mt-2.5" />
        {idx < STAGES.length - 1 && (
          <Button
            size="sm"
            variant="secondary"
            className="mt-2.5 w-full"
            loading={update.isPending && update.variables?.id === o.id}
            onClick={(e) => { e.stopPropagation(); advance(o) }}
          >
            {STAGES[idx + 1]} <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        )}
      </Card>
    )
  }

  return (
    <div>
      <PageHeader
        title="Lab Orders"
        subtitle="Digital case submission, production tracking and lab payments"
        actions={
          <Button onClick={() => { setEditing(null); setFormOpen(true) }}>
            <Plus className="h-4 w-4" /> New Lab Order
          </Button>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
        <StatCard label="Active orders" value={kpis.active} icon={<FlaskConical className="h-5 w-5" />} />
        <StatCard label="Due this week" value={kpis.dueWeek} icon={<CalendarClock className="h-5 w-5" />} accent="amber" />
        <StatCard label="Delayed" value={kpis.delayed} icon={<AlertTriangle className="h-5 w-5" />} accent="red" />
        <StatCard label="Outstanding" value={fmtINR(kpis.outstanding)} icon={<IndianRupee className="h-5 w-5" />} accent="blue" />
      </div>

      <Tabs
        className="mb-4"
        value={tab}
        onChange={(k) => setTab(k as typeof tab)}
        tabs={[
          { key: 'board', label: 'Board' },
          { key: 'list', label: 'Orders', count: orders.length },
          { key: 'payments', label: 'Payments' },
        ]}
      />

      {tab !== 'payments' && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <SearchInput value={q} onChange={setQ} placeholder="Search order, patient, case or lab…" className="w-full sm:w-auto sm:min-w-0 sm:max-w-sm sm:flex-1" />
          {tab === 'list' && (
            <>
              <Select value={stageFilter} onChange={(e) => setStageFilter(e.target.value)} className="flex-1 sm:w-40 sm:flex-none">
                <option value="">All Stages</option>
                {STAGES.map((s) => <option key={s}>{s}</option>)}
              </Select>
              <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="flex-1 sm:w-36 sm:flex-none">
                <option value="">All Status</option>
                {ORDER_STATUSES.map((s) => <option key={s}>{s}</option>)}
              </Select>
              <Select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} className="flex-1 sm:w-32 sm:flex-none">
                <option value="">All Priority</option>
                {PRIORITIES.map((p) => <option key={p}>{p}</option>)}
              </Select>
            </>
          )}
        </div>
      )}

      {tab === 'board' &&
        (isLoading ? (
          <ListSkeleton rows={6} />
        ) : !orders.length ? (
          <Card>
            <EmptyState
              icon={<FlaskConical className="h-6 w-6" />}
              title={q ? 'No lab orders match your search' : 'No lab orders yet'}
              message={q ? 'Try a different order, patient or lab.' : 'Submit your first digital lab prescription to get started.'}
              action={
                <Button size="sm" onClick={() => { setEditing(null); setFormOpen(true) }}>
                  <Plus className="h-4 w-4" /> New Lab Order
                </Button>
              }
            />
          </Card>
        ) : (
          <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
            {STAGES.map((stage) => {
              const col = orders.filter((o) => o.stage === stage)
              return (
                <div key={stage} className="w-60 shrink-0 rounded-xl bg-slate-100/70 p-2.5 sm:w-64">
                  <div className="mb-2 flex items-center justify-between px-1">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">{stage}</span>
                    <span className="rounded-full bg-white px-1.5 py-0.5 text-[11px] font-semibold text-slate-500">{col.length}</span>
                  </div>
                  <div className="space-y-2.5">
                    {col.length ? col.map(boardCard) : (
                      <p className="rounded-lg border border-dashed border-slate-200 px-2 py-5 text-center text-xs text-slate-400">No cases</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ))}

      {tab === 'list' && (
        <Card>
          <DataTable
            rows={filtered}
            columns={orderColumns}
            rowKey={(o) => o.id}
            loading={isLoading}
            onRowClick={(o) => setDetail(o)}
            empty={
              <EmptyState
                icon={<FlaskConical className="h-6 w-6" />}
                title="No lab orders found"
                message={q || stageFilter || statusFilter || priorityFilter ? 'Adjust the filters to see more orders.' : 'Submit your first lab order to get started.'}
              />
            }
            mobileCard={(o) => (
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-bold text-slate-900">{o.code}</span>
                  <StatusBadge status={o.status} />
                </div>
                <div className="mt-0.5 truncate text-[13px] text-slate-700">{o.patient} · {o.caseType} · {o.teeth}</div>
                <div className="mt-0.5 truncate text-xs text-slate-500">{o.lab} · Due {fmtDate(o.due)}</div>
                <div className="mt-2 flex items-center gap-2">
                  <ProgressBar value={Number(o.progress ?? stageProgress(stageIdx(o.stage)))} className="flex-1" />
                  <span className="text-xs font-semibold text-slate-700">{fmtINR(o.amount)}</span>
                  {outstandingOf(o) > 0 && <span className="text-xs text-red-500">Due {fmtINR(outstandingOf(o))}</span>}
                </div>
              </div>
            )}
          />
        </Card>
      )}

      {tab === 'payments' && (
        <Card>
          <DataTable
            rows={payments}
            columns={paymentColumns}
            rowKey={(p) => p.id}
            loading={payLoading}
            empty={
              <EmptyState
                icon={<ReceiptText className="h-6 w-6" />}
                title="No lab payments recorded yet"
                message="Open a lab order and use Record Payment to settle laboratory bills."
              />
            }
            mobileCard={(p) => (
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-bold text-slate-900">{p.receipt}</span>
                  <span className="text-sm font-bold text-slate-800">{fmtINR(p.amount)}</span>
                </div>
                <div className="mt-0.5 truncate text-xs text-slate-500">
                  {fmtDate(p.date)} · {p.order} · {p.lab}
                </div>
                <div className="mt-1.5 flex items-center gap-2">
                  <span className="text-xs text-slate-500">{p.method}</span>
                  <StatusBadge status={p.status} />
                </div>
              </div>
            )}
          />
        </Card>
      )}

      <OrderFormDialog open={formOpen} onClose={() => setFormOpen(false)} editing={editing} />
      <OrderDetailDialog
        order={liveDetail}
        onClose={() => setDetail(null)}
        onEdit={openEdit}
        onRecordPayment={(o) => setPayTarget(o)}
      />
      <PaymentDialog open={!!payTarget} onClose={() => setPayTarget(null)} order={livePayTarget} />
    </div>
  )
}
