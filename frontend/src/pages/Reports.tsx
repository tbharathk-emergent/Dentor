import { useMemo, useState } from 'react'
import { format, subDays } from 'date-fns'
import { BarChart3, Download, FileBarChart, Play, Save, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { fmtDate, fmtINR, todayISO, useCreate, useDelete, useList, type Doc } from '@/lib/hooks'
import { StatusBadge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Field, Input, Select } from '@/components/ui/Field'
import { Tabs } from '@/components/ui/Tabs'
import { EmptyState, PageHeader, StatCard } from '@/components/ui/bits'
import { cn } from '@/lib/cn'

const SOURCES: Record<string, { resource: string; label: string; fields: { key: string; label: string; money?: boolean; date?: boolean }[] }> = {
  patients: {
    resource: 'patients',
    label: 'Patients & Treatments',
    fields: [
      { key: 'code', label: 'Patient ID' }, { key: 'name', label: 'Patient Name' },
      { key: 'age', label: 'Age' }, { key: 'gender', label: 'Gender' }, { key: 'mobile', label: 'Mobile' },
      { key: 'treatment', label: 'Treatment' }, { key: 'doctor', label: 'Doctor' },
      { key: 'risk', label: 'Risk' }, { key: 'status', label: 'Status' }, { key: 'lastVisit', label: 'Last Visit', date: true },
    ],
  },
  appointments: {
    resource: 'appointments',
    label: 'Appointments',
    fields: [
      { key: 'code', label: 'Appt ID' }, { key: 'date', label: 'Date', date: true }, { key: 'time', label: 'Time' },
      { key: 'patient', label: 'Patient' }, { key: 'treatment', label: 'Treatment' }, { key: 'doctor', label: 'Doctor' },
      { key: 'chair', label: 'Chair' }, { key: 'status', label: 'Status' },
    ],
  },
  accounts: {
    resource: 'invoices',
    label: 'Accounts & Payments',
    fields: [
      { key: 'number', label: 'Invoice' }, { key: 'date', label: 'Date', date: true }, { key: 'patient', label: 'Patient' },
      { key: 'treatment', label: 'Treatment' }, { key: 'doctor', label: 'Doctor' },
      { key: 'total', label: 'Amount', money: true }, { key: 'paid', label: 'Collected', money: true },
      { key: 'balance', label: 'Outstanding', money: true }, { key: 'status', label: 'Status' },
    ],
  },
  pharmacy: {
    resource: 'pharmacy_items',
    label: 'Pharmacy & Inventory',
    fields: [
      { key: 'code', label: 'Code' }, { key: 'name', label: 'Medicine' }, { key: 'category', label: 'Category' },
      { key: 'stock', label: 'Stock' }, { key: 'reorder', label: 'Reorder Level' },
      { key: 'salePrice', label: 'Sale Price', money: true }, { key: 'batch', label: 'Batch' }, { key: 'expiry', label: 'Expiry', date: true },
    ],
  },
  staff: {
    resource: 'staff',
    label: 'Staff & Payroll',
    fields: [
      { key: 'code', label: 'Employee ID' }, { key: 'name', label: 'Name' }, { key: 'role', label: 'Role' },
      { key: 'department', label: 'Department' }, { key: 'employment', label: 'Employment' },
      { key: 'salary', label: 'Salary', money: true }, { key: 'status', label: 'Status' },
    ],
  },
  laboratory: {
    resource: 'lab_orders',
    label: 'Laboratory',
    fields: [
      { key: 'code', label: 'Order' }, { key: 'patient', label: 'Patient' }, { key: 'caseType', label: 'Case Type' },
      { key: 'lab', label: 'Lab' }, { key: 'due', label: 'Due', date: true }, { key: 'stage', label: 'Stage' },
      { key: 'status', label: 'Status' }, { key: 'amount', label: 'Amount', money: true }, { key: 'paid', label: 'Paid', money: true },
    ],
  },
}

function downloadCsv(name: string, headers: string[], rows: (string | number)[][]) {
  const esc = (v: string | number) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const csv = [headers.map(esc).join(','), ...rows.map((r) => r.map(esc).join(','))].join('\n')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
  a.download = `${name}.csv`
  a.click()
}

export default function Reports() {
  const [tab, setTab] = useState('overview')
  const [from, setFrom] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'))
  const [to, setTo] = useState(todayISO())

  // Pull the raw data once; aggregate client-side (demo-scale data).
  const { data: invoices } = useList('invoices', { limit: 1000 })
  const { data: payments } = useList('payments', { limit: 1000 })
  const { data: appointments } = useList('appointments', { limit: 1000 })
  const { data: patients } = useList('patients', { limit: 1000 })

  const inRange = (d: string | undefined) => !!d && d >= from && d <= to

  const stats = useMemo(() => {
    const inv = (invoices?.items ?? []).filter((i) => inRange(i.date))
    const pay = (payments?.items ?? []).filter((p) => inRange(p.date))
    const appt = (appointments?.items ?? []).filter((a) => inRange(a.date))
    const newPatients = (patients?.items ?? []).filter((p) => inRange(String(p.created_at || '').slice(0, 10)))

    const billed = inv.reduce((s, i) => s + Number(i.total || 0), 0)
    const collected = pay.reduce((s, p) => s + Number(p.amount || 0), 0)
    const outstanding = inv.reduce((s, i) => s + Number(i.balance || 0), 0)

    const byMode: Record<string, number> = {}
    for (const p of pay) byMode[p.mode || 'Other'] = (byMode[p.mode || 'Other'] || 0) + Number(p.amount || 0)

    const byDoctor: Record<string, { count: number; value: number }> = {}
    for (const i of inv) {
      const d = i.doctor || '—'
      byDoctor[d] = { count: (byDoctor[d]?.count || 0) + 1, value: (byDoctor[d]?.value || 0) + Number(i.total || 0) }
    }
    const byTreatment: Record<string, number> = {}
    for (const i of inv) byTreatment[i.treatment || '—'] = (byTreatment[i.treatment || '—'] || 0) + Number(i.total || 0)

    const apptByStatus: Record<string, number> = {}
    for (const a of appt) apptByStatus[a.status || '—'] = (apptByStatus[a.status || '—'] || 0) + 1

    return { inv, pay, appt, newPatients, billed, collected, outstanding, byMode, byDoctor, byTreatment, apptByStatus }
  }, [invoices, payments, appointments, patients, from, to])

  const bar = (value: number, max: number) => (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
      <div className="h-full rounded-full bg-brand-600" style={{ width: `${max ? Math.round((value / max) * 100) : 0}%` }} />
    </div>
  )

  return (
    <div>
      <PageHeader title="Reports & Analytics" subtitle="Live operational and financial reporting" />

      <Tabs
        className="mb-4"
        value={tab}
        onChange={setTab}
        tabs={[
          { key: 'overview', label: 'Overview' },
          { key: 'collections', label: 'Collections' },
          { key: 'appointments', label: 'Appointments' },
          { key: 'custom', label: 'Custom Reports' },
        ]}
      />

      {tab !== 'custom' && (
        <div className="mb-4 flex flex-wrap items-end gap-2">
          <Field label="From"><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
          <Field label="To"><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
          <span className="pb-2.5 text-xs text-slate-400">{stats.inv.length} invoices · {stats.pay.length} payments · {stats.appt.length} appointments in range</span>
        </div>
      )}

      {tab === 'overview' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
            <StatCard label="Billed" value={fmtINR(stats.billed)} icon={<BarChart3 className="h-5 w-5" />} />
            <StatCard label="Collected" value={fmtINR(stats.collected)} accent="green" icon={<BarChart3 className="h-5 w-5" />} />
            <StatCard label="Outstanding" value={fmtINR(stats.outstanding)} accent="red" icon={<BarChart3 className="h-5 w-5" />} />
            <StatCard label="New patients" value={stats.newPatients.length} accent="blue" icon={<BarChart3 className="h-5 w-5" />} />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader title="Revenue by Doctor" />
              <CardBody className="space-y-3">
                {Object.entries(stats.byDoctor).sort((a, b) => b[1].value - a[1].value).map(([doc, v]) => (
                  <div key={doc}>
                    <div className="mb-1 flex justify-between text-[13px]">
                      <span className="font-medium text-slate-700">{doc}</span>
                      <span className="text-slate-500">{v.count} invoices · <b className="text-slate-800">{fmtINR(v.value)}</b></span>
                    </div>
                    {bar(v.value, Math.max(...Object.values(stats.byDoctor).map((x) => x.value)))}
                  </div>
                ))}
                {!Object.keys(stats.byDoctor).length && <p className="text-[13px] text-slate-400">No invoices in this range.</p>}
              </CardBody>
            </Card>
            <Card>
              <CardHeader title="Revenue by Treatment" />
              <CardBody className="space-y-3">
                {Object.entries(stats.byTreatment).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([t, v]) => (
                  <div key={t}>
                    <div className="mb-1 flex justify-between text-[13px]">
                      <span className="truncate font-medium text-slate-700">{t}</span>
                      <span className="shrink-0 font-semibold text-slate-800">{fmtINR(v)}</span>
                    </div>
                    {bar(v, Math.max(...Object.values(stats.byTreatment)))}
                  </div>
                ))}
                {!Object.keys(stats.byTreatment).length && <p className="text-[13px] text-slate-400">No invoices in this range.</p>}
              </CardBody>
            </Card>
          </div>
        </div>
      )}

      {tab === 'collections' && (
        <div className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader
                title="Collections by Mode"
                actions={
                  <Button size="sm" variant="outline" onClick={() => downloadCsv('collections-by-mode', ['Mode', 'Amount'], Object.entries(stats.byMode))}>
                    <Download className="h-4 w-4" /> CSV
                  </Button>
                }
              />
              <CardBody className="space-y-3">
                {Object.entries(stats.byMode).sort((a, b) => b[1] - a[1]).map(([mode, v]) => (
                  <div key={mode}>
                    <div className="mb-1 flex justify-between text-[13px]">
                      <span className="font-medium text-slate-700">{mode}</span>
                      <span className="font-semibold text-slate-800">{fmtINR(v)}</span>
                    </div>
                    {bar(v, Math.max(...Object.values(stats.byMode)))}
                  </div>
                ))}
                {!Object.keys(stats.byMode).length && <p className="text-[13px] text-slate-400">No payments in this range.</p>}
              </CardBody>
            </Card>
            <Card>
              <CardHeader
                title="Payment Register"
                actions={
                  <Button size="sm" variant="outline" onClick={() => downloadCsv('payments', ['Receipt', 'Date', 'Patient', 'Invoice', 'Mode', 'Amount'], stats.pay.map((p) => [p.receipt, p.date, p.patient, p.invoice, p.mode, p.amount]))}>
                    <Download className="h-4 w-4" /> CSV
                  </Button>
                }
              />
              <ul className="max-h-96 divide-y divide-slate-100 overflow-y-auto">
                {stats.pay.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 px-4 py-2.5 text-[13px]">
                    <span className="w-24 font-semibold text-slate-700">{p.receipt}</span>
                    <span className="hidden w-20 text-slate-400 sm:block">{fmtDate(p.date)}</span>
                    <span className="min-w-0 flex-1 truncate text-slate-600">{p.patient}</span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs">{p.mode}</span>
                    <span className="font-semibold text-emerald-700">{fmtINR(p.amount)}</span>
                  </li>
                ))}
                {!stats.pay.length && <li className="px-4 py-6 text-center text-[13px] text-slate-400">No payments in this range.</li>}
              </ul>
            </Card>
          </div>
          <Card>
            <CardHeader
              title="Outstanding Invoices"
              actions={
                <Button size="sm" variant="outline" onClick={() => downloadCsv('outstanding', ['Invoice', 'Date', 'Patient', 'Total', 'Balance', 'Status'], stats.inv.filter((i) => Number(i.balance) > 0).map((i) => [i.number, i.date, i.patient, i.total, i.balance, i.status]))}>
                  <Download className="h-4 w-4" /> CSV
                </Button>
              }
            />
            <ul className="divide-y divide-slate-100">
              {stats.inv.filter((i) => Number(i.balance) > 0).map((i) => (
                <li key={i.id} className="flex items-center gap-3 px-4 py-2.5 text-[13px]">
                  <span className="w-28 font-semibold text-brand-800">{i.number}</span>
                  <span className="hidden w-20 text-slate-400 sm:block">{fmtDate(i.date)}</span>
                  <span className="min-w-0 flex-1 truncate text-slate-600">{i.patient}</span>
                  <StatusBadge status={i.status} />
                  <span className="font-semibold text-red-600">{fmtINR(i.balance)}</span>
                </li>
              ))}
              {!stats.inv.some((i) => Number(i.balance) > 0) && (
                <li className="px-4 py-6 text-center text-[13px] text-slate-400">Nothing outstanding in this range. 🎉</li>
              )}
            </ul>
          </Card>
        </div>
      )}

      {tab === 'appointments' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader title="Appointments by Status" />
            <CardBody className="space-y-3">
              {Object.entries(stats.apptByStatus).map(([s, n]) => (
                <div key={s}>
                  <div className="mb-1 flex justify-between text-[13px]">
                    <span className="font-medium text-slate-700">{s}</span>
                    <span className="font-semibold text-slate-800">{n}</span>
                  </div>
                  {bar(n, Math.max(...Object.values(stats.apptByStatus)))}
                </div>
              ))}
              {!Object.keys(stats.apptByStatus).length && <p className="text-[13px] text-slate-400">No appointments in this range.</p>}
            </CardBody>
          </Card>
          <Card>
            <CardHeader
              title="Appointment Register"
              actions={
                <Button size="sm" variant="outline" onClick={() => downloadCsv('appointments', ['Date', 'Time', 'Patient', 'Treatment', 'Doctor', 'Status'], stats.appt.map((a) => [a.date, a.time, a.patient, a.treatment, a.doctor, a.status]))}>
                  <Download className="h-4 w-4" /> CSV
                </Button>
              }
            />
            <ul className="max-h-96 divide-y divide-slate-100 overflow-y-auto">
              {stats.appt.map((a) => (
                <li key={a.id} className="flex items-center gap-3 px-4 py-2.5 text-[13px]">
                  <span className="w-20 text-slate-400">{fmtDate(a.date)}</span>
                  <span className="min-w-0 flex-1 truncate text-slate-700">{a.patient} · <span className="text-slate-400">{a.treatment}</span></span>
                  <StatusBadge status={a.status} />
                </li>
              ))}
              {!stats.appt.length && <li className="px-4 py-6 text-center text-[13px] text-slate-400">No appointments in this range.</li>}
            </ul>
          </Card>
        </div>
      )}

      {tab === 'custom' && <CustomReports />}
    </div>
  )
}

function CustomReports() {
  const [source, setSource] = useState('accounts')
  const [selected, setSelected] = useState<string[]>(['number', 'date', 'patient', 'total', 'status'])
  const [name, setName] = useState('')
  const [running, setRunning] = useState(false)

  const def = SOURCES[source]
  const { data: saved } = useList('saved_reports', { limit: 100 })
  const { data: rows } = useList(def.resource, { limit: 1000 }, { enabled: running })
  const create = useCreate('saved_reports', { successMessage: 'Report saved' })
  const remove = useDelete('saved_reports', { successMessage: 'Saved report deleted' })

  const toggleField = (k: string) =>
    setSelected((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k]))

  const activeFields = def.fields.filter((f) => selected.includes(f.key))

  const exportCsv = () => {
    if (!rows?.items?.length) return toast.error('Run the report first.')
    downloadCsv(
      name || `dentor-${source}-report`,
      activeFields.map((f) => f.label),
      rows.items.map((r: Doc) => activeFields.map((f) => r[f.key] ?? '')),
    )
  }

  const loadSaved = (r: Doc) => {
    setSource(r.sourceKey || 'accounts')
    setSelected(r.fields || [])
    setName(r.name)
    setRunning(true)
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
      <div className="space-y-4">
        <Card>
          <CardHeader title="Report Builder" />
          <CardBody className="space-y-4">
            <Field label="Data Source">
              <Select value={source} onChange={(e) => { setSource(e.target.value); setSelected(SOURCES[e.target.value].fields.slice(0, 5).map((f) => f.key)); setRunning(false) }}>
                {Object.entries(SOURCES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </Select>
            </Field>
            <div>
              <span className="mb-1.5 block text-[13px] font-medium text-slate-700">Fields</span>
              <div className="flex flex-wrap gap-1.5">
                {def.fields.map((f) => (
                  <button
                    key={f.key}
                    onClick={() => toggleField(f.key)}
                    className={cn(
                      'rounded-full border px-2.5 py-1 text-xs font-medium transition',
                      selected.includes(f.key)
                        ? 'border-brand-600 bg-brand-50 text-brand-800'
                        : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300',
                    )}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
            <Field label="Report Name">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Monthly receivables" />
            </Field>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={() => setRunning(true)} disabled={!selected.length}>
                <Play className="h-4 w-4" /> Run
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  if (!name.trim()) return toast.error('Name the report before saving.')
                  create.mutate({ name, source: def.label, sourceKey: source, fields: selected, schedule: 'Manual' } as Partial<Doc>)
                }}
              >
                <Save className="h-4 w-4" /> Save
              </Button>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Saved Reports" />
          {!saved?.items?.length ? (
            <CardBody className="py-5 text-center text-[13px] text-slate-400">Saved reports appear here.</CardBody>
          ) : (
            <ul className="divide-y divide-slate-100">
              {saved.items.map((r) => (
                <li key={r.id} className="flex items-center gap-2 px-4 py-2.5">
                  <button onClick={() => loadSaved(r)} className="min-w-0 flex-1 text-left">
                    <span className="block truncate text-[13px] font-medium text-slate-800">{r.name}</span>
                    <span className="block text-xs text-slate-400">{r.source} · {(r.fields || []).length} fields</span>
                  </button>
                  <Button size="icon-sm" variant="ghost" className="text-slate-400 hover:text-red-600" onClick={() => remove.mutate(r.id)} aria-label="Delete report">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card>
        <CardHeader
          title={name || 'Report Preview'}
          subtitle={running ? `${rows?.items?.length ?? 0} rows · ${def.label}` : 'Choose fields and press Run'}
          actions={<Button size="sm" variant="outline" onClick={exportCsv}><Download className="h-4 w-4" /> Export CSV</Button>}
        />
        {!running ? (
          <EmptyState icon={<FileBarChart className="h-6 w-6" />} title="No report run yet" message="Pick a source and fields on the left, then press Run." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left">
                  {activeFields.map((f) => (
                    <th key={f.key} className="whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500">{f.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(rows?.items ?? []).map((r: Doc) => (
                  <tr key={r.id}>
                    {activeFields.map((f) => (
                      <td key={f.key} className="whitespace-nowrap px-4 py-2.5">
                        {f.money ? fmtINR(r[f.key]) : f.date ? fmtDate(r[f.key]) : String(r[f.key] ?? '—')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
