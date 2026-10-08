import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle, Boxes, Eye, IndianRupee, Minus, PackagePlus, PackageX, Pill,
  Plus, Printer, Receipt, ShoppingCart, Trash2, X,
} from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { fmtDate, fmtINR, todayISO, useCreate, useDelete, useList, useUpdate, type Doc } from '@/lib/hooks'
import { Badge, statusTone } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { ConfirmDialog, Dialog } from '@/components/ui/Dialog'
import { Field, Input, Select } from '@/components/ui/Field'
import { Tabs } from '@/components/ui/Tabs'
import { EmptyState, ListSkeleton, PageHeader, SearchInput, StatCard } from '@/components/ui/bits'
import { PatientPicker } from '@/components/rx/PatientPicker'
import { billReceiptHTML, openPrintWindow } from '@/components/rx/print'

const CATEGORIES = ['Antibiotics', 'Analgesics', 'Antacids', 'Anaesthetics', 'Oral Care', 'Paediatric', 'Supplements', 'Consumables', 'Other']
const FORMS = ['Tablet', 'Capsule', 'Syrup', 'Liquid', 'Injection', 'Gel', 'Mouthwash', 'Powder']
const UNITS = ['Strip', 'Bottle', 'Unit', 'Tube', 'Box']
const MODES = ['Cash', 'UPI', 'Card']

const money2 = (n: unknown) =>
  '₹' + Number(n ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const stockStatus = (it: Doc): 'Available' | 'Low Stock' | 'Out of Stock' => {
  const stock = Number(it.stock ?? 0)
  if (stock <= 0) return 'Out of Stock'
  if (stock <= Number(it.reorder ?? 0)) return 'Low Stock'
  return 'Available'
}

const stockTone = (s: string) => (s === 'Available' ? 'green' : statusTone(s))

interface ItemForm {
  name: string; category: string; form: string; batch: string; expiry: string
  stock: string; reorder: string; purchasePrice: string; salePrice: string; gst: string; unit: string
}
const emptyItem: ItemForm = {
  name: '', category: CATEGORIES[0], form: FORMS[0], batch: '', expiry: '',
  stock: '0', reorder: '30', purchasePrice: '', salePrice: '', gst: '12', unit: UNITS[0],
}

interface CartLine {
  itemId: string; code: string; name: string; batch: string
  price: number; gst: number; stock: number; qty: number
}

function ItemDialog({
  open, onClose, editing,
}: {
  open: boolean
  onClose: () => void
  editing?: Doc | null
}) {
  const [form, setForm] = useState<ItemForm>(emptyItem)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const create = useCreate('pharmacy_items', { successMessage: 'Item added to stock' })
  const update = useUpdate('pharmacy_items', { successMessage: 'Item updated' })

  useEffect(() => {
    if (open) {
      setErrors({})
      setForm(
        editing
          ? {
              name: editing.name || '', category: editing.category || CATEGORIES[0], form: editing.form || FORMS[0],
              batch: editing.batch || '', expiry: (editing.expiry || '').slice(0, 10),
              stock: String(editing.stock ?? 0), reorder: String(editing.reorder ?? 30),
              purchasePrice: String(editing.purchasePrice ?? ''), salePrice: String(editing.salePrice ?? ''),
              gst: String(editing.gst ?? 12), unit: editing.unit || UNITS[0],
            }
          : emptyItem,
      )
    }
  }, [open, editing])

  const set = (k: keyof ItemForm) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (!form.name.trim()) errs.name = 'Enter the medicine name.'
    if (form.salePrice === '' || Number(form.salePrice) < 0) errs.salePrice = 'Enter a valid sale price.'
    if (form.purchasePrice === '' || Number(form.purchasePrice) < 0) errs.purchasePrice = 'Enter a valid purchase price.'
    if (Number(form.stock) < 0) errs.stock = 'Stock cannot be negative.'
    setErrors(errs)
    if (Object.keys(errs).length) return
    const payload = {
      name: form.name.trim(), category: form.category, form: form.form, batch: form.batch,
      expiry: form.expiry, stock: Number(form.stock || 0), reorder: Number(form.reorder || 0),
      purchasePrice: Number(form.purchasePrice || 0), salePrice: Number(form.salePrice || 0),
      gst: Number(form.gst || 0), unit: form.unit, status: 'Active',
    }
    if (editing) update.mutate({ id: editing.id, ...payload }, { onSuccess: onClose })
    else create.mutate(payload as Partial<Doc>, { onSuccess: onClose })
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={editing ? 'Edit Stock Item' : 'Add Stock Item'}
      subtitle={editing ? `${editing.code} · ${editing.name}` : 'Create a medicine stock record.'}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit as never} loading={create.isPending || update.isPending}>
            {editing ? 'Save Changes' : 'Add Item'}
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="grid grid-cols-2 gap-4">
        <Field label="Medicine Name" required error={errors.name} className="col-span-2">
          <Input value={form.name} onChange={set('name')} placeholder="e.g. Amoxicillin 500mg" autoFocus />
        </Field>
        <Field label="Category">
          <Select value={form.category} onChange={set('category')}>
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </Select>
        </Field>
        <Field label="Form">
          <Select value={form.form} onChange={set('form')}>
            {FORMS.map((f) => <option key={f}>{f}</option>)}
          </Select>
        </Field>
        <Field label="Batch">
          <Input value={form.batch} onChange={set('batch')} placeholder="e.g. AMX-2601" />
        </Field>
        <Field label="Expiry">
          <Input type="date" value={form.expiry} onChange={set('expiry')} />
        </Field>
        <Field label="Purchase Price (₹)" required error={errors.purchasePrice}>
          <Input type="number" min={0} step="0.01" value={form.purchasePrice} onChange={set('purchasePrice')} placeholder="0.00" />
        </Field>
        <Field label="Sale Price (₹)" required error={errors.salePrice}>
          <Input type="number" min={0} step="0.01" value={form.salePrice} onChange={set('salePrice')} placeholder="0.00" />
        </Field>
        <Field label="GST %">
          <Input type="number" min={0} max={28} value={form.gst} onChange={set('gst')} />
        </Field>
        <Field label="Unit">
          <Select value={form.unit} onChange={set('unit')}>
            {UNITS.map((u) => <option key={u}>{u}</option>)}
          </Select>
        </Field>
        <Field label="Current Stock" error={errors.stock}>
          <Input type="number" min={0} value={form.stock} onChange={set('stock')} />
        </Field>
        <Field label="Reorder Level" hint="At or below this, the item shows as Low Stock.">
          <Input type="number" min={0} value={form.reorder} onChange={set('reorder')} />
        </Field>
        <button type="submit" className="hidden" />
      </form>
    </Dialog>
  )
}

export default function Pharmacy() {
  const [params, setParams] = useSearchParams()
  const [tab, setTab] = useState<'stock' | 'dispense' | 'bills'>('stock')

  // Stock tab
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState('')
  const [itemOpen, setItemOpen] = useState(false)
  const [editing, setEditing] = useState<Doc | null>(null)
  const [deleting, setDeleting] = useState<Doc | null>(null)

  // Dispense tab
  const [posQ, setPosQ] = useState('')
  const [cart, setCart] = useState<CartLine[]>([])
  const [billPatient, setBillPatient] = useState<Doc | null>(null)
  const [discount, setDiscount] = useState('')
  const [mode, setMode] = useState(MODES[0])
  const [saving, setSaving] = useState(false)

  // Bills tab
  const [billQ, setBillQ] = useState('')
  const [viewBill, setViewBill] = useState<Doc | null>(null)

  const qc = useQueryClient()
  const itemsQ = useList('pharmacy_items', { limit: 2000, sort: 'name', order: 'asc' })
  const billsQ = useList('pharmacy_bills', { q: billQ, limit: 500, sort: 'created_at', order: 'desc' })
  const deleteItem = useDelete('pharmacy_items', { successMessage: 'Item removed from stock' })

  useEffect(() => {
    if (params.get('filter') === 'low') {
      setFilter('low')
      setTab('stock')
      params.delete('filter')
      setParams(params, { replace: true })
    }
  }, [params, setParams])

  const items = useMemo(() => itemsQ.data?.items ?? [], [itemsQ.data])
  const bills = billsQ.data?.items ?? []
  const itemById = useMemo(() => Object.fromEntries(items.map((i) => [i.id, i])), [items])

  const kpis = useMemo(() => {
    let inStock = 0, low = 0, out = 0, value = 0
    for (const it of items) {
      const s = stockStatus(it)
      if (s === 'Out of Stock') out++
      else {
        inStock++
        if (s === 'Low Stock') low++
      }
      value += Number(it.stock ?? 0) * Number(it.purchasePrice ?? 0)
    }
    return { total: items.length, inStock, low, out, value }
  }, [items])

  const filteredStock = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return items.filter((it) => {
      if (filter === 'low' && stockStatus(it) !== 'Low Stock') return false
      if (filter === 'out' && stockStatus(it) !== 'Out of Stock') return false
      if (!needle) return true
      return [it.name, it.code, it.category, it.batch].some((v) => String(v || '').toLowerCase().includes(needle))
    })
  }, [items, q, filter])

  const posItems = useMemo(() => {
    const needle = posQ.trim().toLowerCase()
    if (!needle) return items
    return items.filter((it) =>
      [it.name, it.code, it.category, it.batch].some((v) => String(v || '').toLowerCase().includes(needle)),
    )
  }, [items, posQ])

  // ----- Cart -----
  const addToCart = (it: Doc) => {
    const stock = Number(it.stock ?? 0)
    if (stock <= 0) return toast.error(`${it.name} is out of stock.`)
    setCart((lines) => {
      const existing = lines.find((l) => l.itemId === it.id)
      if (existing) {
        if (existing.qty + 1 > stock) {
          toast.error(`Only ${stock} in stock for ${it.name}.`)
          return lines
        }
        return lines.map((l) => (l.itemId === it.id ? { ...l, qty: l.qty + 1 } : l))
      }
      return [...lines, {
        itemId: it.id, code: it.code, name: it.name, batch: it.batch || '',
        price: Number(it.salePrice ?? 0), gst: Number(it.gst ?? 0), stock, qty: 1,
      }]
    })
  }

  const setQty = (itemId: string, raw: number) => {
    setCart((lines) =>
      lines.map((l) => {
        if (l.itemId !== itemId) return l
        let qty = Math.max(1, Math.floor(raw || 1))
        if (qty > l.stock) {
          toast.error(`Only ${l.stock} in stock for ${l.name}.`)
          qty = l.stock
        }
        return { ...l, qty }
      }),
    )
  }

  const subtotal = cart.reduce((s, l) => s + l.qty * l.price, 0)
  const gstTotal = cart.reduce((s, l) => s + (l.qty * l.price * l.gst) / 100, 0)
  const discountNum = Math.max(0, Number(discount) || 0)
  const grandTotal = Math.max(0, subtotal + gstTotal - discountNum)

  const completeSale = async () => {
    if (!cart.length) return toast.error('Add at least one medicine to the bill.')
    for (const l of cart) {
      const it = itemById[l.itemId]
      if (!it) return toast.error(`${l.name} no longer exists in stock.`)
      if (l.qty > Number(it.stock ?? 0)) return toast.error(`Only ${it.stock} in stock for ${l.name}.`)
    }
    setSaving(true)
    try {
      const payload = {
        date: todayISO(),
        patientId: billPatient?.id || '',
        patient: billPatient?.name || 'Walk-in Customer',
        patientCode: billPatient?.code || '',
        lines: cart.map((l) => ({
          itemId: l.itemId, code: l.code, name: l.name, batch: l.batch,
          qty: l.qty, price: l.price, gst: l.gst, amount: +(l.qty * l.price).toFixed(2),
        })),
        items: cart.reduce((s, l) => s + l.qty, 0),
        subtotal: +subtotal.toFixed(2),
        gst: +gstTotal.toFixed(2),
        discount: discountNum,
        total: +grandTotal.toFixed(2),
        mode,
        status: 'Paid',
      }
      const bill = await api.post<Doc>('/api/pharmacy_bills', payload)
      await Promise.all(
        cart.map((l) =>
          api.patch(`/api/pharmacy_items/${l.itemId}`, { stock: Number(itemById[l.itemId].stock ?? 0) - l.qty }),
        ),
      )
      qc.invalidateQueries({ queryKey: ['pharmacy_items'] })
      qc.invalidateQueries({ queryKey: ['pharmacy_bills'] })
      toast.success(`Bill ${bill.number} issued · ${fmtINR(bill.total)}`)
      setCart([]); setDiscount(''); setBillPatient(null); setMode(MODES[0])
      setViewBill(bill)
    } catch (e) {
      toast.error((e as Error).message || 'Could not complete the sale.')
    } finally {
      setSaving(false)
    }
  }

  // ----- Tables -----
  const stockColumns: Column<Doc>[] = [
    {
      key: 'item', header: 'Item',
      cell: (r) => (
        <div>
          <div className="text-sm font-semibold text-slate-800">{r.name}</div>
          <div className="text-xs text-slate-400">{r.code} · {r.category}</div>
        </div>
      ),
    },
    { key: 'batch', header: 'Batch', cell: (r) => <span className="text-[13px] text-slate-600">{r.batch || '—'}</span> },
    { key: 'expiry', header: 'Expiry', cell: (r) => <span className="text-[13px] text-slate-600">{fmtDate(r.expiry)}</span> },
    {
      key: 'stock', header: 'Stock', align: 'center',
      cell: (r) => <span className="text-sm font-bold text-slate-800">{r.stock ?? 0}</span>,
    },
    { key: 'reorder', header: 'Reorder', align: 'center', cell: (r) => <span className="text-[13px] text-slate-500">{r.reorder ?? 0}</span> },
    { key: 'sale', header: 'Sale Price', align: 'right', cell: (r) => <span className="text-[13px] font-semibold text-slate-700">{money2(r.salePrice)}</span> },
    {
      key: 'status', header: 'Status',
      cell: (r) => { const s = stockStatus(r); return <Badge tone={stockTone(s)} dot>{s}</Badge> },
    },
    {
      key: 'actions', header: '', align: 'right',
      cell: (r) => (
        <Button variant="ghost" size="icon-sm" className="text-red-500 hover:bg-red-50" aria-label="Delete item"
          onClick={(e) => { e.stopPropagation(); setDeleting(r) }}>
          <Trash2 className="h-4 w-4" />
        </Button>
      ),
    },
  ]

  const billColumns: Column<Doc>[] = [
    {
      key: 'number', header: 'Bill',
      cell: (r) => (
        <div>
          <div className="text-[13px] font-semibold text-brand-700">{r.number}</div>
          <div className="text-xs text-slate-400">{fmtDate(r.date)}</div>
        </div>
      ),
    },
    { key: 'patient', header: 'Patient', cell: (r) => <span className="text-sm font-medium text-slate-800">{r.patient}</span> },
    { key: 'items', header: 'Items', align: 'center', cell: (r) => <Badge tone="slate">{r.items ?? (Array.isArray(r.lines) ? r.lines.length : 0)}</Badge> },
    { key: 'total', header: 'Total', align: 'right', cell: (r) => <span className="text-sm font-bold text-slate-800">{money2(r.total)}</span> },
    { key: 'mode', header: 'Mode', cell: (r) => <Badge tone="blue">{r.mode}</Badge> },
    {
      key: 'actions', header: '', align: 'right',
      cell: (r) => (
        <Button variant="ghost" size="icon-sm" aria-label="View bill" onClick={(e) => { e.stopPropagation(); setViewBill(r) }}>
          <Eye className="h-4 w-4" />
        </Button>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Pharmacy"
        subtitle="Medicine stock, dispensing and pharmacy billing"
        actions={
          <>
            <Button variant="secondary" onClick={() => setTab('dispense')}>
              <ShoppingCart className="h-4 w-4" /> Dispense
            </Button>
            <Button onClick={() => { setEditing(null); setItemOpen(true) }}>
              <PackagePlus className="h-4 w-4" /> Add Item
            </Button>
          </>
        }
      />

      {/* KPIs */}
      <div className="mb-4 grid grid-cols-2 gap-2.5 sm:grid-cols-5 sm:gap-3">
        <StatCard label="Total items" value={kpis.total} icon={<Boxes className="h-5 w-5" />} onClick={() => { setTab('stock'); setFilter('') }} />
        <StatCard label="In stock" value={kpis.inStock} icon={<Pill className="h-5 w-5" />} accent="green" onClick={() => { setTab('stock'); setFilter('') }} />
        <StatCard label="Low stock" value={kpis.low} icon={<AlertTriangle className="h-5 w-5" />} accent="amber" onClick={() => { setTab('stock'); setFilter('low') }} />
        <StatCard label="Out of stock" value={kpis.out} icon={<PackageX className="h-5 w-5" />} accent="red" onClick={() => { setTab('stock'); setFilter('out') }} />
        <StatCard label="Stock value" value={fmtINR(kpis.value)} icon={<IndianRupee className="h-5 w-5" />} accent="blue" className="col-span-2 sm:col-span-1" />
      </div>

      <Tabs
        className="mb-4"
        value={tab}
        onChange={(k) => setTab(k as typeof tab)}
        tabs={[
          { key: 'stock', label: 'Stock', count: kpis.total },
          { key: 'dispense', label: 'Dispense', count: cart.length || undefined },
          { key: 'bills', label: 'Bills', count: billsQ.data?.total },
        ]}
      />

      {/* ---------- STOCK ---------- */}
      {tab === 'stock' && (
        <Card>
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-3 sm:px-5">
            <SearchInput value={q} onChange={setQ} placeholder="Search medicine, code, batch…" className="min-w-0 flex-1 sm:max-w-sm" />
            <Select value={filter} onChange={(e) => setFilter(e.target.value)} className="w-36">
              <option value="">All Stock</option>
              <option value="low">Low Stock</option>
              <option value="out">Out of Stock</option>
            </Select>
          </div>
          <DataTable
            rows={filteredStock}
            columns={stockColumns}
            rowKey={(r) => r.id}
            loading={itemsQ.isLoading}
            onRowClick={(r) => { setEditing(r); setItemOpen(true) }}
            empty={
              <EmptyState
                icon={<Boxes className="h-6 w-6" />}
                title={q || filter ? 'No items match the filters' : 'No stock items yet'}
                message={q || filter ? 'Try a different name or stock filter.' : 'Add your first medicine to the pharmacy stock.'}
                action={
                  <Button size="sm" onClick={() => { setEditing(null); setItemOpen(true) }}>
                    <PackagePlus className="h-4 w-4" /> Add Item
                  </Button>
                }
              />
            }
            mobileCard={(r) => {
              const s = stockStatus(r)
              return (
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-semibold text-slate-800">{r.name}</span>
                      <Badge tone={stockTone(s)} dot>{s}</Badge>
                    </div>
                    <div className="truncate text-xs text-slate-500">
                      {r.code} · {r.category} · Batch {r.batch || '—'} · Exp {fmtDate(r.expiry)}
                    </div>
                    <div className="mt-0.5 text-xs text-slate-500">
                      Stock <span className="font-bold text-slate-800">{r.stock ?? 0}</span> / reorder {r.reorder ?? 0} · {money2(r.salePrice)}
                    </div>
                  </div>
                  <Button variant="ghost" size="icon-sm" className="shrink-0 text-red-500" aria-label="Delete item"
                    onClick={(e) => { e.stopPropagation(); setDeleting(r) }}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )
            }}
          />
        </Card>
      )}

      {/* ---------- DISPENSE (POS) ---------- */}
      {tab === 'dispense' && (
        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[1fr_380px]">
          <Card>
            <div className="border-b border-slate-100 px-4 py-3 sm:px-5">
              <SearchInput value={posQ} onChange={setPosQ} placeholder="Search medicine to add…" className="sm:max-w-sm" />
            </div>
            {itemsQ.isLoading ? (
              <ListSkeleton rows={6} />
            ) : !posItems.length ? (
              <EmptyState icon={<Pill className="h-6 w-6" />} title="No medicines found" message="Try a different search, or add items in the Stock tab." />
            ) : (
              <div className="grid grid-cols-1 gap-2 p-3 sm:grid-cols-2 xl:grid-cols-3">
                {posItems.map((it) => {
                  const s = stockStatus(it)
                  const out = s === 'Out of Stock'
                  return (
                    <button
                      key={it.id}
                      onClick={() => addToCart(it)}
                      disabled={out}
                      className={`rounded-xl border p-3 text-left transition ${
                        out
                          ? 'cursor-not-allowed border-slate-100 bg-slate-50 opacity-60'
                          : 'border-slate-200 bg-white hover:border-brand-300 hover:shadow-sm'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="truncate text-sm font-semibold text-slate-800">{it.name}</span>
                        <Badge tone={stockTone(s)}>{out ? 'Out' : it.stock}</Badge>
                      </div>
                      <div className="mt-0.5 truncate text-xs text-slate-500">
                        {it.category} · Batch {it.batch || '—'}
                      </div>
                      <div className="mt-1.5 flex items-center justify-between">
                        <span className="text-sm font-bold text-slate-900">{money2(it.salePrice)}</span>
                        <span className="text-[11px] text-slate-400">GST {it.gst ?? 0}%</span>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </Card>

          {/* Cart */}
          <Card className="lg:sticky lg:top-4">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <h3 className="flex items-center gap-2 text-[15px] font-semibold text-slate-900">
                <ShoppingCart className="h-4 w-4 text-brand-600" /> Pharmacy Bill
              </h3>
              {cart.length > 0 && (
                <Button variant="ghost" size="sm" className="text-slate-400" onClick={() => setCart([])}>Clear</Button>
              )}
            </div>
            <div className="space-y-3 p-4">
              <Field label="Patient (optional)">
                <PatientPicker value={billPatient} onSelect={setBillPatient} onClear={() => setBillPatient(null)} placeholder="Walk-in / search patient…" />
              </Field>

              {!cart.length ? (
                <p className="rounded-lg bg-slate-50 px-3 py-6 text-center text-[13px] text-slate-400">
                  Tap a medicine to add it to the bill.
                </p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {cart.map((l) => (
                    <li key={l.itemId} className="flex items-center gap-2 py-2">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13px] font-semibold text-slate-800">{l.name}</div>
                        <div className="text-[11px] text-slate-400">
                          {money2(l.price)} · GST {l.gst}% · {l.stock} in stock
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button variant="outline" size="icon-sm" aria-label="Decrease" onClick={() => setQty(l.itemId, l.qty - 1)}>
                          <Minus className="h-3.5 w-3.5" />
                        </Button>
                        <Input
                          type="number" min={1} max={l.stock} value={l.qty}
                          onChange={(e) => setQty(l.itemId, Number(e.target.value))}
                          className="h-8 w-14 px-1 text-center"
                        />
                        <Button variant="outline" size="icon-sm" aria-label="Increase" onClick={() => setQty(l.itemId, l.qty + 1)}>
                          <Plus className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      <span className="w-20 text-right text-[13px] font-bold text-slate-800">{money2(l.qty * l.price)}</span>
                      <Button variant="ghost" size="icon-sm" className="text-slate-300 hover:text-red-600" aria-label="Remove"
                        onClick={() => setCart((ls) => ls.filter((x) => x.itemId !== l.itemId))}>
                        <X className="h-4 w-4" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}

              <div className="space-y-1.5 rounded-xl bg-slate-50 p-3 text-[13px]">
                <div className="flex justify-between text-slate-600"><span>Subtotal</span><span>{money2(subtotal)}</span></div>
                <div className="flex justify-between text-slate-600"><span>GST</span><span>{money2(gstTotal)}</span></div>
                <div className="flex items-center justify-between text-slate-600">
                  <span>Discount (₹)</span>
                  <Input type="number" min={0} value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="0" className="h-8 w-24 text-right" />
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-2 text-[15px] font-bold text-slate-900">
                  <span>Total</span><span>{money2(grandTotal)}</span>
                </div>
              </div>

              <Field label="Payment Mode">
                <Select value={mode} onChange={(e) => setMode(e.target.value)}>
                  {MODES.map((m) => <option key={m}>{m}</option>)}
                </Select>
              </Field>

              <Button className="w-full" size="lg" onClick={completeSale} loading={saving} disabled={!cart.length}>
                <Receipt className="h-4 w-4" /> Complete Sale · {money2(grandTotal)}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* ---------- BILLS ---------- */}
      {tab === 'bills' && (
        <Card>
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-3 sm:px-5">
            <SearchInput value={billQ} onChange={setBillQ} placeholder="Search bill number or patient…" className="min-w-0 flex-1 sm:max-w-sm" />
          </div>
          <DataTable
            rows={bills}
            columns={billColumns}
            rowKey={(r) => r.id}
            loading={billsQ.isLoading}
            onRowClick={(r) => setViewBill(r)}
            empty={
              <EmptyState
                icon={<Receipt className="h-6 w-6" />}
                title={billQ ? 'No bills match your search' : 'No pharmacy bills yet'}
                message={billQ ? 'Try a different bill number or patient name.' : 'Completed sales from the Dispense tab will appear here.'}
                action={
                  <Button size="sm" onClick={() => setTab('dispense')}>
                    <ShoppingCart className="h-4 w-4" /> Start a Sale
                  </Button>
                }
              />
            }
            mobileCard={(r) => (
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-semibold text-brand-700">{r.number}</span>
                    <Badge tone="blue">{r.mode}</Badge>
                  </div>
                  <div className="truncate text-xs text-slate-500">
                    {fmtDate(r.date)} · {r.patient} · {r.items ?? (Array.isArray(r.lines) ? r.lines.length : 0)} items
                  </div>
                </div>
                <span className="text-sm font-bold text-slate-800">{money2(r.total)}</span>
              </div>
            )}
          />
        </Card>
      )}

      {/* Bill detail / receipt */}
      <Dialog
        open={!!viewBill}
        onClose={() => setViewBill(null)}
        title="Pharmacy Bill"
        subtitle={viewBill ? `${viewBill.number} · ${fmtDate(viewBill.date)} · ${viewBill.patient}` : undefined}
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setViewBill(null)}>Close</Button>
            <Button onClick={() => viewBill && openPrintWindow(billReceiptHTML(viewBill), String(viewBill.number || 'Bill'))}>
              <Printer className="h-4 w-4" /> Print Receipt
            </Button>
          </>
        }
      >
        {viewBill && (
          <div className="overflow-x-auto rounded-xl bg-slate-100 p-2 sm:p-4">
            <div dangerouslySetInnerHTML={{ __html: billReceiptHTML(viewBill) }} />
          </div>
        )}
      </Dialog>

      <ItemDialog open={itemOpen} onClose={() => setItemOpen(false)} editing={editing} />

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) deleteItem.mutate(deleting.id, { onSuccess: () => setDeleting(null) })
        }}
        loading={deleteItem.isPending}
        title="Delete this stock item?"
        message={deleting ? `${deleting.code} · ${deleting.name}. Past bills are kept, but the item will no longer be sellable.` : ''}
        confirmLabel="Delete Item"
      />
    </div>
  )
}
