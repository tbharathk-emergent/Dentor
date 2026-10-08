import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  FileText,
  IndianRupee,
  Plus,
  Printer,
  Receipt,
  Trash2,
  Wallet,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { fmtDate, fmtINR, todayISO, useCreate, useDelete, useList, type Doc } from '@/lib/hooks'
import { StatusBadge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ConfirmDialog, Dialog } from '@/components/ui/Dialog'
import { Field, Input, Select, Textarea } from '@/components/ui/Field'
import { Tabs } from '@/components/ui/Tabs'
import { Avatar, EmptyState, ListSkeleton, PageHeader, SearchInput, StatCard } from '@/components/ui/bits'

const PAY_MODES = ['Cash', 'UPI', 'Card', 'Bank Transfer', 'Cheque']
const DOCTORS = ['Dr. Kumar', 'Dr. Anitha', 'Dr. Gowtham']

interface Line {
  name: string
  qty: number
  price: number
  tax: number
}

/* ---------- Patient picker (shared inside this module) ---------- */
function PatientPicker({
  value,
  onPick,
  onClear,
  error,
}: {
  value: { name: string; code: string } | null
  onPick: (p: Doc) => void
  onClear: () => void
  error?: string
}) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const { data } = useList('patients', { q, limit: 8 })
  return (
    <Field label="Patient" required error={error}>
      {value ? (
        <div className="flex items-center gap-3 rounded-lg border border-brand-200 bg-brand-50/60 px-3 py-2">
          <Avatar name={value.name} className="h-8 w-8" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-slate-800">{value.name}</div>
            <div className="text-xs text-slate-500">{value.code}</div>
          </div>
          <Button variant="ghost" size="icon-sm" type="button" onClick={onClear} aria-label="Clear patient">
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div className="relative">
          <Input
            value={q}
            onChange={(e) => { setQ(e.target.value); setOpen(true) }}
            onFocus={() => setOpen(true)}
            placeholder="Search by name, ID or mobile…"
          />
          {open && (data?.items?.length ?? 0) > 0 && (
            <div className="absolute inset-x-0 top-full z-10 mt-1 max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-pop">
              {data!.items.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => { onPick(p); setOpen(false); setQ('') }}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-brand-50"
                >
                  <Avatar name={p.name} className="h-7 w-7 text-[11px]" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-slate-800">{p.name}</span>
                    <span className="block text-xs text-slate-500">{p.code} · {p.mobile}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </Field>
  )
}

/* ---------- New Invoice dialog ---------- */
function InvoiceDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [patient, setPatient] = useState<Doc | null>(null)
  const [doctor, setDoctor] = useState(DOCTORS[0])
  const [date, setDate] = useState(todayISO())
  const [lines, setLines] = useState<Line[]>([{ name: '', qty: 1, price: 0, tax: 0 }])
  const [discount, setDiscount] = useState(0)
  const [notes, setNotes] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const { data: treatments } = useList('treatment_masters', { limit: 100 }, { enabled: open })
  const create = useCreate('invoices', { invalidate: ['dashboard', 'accounts-summary'] })

  useEffect(() => {
    if (open) {
      setPatient(null); setDoctor(DOCTORS[0]); setDate(todayISO())
      setLines([{ name: '', qty: 1, price: 0, tax: 0 }]); setDiscount(0); setNotes(''); setErrors({})
    }
  }, [open])

  const subtotal = lines.reduce((s, l) => s + l.qty * l.price, 0)
  const tax = lines.reduce((s, l) => s + (l.qty * l.price * l.tax) / 100, 0)
  const total = Math.max(0, Math.round(subtotal + tax - discount))

  const setLine = (i: number, patch: Partial<Line>) =>
    setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)))

  const pickTreatment = (i: number, name: string) => {
    const t = (treatments?.items ?? []).find((t) => t.name === name)
    setLine(i, { name, ...(t ? { price: Number(t.price) || 0, tax: Number(t.tax) || 0 } : {}) })
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (!patient) errs.patient = 'Choose the patient being billed.'
    const validLines = lines.filter((l) => l.name.trim() && l.price > 0)
    if (!validLines.length) errs.lines = 'Add at least one treatment line with a price.'
    setErrors(errs)
    if (Object.keys(errs).length) return
    create.mutate(
      {
        date,
        patient: patient!.name,
        patientCode: patient!.code,
        doctor,
        source: 'Clinic',
        treatment: validLines.map((l) => l.name).join(', '),
        items: validLines,
        subtotal: Math.round(subtotal),
        tax: Math.round(tax),
        discount,
        total,
        paid: 0,
        balance: total,
        status: 'Pending',
        notes,
      } as Partial<Doc>,
      {
        onSuccess: (inv) => {
          toast.success(`Invoice ${(inv as Doc).number} created · ${fmtINR(total)}`)
          onClose()
        },
      },
    )
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="New Invoice"
      subtitle="Bill treatments and procedures"
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit as never} loading={create.isPending}>
            Create Invoice · {fmtINR(total)}
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <PatientPicker
              value={patient ? { name: patient.name, code: patient.code } : null}
              onPick={setPatient}
              onClear={() => setPatient(null)}
              error={errors.patient}
            />
          </div>
          <Field label="Date">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
        </div>
        <Field label="Doctor">
          <Select value={doctor} onChange={(e) => setDoctor(e.target.value)} className="sm:max-w-xs">
            {DOCTORS.map((d) => <option key={d}>{d}</option>)}
          </Select>
        </Field>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[13px] font-medium text-slate-700">Treatment lines <span className="text-red-500">*</span></span>
            <Button type="button" size="sm" variant="ghost" onClick={() => setLines((ls) => [...ls, { name: '', qty: 1, price: 0, tax: 0 }])}>
              <Plus className="h-3.5 w-3.5" /> Add line
            </Button>
          </div>
          {errors.lines && <p className="mb-2 text-xs text-red-600">{errors.lines}</p>}
          <div className="space-y-2">
            {lines.map((l, i) => (
              <div key={i} className="grid grid-cols-[1fr_64px_96px_64px_36px] items-center gap-2">
                <Input
                  list="inv-treatments"
                  value={l.name}
                  onChange={(e) => pickTreatment(i, e.target.value)}
                  placeholder="Treatment or procedure"
                />
                <Input type="number" min={1} value={l.qty} onChange={(e) => setLine(i, { qty: Math.max(1, Number(e.target.value)) })} aria-label="Qty" />
                <Input type="number" min={0} value={l.price || ''} onChange={(e) => setLine(i, { price: Number(e.target.value) })} placeholder="Price" aria-label="Price" />
                <Input type="number" min={0} max={28} value={l.tax || ''} onChange={(e) => setLine(i, { tax: Number(e.target.value) })} placeholder="GST%" aria-label="GST %" />
                <Button type="button" variant="ghost" size="icon-sm" className="text-slate-400 hover:text-red-600" onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))} disabled={lines.length === 1} aria-label="Remove line">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
          <datalist id="inv-treatments">
            {(treatments?.items ?? []).map((t) => <option key={t.id} value={t.name} />)}
          </datalist>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Discount (₹)">
            <Input type="number" min={0} value={discount || ''} onChange={(e) => setDiscount(Number(e.target.value))} placeholder="0" />
          </Field>
          <Field label="Notes">
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-[42px]" placeholder="Optional" />
          </Field>
        </div>

        <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm">
          <div className="flex justify-between text-slate-600"><span>Subtotal</span><span>{fmtINR(subtotal)}</span></div>
          <div className="flex justify-between text-slate-600"><span>GST</span><span>{fmtINR(Math.round(tax))}</span></div>
          <div className="flex justify-between text-slate-600"><span>Discount</span><span>− {fmtINR(discount)}</span></div>
          <div className="mt-1.5 flex justify-between border-t border-slate-200 pt-1.5 text-base font-bold text-slate-900">
            <span>Total</span><span>{fmtINR(total)}</span>
          </div>
        </div>
        <button type="submit" className="hidden" />
      </form>
    </Dialog>
  )
}

/* ---------- Record Payment dialog ---------- */
function PaymentDialog({
  open,
  onClose,
  invoice,
}: {
  open: boolean
  onClose: () => void
  invoice?: Doc | null
}) {
  const qc = useQueryClient()
  const [patient, setPatient] = useState<Doc | null>(null)
  const [amount, setAmount] = useState('')
  const [mode, setMode] = useState('Cash')
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setPatient(null)
      setAmount(invoice ? String(invoice.balance ?? '') : '')
      setMode('Cash'); setReference(''); setNotes(''); setSaving(false)
    }
  }, [open, invoice])

  const balance = invoice ? Number(invoice.balance ?? 0) : undefined

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const amt = Number(amount)
    if (!amt || amt <= 0) return toast.error('Enter a valid payment amount.')
    if (balance !== undefined && amt > balance) return toast.error(`Amount exceeds the invoice balance of ${fmtINR(balance)}.`)
    if (!invoice && !patient) return toast.error('Choose the patient for this payment.')
    if (mode !== 'Cash' && !reference.trim()) return toast.error(`Enter the ${mode} reference number.`)
    setSaving(true)
    try {
      await api.post('/api/payments/record', {
        invoice_id: invoice?.id ?? null,
        patient: invoice?.patient ?? patient!.name,
        patientCode: invoice?.patientCode ?? patient!.code,
        amount: amt,
        mode,
        reference,
        date: todayISO(),
        notes,
      })
      toast.success(`${fmtINR(amt)} received${invoice ? ` against ${invoice.number}` : ''}`)
      qc.invalidateQueries({ queryKey: ['invoices'] })
      qc.invalidateQueries({ queryKey: ['payments'] })
      qc.invalidateQueries({ queryKey: ['accounts-summary'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Payment failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Record Payment"
      subtitle={invoice ? `${invoice.number} · ${invoice.patient} · Balance ${fmtINR(invoice.balance)}` : 'On-account payment'}
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit as never} loading={saving}>Save Payment</Button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        {!invoice && (
          <PatientPicker
            value={patient ? { name: patient.name, code: patient.code } : null}
            onPick={setPatient}
            onClear={() => setPatient(null)}
          />
        )}
        <Field label="Amount (₹)" required hint={balance !== undefined ? `Outstanding: ${fmtINR(balance)}` : undefined}>
          <Input type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Mode">
            <Select value={mode} onChange={(e) => setMode(e.target.value)}>
              {PAY_MODES.map((m) => <option key={m}>{m}</option>)}
            </Select>
          </Field>
          <Field label="Reference" required={mode !== 'Cash'}>
            <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder={mode === 'Cash' ? 'Optional' : 'UTR / Txn no.'} />
          </Field>
        </div>
        <Field label="Notes">
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
        </Field>
        <button type="submit" className="hidden" />
      </form>
    </Dialog>
  )
}

/* ---------- Invoice view / print ---------- */
function InvoiceView({ invoice, onClose, onPay }: { invoice: Doc | null; onClose: () => void; onPay: () => void }) {
  if (!invoice) return null
  const print = () => {
    const w = window.open('', '_blank', 'width=720,height=900')
    if (!w) return
    const rows = (invoice.items ?? [{ name: invoice.treatment, qty: 1, price: invoice.total, tax: 0 }])
      .map((l: Line) => `<tr><td>${l.name}</td><td style="text-align:center">${l.qty}</td><td style="text-align:right">₹${Number(l.price).toLocaleString('en-IN')}</td><td style="text-align:right">₹${(l.qty * l.price).toLocaleString('en-IN')}</td></tr>`)
      .join('')
    w.document.write(`<html><head><title>${invoice.number}</title><style>
      body{font-family:Inter,system-ui,sans-serif;color:#0f172a;padding:32px;font-size:13px}
      h1{font-size:18px;margin:0}.muted{color:#64748b}
      table{width:100%;border-collapse:collapse;margin-top:16px}
      th,td{padding:8px;border-bottom:1px solid #e2e8f0;text-align:left;font-size:13px}
      th{background:#f8fafc;font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:#64748b}
      .tot{margin-top:16px;text-align:right}.tot div{margin:2px 0}
    </style></head><body>
      <div style="display:flex;justify-content:space-between;align-items:start">
        <div><h1>DENTOR Dental Clinic</h1><div class="muted">No. 6, Ponnagar, Dindigul Road, Manaparai – 621306<br>+91 73392 99339 · GSTIN 33ABCDE1234F1Z5</div></div>
        <div style="text-align:right"><b>${invoice.number}</b><br><span class="muted">${fmtDate(invoice.date)}</span><br><span class="muted">Status: ${invoice.status}</span></div>
      </div>
      <div style="margin-top:20px"><b>Billed to:</b> ${invoice.patient} (${invoice.patientCode || ''})<br><span class="muted">Doctor: ${invoice.doctor || ''}</span></div>
      <table><thead><tr><th>Treatment</th><th style="text-align:center">Qty</th><th style="text-align:right">Rate</th><th style="text-align:right">Amount</th></tr></thead><tbody>${rows}</tbody></table>
      <div class="tot">
        <div>Subtotal: ₹${Number(invoice.subtotal ?? invoice.total).toLocaleString('en-IN')}</div>
        <div>GST: ₹${Number(invoice.tax ?? 0).toLocaleString('en-IN')}</div>
        <div>Discount: −₹${Number(invoice.discount ?? 0).toLocaleString('en-IN')}</div>
        <div style="font-size:16px;font-weight:700;margin-top:6px">Total: ₹${Number(invoice.total).toLocaleString('en-IN')}</div>
        <div>Paid: ₹${Number(invoice.paid ?? 0).toLocaleString('en-IN')} · Balance: ₹${Number(invoice.balance ?? 0).toLocaleString('en-IN')}</div>
      </div>
      <p class="muted" style="margin-top:40px">Thank you for choosing DENTOR. · This is a computer generated invoice.</p>
      <script>window.print()</script></body></html>`)
    w.document.close()
  }

  return (
    <Dialog
      open={!!invoice}
      onClose={onClose}
      title={invoice.number}
      subtitle={`${invoice.patient} · ${fmtDate(invoice.date)}`}
      footer={
        <>
          <Button variant="outline" onClick={print}><Printer className="h-4 w-4" /> Print / PDF</Button>
          {Number(invoice.balance) > 0 && <Button onClick={onPay}><Wallet className="h-4 w-4" /> Record Payment</Button>}
        </>
      }
    >
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <StatusBadge status={invoice.status} />
          <span className="text-xs text-slate-500">{invoice.source} · {invoice.doctor}</span>
        </div>
        <div className="overflow-hidden rounded-xl border border-slate-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2">Treatment</th>
                <th className="px-3 py-2 text-center">Qty</th>
                <th className="px-3 py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(invoice.items ?? [{ name: invoice.treatment, qty: 1, price: invoice.total }]).map((l: Line, i: number) => (
                <tr key={i}>
                  <td className="px-3 py-2">{l.name}</td>
                  <td className="px-3 py-2 text-center">{l.qty}</td>
                  <td className="px-3 py-2 text-right">{fmtINR(l.qty * l.price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="space-y-1 rounded-xl bg-slate-50 px-4 py-3 text-sm">
          <div className="flex justify-between text-slate-600"><span>Total</span><span className="font-semibold text-slate-900">{fmtINR(invoice.total)}</span></div>
          <div className="flex justify-between text-slate-600"><span>Paid</span><span className="text-emerald-700">{fmtINR(invoice.paid)}</span></div>
          <div className="flex justify-between text-slate-600"><span>Balance</span><span className={Number(invoice.balance) > 0 ? 'font-semibold text-red-600' : 'text-slate-500'}>{fmtINR(invoice.balance)}</span></div>
        </div>
        {invoice.notes && <p className="text-[13px] text-slate-500">{invoice.notes}</p>}
      </div>
    </Dialog>
  )
}

/* ---------- Main page ---------- */
export default function Accounts() {
  const [params, setParams] = useSearchParams()
  const [tab, setTab] = useState(params.get('tab') || 'invoices')
  const [q, setQ] = useState('')
  const [status, setStatus] = useState(params.get('status') || '')
  const [invoiceOpen, setInvoiceOpen] = useState(false)
  const [payOpen, setPayOpen] = useState(params.get('pay') === '1')
  const [payInvoice, setPayInvoice] = useState<Doc | null>(null)
  const [viewInvoice, setViewInvoice] = useState<Doc | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Doc | null>(null)
  const [ledgerPatient, setLedgerPatient] = useState<Doc | null>(null)

  useEffect(() => {
    if (params.get('pay') === '1' || params.get('status') || params.get('tab')) {
      params.delete('pay')
      setParams(params, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const { data: summary } = useQuery<Record<string, any>>({
    queryKey: ['accounts-summary'],
    queryFn: () => api.get('/api/accounts/summary'),
  })

  const { data: invData, isLoading: invLoading } = useList('invoices', {
    q, ...(status ? { status } : {}), sort: 'date', order: 'desc', limit: 300,
  })
  const { data: payData, isLoading: payLoading } = useList('payments', { q, sort: 'date', order: 'desc', limit: 300 })

  const ledgerCode = ledgerPatient?.code
  const { data: ledgerInv } = useList('invoices', { patientCode: ledgerCode, sort: 'date', order: 'desc' }, { enabled: !!ledgerCode })
  const { data: ledgerPay } = useList('payments', { patientCode: ledgerCode, sort: 'date', order: 'desc' }, { enabled: !!ledgerCode })

  const ledgerTotals = useMemo(() => {
    const billed = (ledgerInv?.items ?? []).reduce((s, i) => s + Number(i.total || 0), 0)
    const paid = (ledgerPay?.items ?? []).reduce((s, p) => s + Number(p.amount || 0), 0)
    return { billed, paid, balance: billed - paid }
  }, [ledgerInv, ledgerPay])

  const remove = useDelete('invoices', { successMessage: 'Invoice deleted', invalidate: ['accounts-summary', 'dashboard'] })

  return (
    <div>
      <PageHeader
        title="Billing & Accounts"
        subtitle="Invoices, payments, receivables and patient ledger"
        actions={
          <>
            <Button variant="outline" onClick={() => { setPayInvoice(null); setPayOpen(true) }}>
              <Wallet className="h-4 w-4" /> Record Payment
            </Button>
            <Button onClick={() => setInvoiceOpen(true)}>
              <Plus className="h-4 w-4" /> New Invoice
            </Button>
          </>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
        <StatCard label="Invoices" value={summary?.invoices ?? '—'} hint={`Total value ${fmtINR(summary?.totalValue)}`} icon={<FileText className="h-5 w-5" />} />
        <StatCard label="Outstanding" value={fmtINR(summary?.outstanding)} hint={`${summary?.invoicesWithBalance ?? 0} invoices with balance due`} icon={<Receipt className="h-5 w-5" />} accent="red" onClick={() => { setTab('invoices'); setStatus('Pending') }} />
        <StatCard label="Collected" value={fmtINR(summary?.collected)} hint={`${summary?.invoicesWithCollections ?? 0} invoices with collections`} icon={<IndianRupee className="h-5 w-5" />} accent="green" />
        <StatCard label="Today's modes" value={(summary?.byMode ?? []).slice(0, 2).map((m: any) => m.mode).join(' · ') || '—'} hint="Most used payment modes" icon={<Wallet className="h-5 w-5" />} accent="blue" />
      </div>

      <Tabs
        className="mb-4"
        value={tab}
        onChange={setTab}
        tabs={[
          { key: 'invoices', label: 'Invoices', count: invData?.total },
          { key: 'payments', label: 'Payments & Receipts', count: payData?.total },
          { key: 'ledger', label: 'Patient Ledger' },
        ]}
      />

      {tab === 'invoices' && (
        <>
          <div className="mb-3 flex flex-wrap gap-2">
            <SearchInput value={q} onChange={setQ} placeholder="Search invoice, patient, ID or treatment…" className="min-w-0 flex-1 sm:max-w-sm" />
            <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-32">
              <option value="">All Status</option>
              {['Paid', 'Partial', 'Pending'].map((s) => <option key={s}>{s}</option>)}
            </Select>
          </div>
          <Card>
            {invLoading ? (
              <ListSkeleton rows={6} />
            ) : !invData?.items?.length ? (
              <EmptyState icon={<FileText className="h-6 w-6" />} title="No invoices found" message="Create your first invoice to start billing." action={<Button size="sm" onClick={() => setInvoiceOpen(true)}><Plus className="h-4 w-4" /> New Invoice</Button>} />
            ) : (
              <ul className="divide-y divide-slate-100">
                {invData.items.map((inv) => (
                  <li
                    key={inv.id}
                    onClick={() => setViewInvoice(inv)}
                    className="flex cursor-pointer flex-wrap items-center gap-3 px-4 py-3 transition hover:bg-slate-50 sm:px-5"
                  >
                    <div className="w-28 shrink-0">
                      <div className="text-[13px] font-bold text-brand-800">{inv.number}</div>
                      <div className="text-xs text-slate-400">{fmtDate(inv.date)}</div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-slate-800">{inv.patient}</div>
                      <div className="truncate text-xs text-slate-500">{inv.treatment} · {inv.doctor}</div>
                    </div>
                    <div className="hidden w-28 text-right sm:block">
                      <div className="text-sm font-bold text-slate-900">{fmtINR(inv.total)}</div>
                      {Number(inv.balance) > 0 && <div className="text-xs text-red-600">Due {fmtINR(inv.balance)}</div>}
                    </div>
                    <StatusBadge status={inv.status} />
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      {Number(inv.balance) > 0 && (
                        <Button size="sm" variant="secondary" onClick={() => { setPayInvoice(inv); setPayOpen(true) }}>
                          Collect
                        </Button>
                      )}
                      <Button size="icon-sm" variant="ghost" className="text-slate-400 hover:text-red-600" onClick={() => setDeleteTarget(inv)} aria-label="Delete invoice">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}

      {tab === 'payments' && (
        <Card>
          {payLoading ? (
            <ListSkeleton rows={6} />
          ) : !payData?.items?.length ? (
            <EmptyState icon={<Wallet className="h-6 w-6" />} title="No payments recorded" message="Payments you collect will appear here with receipts." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {payData.items.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5">
                  <div className="w-28 shrink-0">
                    <div className="text-[13px] font-bold text-slate-800">{p.receipt}</div>
                    <div className="text-xs text-slate-400">{fmtDate(p.date)}</div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-slate-800">{p.patient}</div>
                    <div className="truncate text-xs text-slate-500">{p.invoice} · {p.reference}</div>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">{p.mode}</span>
                  <span className="w-24 text-right text-sm font-bold text-emerald-700">{fmtINR(p.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {tab === 'ledger' && (
        <Card className="p-4 sm:p-5">
          <div className="max-w-md">
            <PatientPicker
              value={ledgerPatient ? { name: ledgerPatient.name, code: ledgerPatient.code } : null}
              onPick={setLedgerPatient}
              onClear={() => setLedgerPatient(null)}
            />
          </div>
          {ledgerPatient && (
            <div className="mt-5 space-y-4">
              <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
                <StatCard label="Total billed" value={fmtINR(ledgerTotals.billed)} />
                <StatCard label="Total paid" value={fmtINR(ledgerTotals.paid)} accent="green" />
                <StatCard label="Balance" value={fmtINR(ledgerTotals.balance)} accent={ledgerTotals.balance > 0 ? 'red' : 'green'} />
              </div>
              <div>
                <h3 className="mb-2 text-sm font-semibold text-slate-800">Invoices</h3>
                {!ledgerInv?.items?.length ? (
                  <p className="text-[13px] text-slate-400">No invoices for this patient.</p>
                ) : (
                  <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                    {ledgerInv.items.map((inv) => (
                      <li key={inv.id} className="flex cursor-pointer items-center gap-3 px-3.5 py-2.5 hover:bg-slate-50" onClick={() => setViewInvoice(inv)}>
                        <span className="w-28 text-[13px] font-semibold text-brand-800">{inv.number}</span>
                        <span className="hidden text-xs text-slate-400 sm:block">{fmtDate(inv.date)}</span>
                        <span className="min-w-0 flex-1 truncate text-[13px] text-slate-600">{inv.treatment}</span>
                        <span className="text-[13px] font-semibold">{fmtINR(inv.total)}</span>
                        <StatusBadge status={inv.status} />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <h3 className="mb-2 text-sm font-semibold text-slate-800">Payments</h3>
                {!ledgerPay?.items?.length ? (
                  <p className="text-[13px] text-slate-400">No payments recorded for this patient.</p>
                ) : (
                  <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                    {ledgerPay.items.map((p) => (
                      <li key={p.id} className="flex items-center gap-3 px-3.5 py-2.5">
                        <span className="w-28 text-[13px] font-semibold text-slate-700">{p.receipt}</span>
                        <span className="hidden text-xs text-slate-400 sm:block">{fmtDate(p.date)}</span>
                        <span className="min-w-0 flex-1 truncate text-[13px] text-slate-600">{p.invoice} · {p.mode}</span>
                        <span className="text-[13px] font-semibold text-emerald-700">{fmtINR(p.amount)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </Card>
      )}

      <InvoiceDialog open={invoiceOpen} onClose={() => setInvoiceOpen(false)} />
      <PaymentDialog open={payOpen} onClose={() => { setPayOpen(false); setPayInvoice(null) }} invoice={payInvoice} />
      <InvoiceView
        invoice={viewInvoice}
        onClose={() => setViewInvoice(null)}
        onPay={() => { setPayInvoice(viewInvoice); setViewInvoice(null); setPayOpen(true) }}
      />
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => { if (deleteTarget) { remove.mutate(deleteTarget.id); setDeleteTarget(null) } }}
        title="Delete this invoice?"
        message={deleteTarget ? `${deleteTarget.number} · ${deleteTarget.patient} · ${fmtINR(deleteTarget.total)}. This cannot be undone and will not reverse recorded payments.` : ''}
      />
    </div>
  )
}
