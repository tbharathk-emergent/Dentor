import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  AlertTriangle,
  ArrowLeftRight,
  Boxes,
  CalendarClock,
  IndianRupee,
  PackageCheck,
  PackageX,
  Pencil,
  Plus,
  ShoppingCart,
  Trash2,
  Truck,
} from 'lucide-react'
import { toast } from 'sonner'
import { fmtDate, fmtINR, todayISO, useCreate, useDelete, useList, useUpdate, type Doc } from '@/lib/hooks'
import { Badge, StatusBadge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { ConfirmDialog, Dialog } from '@/components/ui/Dialog'
import { Field, Input, Select } from '@/components/ui/Field'
import { Tabs } from '@/components/ui/Tabs'
import { EmptyState, PageHeader, SearchInput, StatCard } from '@/components/ui/bits'
import { cn } from '@/lib/cn'

const CATEGORIES = [
  'Clinical Consumables', 'Restorative Materials', 'Endodontics', 'Implantology',
  'PPE', 'Dental Lab', 'Stationery', 'Housekeeping',
]
const GST_RATES = [0, 5, 12, 18]
const MOVEMENT_TYPES = ['Issue', 'Transfer', 'Adjustment'] as const
const REASONS = [
  'Clinical Consumption', 'Internal Transfer', 'Physical Count Variance',
  'Damage / Breakage', 'Expired', 'Return to Supplier',
]
const CREDIT_TERMS = ['Immediate', '15 Days', '30 Days', '45 Days', '60 Days']

const stockStatus = (i: Doc) =>
  Number(i.stock || 0) <= 0 ? 'Out of Stock' : Number(i.stock) <= Number(i.reorder || 0) ? 'Low Stock' : 'Available'

const purchaseTotal = (qty: number, rate: number, disc: number, gst: number) =>
  Math.round(qty * rate * (1 - disc / 100) * (1 + gst / 100))

const movementRef = (type: string) =>
  `${type.slice(0, 3).toUpperCase()}-${String(Date.now()).slice(-6)}`

/* ------------------------------------------------------------------ */
/* Item form dialog                                                   */
/* ------------------------------------------------------------------ */

interface ItemForm {
  name: string
  category: string
  unit: string
  stock: string
  reorder: string
  max: string
  batch: string
  expiry: string
  supplier: string
  cost: string
  location: string
  gst: string
}

const emptyItem: ItemForm = {
  name: '', category: CATEGORIES[0], unit: 'Piece', stock: '0', reorder: '5', max: '25',
  batch: '', expiry: '', supplier: '', cost: '0', location: 'Central Store', gst: '12',
}

function ItemFormDialog({
  open,
  onClose,
  editing,
  suppliers,
}: {
  open: boolean
  onClose: () => void
  editing?: Doc | null
  suppliers: Doc[]
}) {
  const [form, setForm] = useState<ItemForm>(emptyItem)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const create = useCreate('inventory_items')
  const update = useUpdate('inventory_items', { successMessage: 'Inventory item updated' })

  useEffect(() => {
    if (open) {
      setErrors({})
      setForm(
        editing
          ? {
              name: editing.name || '', category: editing.category || CATEGORIES[0],
              unit: editing.unit || 'Piece', stock: String(editing.stock ?? 0),
              reorder: String(editing.reorder ?? 5), max: String(editing.max ?? 25),
              batch: editing.batch || '',
              expiry: editing.expiry && editing.expiry !== 'No Expiry' ? editing.expiry : '',
              supplier: editing.supplier || '', cost: String(editing.cost ?? 0),
              location: editing.location || 'Central Store', gst: String(editing.gst ?? 12),
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
    if (!form.name.trim()) errs.name = 'Enter the item name.'
    if (form.stock === '' || Number(form.stock) < 0) errs.stock = 'Stock cannot be negative.'
    if (form.cost === '' || Number(form.cost) < 0) errs.cost = 'Enter a valid unit cost.'
    setErrors(errs)
    if (Object.keys(errs).length) return

    const payload = {
      name: form.name.trim(),
      category: form.category,
      unit: form.unit.trim() || 'Piece',
      stock: Number(form.stock),
      reorder: Number(form.reorder || 0),
      max: Number(form.max || 0),
      batch: form.batch.trim(),
      expiry: form.expiry || 'No Expiry',
      supplier: form.supplier,
      cost: Number(form.cost),
      location: form.location.trim() || 'Central Store',
      gst: Number(form.gst),
    }
    if (editing) {
      update.mutate({ id: editing.id, ...payload }, { onSuccess: onClose })
    } else {
      create.mutate(payload as Partial<Doc>, {
        onSuccess: (i) => { onClose(); toast.success(`${(i as Doc).code} added to inventory`) },
      })
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={editing ? 'Edit Inventory Item' : 'Add Inventory Item'}
      subtitle={editing ? `${editing.code} · ${editing.name}` : 'Item master, batch and stock controls.'}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit as never} loading={create.isPending || update.isPending}>
            {editing ? 'Save Changes' : 'Save Item'}
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Item Name" required error={errors.name} className="sm:col-span-2">
          <Input value={form.name} onChange={set('name')} placeholder="e.g. Composite Restorative A2" autoFocus />
        </Field>
        <Field label="Category">
          <Select value={form.category} onChange={set('category')}>
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </Select>
        </Field>
        <Field label="Unit of Measure">
          <Input value={form.unit} onChange={set('unit')} placeholder="Piece, Box, Pack…" />
        </Field>
        <Field label={editing ? 'Current Stock' : 'Opening Stock'} error={errors.stock}>
          <Input type="number" min={0} value={form.stock} onChange={set('stock')} />
        </Field>
        <Field label="Reorder Level">
          <Input type="number" min={0} value={form.reorder} onChange={set('reorder')} />
        </Field>
        <Field label="Maximum Stock">
          <Input type="number" min={0} value={form.max} onChange={set('max')} />
        </Field>
        <Field label="Batch / Lot">
          <Input value={form.batch} onChange={set('batch')} placeholder="e.g. CR26114" />
        </Field>
        <Field label="Expiry Date" hint="Leave empty for items without expiry.">
          <Input type="date" value={form.expiry} onChange={set('expiry')} />
        </Field>
        <Field label="Supplier">
          <Select value={form.supplier} onChange={set('supplier')}>
            <option value="">Not assigned</option>
            {suppliers.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
          </Select>
        </Field>
        <Field label="Purchase Cost (₹)" error={errors.cost}>
          <Input type="number" min={0} value={form.cost} onChange={set('cost')} />
        </Field>
        <Field label="GST %">
          <Select value={form.gst} onChange={set('gst')}>
            {GST_RATES.map((g) => <option key={g} value={g}>{g}%</option>)}
          </Select>
        </Field>
        <Field label="Storage Location" className="sm:col-span-2">
          <Input value={form.location} onChange={set('location')} placeholder="Central Store" />
        </Field>
        <button type="submit" className="hidden" />
      </form>
    </Dialog>
  )
}

/* ------------------------------------------------------------------ */
/* Movement dialog                                                    */
/* ------------------------------------------------------------------ */

function MovementDialog({
  open,
  onClose,
  items,
  presetItemId,
}: {
  open: boolean
  onClose: () => void
  items: Doc[]
  presetItemId?: string
}) {
  const [form, setForm] = useState({
    type: 'Issue' as (typeof MOVEMENT_TYPES)[number] | string,
    itemId: '', qty: '', from: 'Central Store', to: '',
    reason: REASONS[0], authorizedBy: 'Dr. Admin',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const createMovement = useCreate('inventory_movements')
  const updateItem = useUpdate('inventory_items')

  useEffect(() => {
    if (open) {
      setErrors({})
      setForm({
        type: 'Issue', itemId: presetItemId || '', qty: '', from: 'Central Store', to: '',
        reason: REASONS[0], authorizedBy: 'Dr. Admin',
      })
    }
  }, [open, presetItemId])

  const item = items.find((i) => i.id === form.itemId)
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  const isAdjustment = form.type === 'Adjustment'
  const qty = Number(form.qty || 0)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (!item) errs.itemId = 'Choose the inventory item.'
    if (!form.qty || qty === 0) errs.qty = 'Enter the quantity.'
    else if (!isAdjustment && qty < 0) errs.qty = 'Quantity must be positive.'
    if (item && !errs.qty) {
      const stock = Number(item.stock || 0)
      if (!isAdjustment && qty > stock)
        errs.qty = `Insufficient stock — only ${stock} ${item.unit || 'unit'} of ${item.name} available.`
      if (isAdjustment && stock + qty < 0)
        errs.qty = `Adjustment of ${qty} would take ${item.name} below zero (current stock ${stock}).`
    }
    setErrors(errs)
    if (Object.keys(errs).length || !item) return

    const newStock = isAdjustment ? Number(item.stock || 0) + qty : Number(item.stock || 0) - qty
    const payload = {
      date: todayISO(),
      type: form.type,
      item: item.name,
      itemId: item.id,
      itemCode: item.code,
      reference: movementRef(form.type),
      department: form.to.trim() || 'Internal',
      from: form.from.trim() || 'Central Store',
      to: form.to.trim(),
      qty,
      unit: item.unit,
      status: 'Posted',
      authorizedBy: form.authorizedBy.trim() || 'Dr. Admin',
      reason: form.reason,
    }
    try {
      await createMovement.mutateAsync(payload as Partial<Doc>)
      await updateItem.mutateAsync({ id: item.id, stock: newStock })
      toast.success(`${form.type} posted — ${item.name} stock is now ${newStock}`)
      onClose()
    } catch {
      /* errors are toasted by the hooks */
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="New Stock Movement"
      subtitle="Auditable inventory movement entry."
      size="md"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit as never} loading={createMovement.isPending || updateItem.isPending}>
            Post {form.type}
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Movement Type">
          <Select value={form.type} onChange={set('type')}>
            {MOVEMENT_TYPES.map((t) => <option key={t}>{t}</option>)}
          </Select>
        </Field>
        <Field label="Item" required error={errors.itemId}>
          <Select value={form.itemId} onChange={set('itemId')}>
            <option value="">Choose item…</option>
            {items.map((i) => (
              <option key={i.id} value={i.id}>{i.name} · Available {i.stock ?? 0}</option>
            ))}
          </Select>
        </Field>
        <Field
          label={isAdjustment ? 'Quantity (+ adds, − removes)' : 'Quantity'}
          required
          error={errors.qty}
          hint={item ? `Available: ${item.stock ?? 0} ${item.unit || ''}` : undefined}
        >
          <Input type="number" min={isAdjustment ? undefined : 1} value={form.qty} onChange={set('qty')} placeholder={isAdjustment ? 'e.g. -2 or 5' : 'e.g. 5'} />
        </Field>
        <Field label="Reason">
          <Select value={form.reason} onChange={set('reason')}>
            {REASONS.map((r) => <option key={r}>{r}</option>)}
          </Select>
        </Field>
        <Field label="From Location">
          <Input value={form.from} onChange={set('from')} />
        </Field>
        <Field label="To / Department">
          <Input value={form.to} onChange={set('to')} placeholder="Chair, department or location" />
        </Field>
        <Field label="Authorized By" className="sm:col-span-2">
          <Input value={form.authorizedBy} onChange={set('authorizedBy')} />
        </Field>
        <button type="submit" className="hidden" />
      </form>
    </Dialog>
  )
}

/* ------------------------------------------------------------------ */
/* Purchase dialog                                                    */
/* ------------------------------------------------------------------ */

function PurchaseDialog({
  open,
  onClose,
  items,
  suppliers,
}: {
  open: boolean
  onClose: () => void
  items: Doc[]
  suppliers: Doc[]
}) {
  const [form, setForm] = useState({
    supplier: '', invoice: '', date: todayISO(), itemId: '',
    qty: '1', rate: '0', disc: '0', gst: '12',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const create = useCreate('inventory_purchases')

  useEffect(() => {
    if (open) {
      setErrors({})
      setForm({
        supplier: suppliers[0]?.name || '', invoice: '', date: todayISO(), itemId: '',
        qty: '1', rate: '0', disc: '0', gst: '12',
      })
    }
  }, [open, suppliers])

  const item = items.find((i) => i.id === form.itemId)
  const total = purchaseTotal(Number(form.qty || 0), Number(form.rate || 0), Number(form.disc || 0), Number(form.gst || 0))

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  const chooseItem = (e: { target: { value: string } }) => {
    const it = items.find((i) => i.id === e.target.value)
    setForm((f) => ({
      ...f,
      itemId: e.target.value,
      rate: it ? String(it.cost ?? 0) : f.rate,
      gst: it ? String(it.gst ?? 12) : f.gst,
    }))
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (!form.supplier) errs.supplier = 'Choose the supplier.'
    if (!form.invoice.trim()) errs.invoice = 'Enter the supplier invoice number.'
    if (!item) errs.itemId = 'Choose the item being purchased.'
    if (!form.qty || Number(form.qty) <= 0) errs.qty = 'Enter a valid quantity.'
    if (form.rate === '' || Number(form.rate) < 0) errs.rate = 'Enter a valid rate.'
    setErrors(errs)
    if (Object.keys(errs).length || !item) return

    const payload = {
      date: form.date,
      supplier: form.supplier,
      invoice: form.invoice.trim(),
      item: item.name,
      itemId: item.id,
      itemCode: item.code,
      qty: Number(form.qty),
      rate: Number(form.rate),
      discount: Number(form.disc || 0),
      gst: Number(form.gst || 0),
      total,
      status: 'Ordered',
    }
    create.mutate(payload as Partial<Doc>, {
      onSuccess: (p) => { onClose(); toast.success(`Purchase ${(p as Doc).code} saved`) },
    })
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="New Purchase"
      subtitle="Supplier purchase order — receive it later to post stock."
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit as never} loading={create.isPending}>
            <ShoppingCart className="h-4 w-4" /> Save Purchase
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Supplier" required error={errors.supplier}>
          <Select value={form.supplier} onChange={set('supplier')}>
            <option value="">Choose supplier…</option>
            {suppliers.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
          </Select>
        </Field>
        <Field label="Supplier Invoice" required error={errors.invoice}>
          <Input value={form.invoice} onChange={set('invoice')} placeholder="e.g. MP-8821" />
        </Field>
        <Field label="Invoice Date">
          <Input type="date" value={form.date} onChange={set('date')} />
        </Field>
        <Field label="Item" required error={errors.itemId}>
          <Select value={form.itemId} onChange={chooseItem}>
            <option value="">Choose item…</option>
            {items.map((i) => <option key={i.id} value={i.id}>{i.name} · {i.code}</option>)}
          </Select>
        </Field>
        <Field label="Quantity" required error={errors.qty}>
          <Input type="number" min={1} value={form.qty} onChange={set('qty')} />
        </Field>
        <Field label="Rate (₹)" required error={errors.rate}>
          <Input type="number" min={0} value={form.rate} onChange={set('rate')} />
        </Field>
        <Field label="Discount %">
          <Input type="number" min={0} max={100} value={form.disc} onChange={set('disc')} />
        </Field>
        <Field label="GST %">
          <Select value={form.gst} onChange={set('gst')}>
            {GST_RATES.map((g) => <option key={g} value={g}>{g}%</option>)}
          </Select>
        </Field>
        <div className="flex items-center justify-between rounded-lg bg-slate-900 px-4 py-3 text-white sm:col-span-2">
          <span className="text-[13px] font-medium text-slate-300">Invoice total (incl. GST, less discount)</span>
          <span className="text-lg font-bold">{fmtINR(total)}</span>
        </div>
        <button type="submit" className="hidden" />
      </form>
    </Dialog>
  )
}

/* ------------------------------------------------------------------ */
/* Supplier form dialog                                               */
/* ------------------------------------------------------------------ */

function SupplierFormDialog({
  open,
  onClose,
  editing,
}: {
  open: boolean
  onClose: () => void
  editing?: Doc | null
}) {
  const [form, setForm] = useState({
    name: '', gstin: '', contact: '', city: '', credit: '30 Days', balance: '0', status: 'Active',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const create = useCreate('inventory_suppliers')
  const update = useUpdate('inventory_suppliers', { successMessage: 'Supplier updated' })

  useEffect(() => {
    if (open) {
      setErrors({})
      setForm({
        name: editing?.name || '', gstin: editing?.gstin || '', contact: editing?.contact || '',
        city: editing?.city || '', credit: editing?.credit || '30 Days',
        balance: String(editing?.balance ?? 0), status: editing?.status || 'Active',
      })
    }
  }, [open, editing])

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (!form.name.trim()) errs.name = 'Enter the supplier name.'
    setErrors(errs)
    if (Object.keys(errs).length) return
    const payload = {
      name: form.name.trim(),
      gstin: form.gstin.trim() || '—',
      contact: form.contact.trim() || '—',
      city: form.city.trim() || '—',
      credit: form.credit,
      balance: Number(form.balance || 0),
      status: form.status,
    }
    if (editing) update.mutate({ id: editing.id, ...payload }, { onSuccess: onClose })
    else
      create.mutate(payload as Partial<Doc>, {
        onSuccess: (s) => { onClose(); toast.success(`Supplier ${(s as Doc).code} added`) },
      })
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={editing ? 'Edit Supplier' : 'Add Supplier'}
      subtitle={editing ? `${editing.code} · ${editing.name}` : 'Supplier master with GST and credit controls.'}
      size="md"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit as never} loading={create.isPending || update.isPending}>
            {editing ? 'Save Changes' : 'Save Supplier'}
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Supplier Name" required error={errors.name} className="sm:col-span-2">
          <Input value={form.name} onChange={set('name')} placeholder="e.g. Medident Supplies" autoFocus />
        </Field>
        <Field label="GSTIN">
          <Input value={form.gstin} onChange={set('gstin')} placeholder="33ABCDE1234F1Z5" />
        </Field>
        <Field label="Contact Number">
          <Input inputMode="numeric" value={form.contact} onChange={set('contact')} placeholder="10-digit mobile" />
        </Field>
        <Field label="City">
          <Input value={form.city} onChange={set('city')} placeholder="e.g. Chennai" />
        </Field>
        <Field label="Credit Terms">
          <Select value={form.credit} onChange={set('credit')}>
            {CREDIT_TERMS.map((c) => <option key={c}>{c}</option>)}
          </Select>
        </Field>
        <Field label="Opening Balance (₹)">
          <Input type="number" min={0} value={form.balance} onChange={set('balance')} />
        </Field>
        <Field label="Status">
          <Select value={form.status} onChange={set('status')}>
            {['Active', 'Inactive'].map((s) => <option key={s}>{s}</option>)}
          </Select>
        </Field>
        <button type="submit" className="hidden" />
      </form>
    </Dialog>
  )
}

/* ------------------------------------------------------------------ */
/* Page                                                               */
/* ------------------------------------------------------------------ */

export default function Inventory() {
  const [tab, setTab] = useState<'items' | 'movements' | 'purchases' | 'suppliers'>('items')
  const [q, setQ] = useState('')
  const [category, setCategory] = useState('')
  const [stockFilter, setStockFilter] = useState('')
  const [moveType, setMoveType] = useState('')

  const [itemFormOpen, setItemFormOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<Doc | null>(null)
  const [deleteItem, setDeleteItem] = useState<Doc | null>(null)
  const [movementOpen, setMovementOpen] = useState(false)
  const [purchaseOpen, setPurchaseOpen] = useState(false)
  const [supplierFormOpen, setSupplierFormOpen] = useState(false)
  const [editingSupplier, setEditingSupplier] = useState<Doc | null>(null)
  const [deleteSupplier, setDeleteSupplier] = useState<Doc | null>(null)
  const [receiving, setReceiving] = useState<string | null>(null)

  const { data: itemData, isLoading: itemsLoading } = useList('inventory_items', {
    q: tab === 'items' ? q : '', ...(category ? { category } : {}), sort: 'created_at', order: 'desc', limit: 500,
  })
  const items = itemData?.items ?? []
  const { data: supplierData, isLoading: suppliersLoading } = useList('inventory_suppliers', {
    q: tab === 'suppliers' ? q : '', sort: 'created_at', order: 'desc', limit: 200,
  })
  const suppliers = supplierData?.items ?? []
  const { data: movementData, isLoading: movementsLoading } = useList('inventory_movements', {
    q: tab === 'movements' ? q : '', ...(moveType ? { type: moveType } : {}),
    sort: 'created_at', order: 'desc', limit: 500,
  })
  const movements = movementData?.items ?? []
  const { data: purchaseData, isLoading: purchasesLoading } = useList('inventory_purchases', {
    q: tab === 'purchases' ? q : '', sort: 'created_at', order: 'desc', limit: 500,
  })
  const purchases = purchaseData?.items ?? []

  const delItem = useDelete('inventory_items', { successMessage: 'Inventory item deleted' })
  const delSupplier = useDelete('inventory_suppliers', { successMessage: 'Supplier deleted' })
  const updateItem = useUpdate('inventory_items')
  const updatePurchase = useUpdate('inventory_purchases')
  const createMovement = useCreate('inventory_movements')

  const kpis = useMemo(() => {
    const total = itemData?.total ?? items.length
    const low = items.filter((i) => Number(i.stock || 0) > 0 && Number(i.stock) <= Number(i.reorder || 0)).length
    const out = items.filter((i) => Number(i.stock || 0) <= 0).length
    const value = items.reduce((s, i) => s + Number(i.stock || 0) * Number(i.cost || 0), 0)
    const horizon = Date.now() + 180 * 86400000
    const expiring = items.filter((i) => {
      if (!i.expiry || i.expiry === 'No Expiry') return false
      const d = new Date(i.expiry)
      return !isNaN(d.getTime()) && d.getTime() <= horizon
    }).length
    return { total, low, out, value, expiring }
  }, [items, itemData])

  const filteredItems = useMemo(
    () => items.filter((i) => !stockFilter || stockStatus(i) === stockFilter),
    [items, stockFilter],
  )

  const receive = async (p: Doc) => {
    const item = items.find((i) => i.id === p.itemId)
    setReceiving(p.id)
    try {
      await updatePurchase.mutateAsync({ id: p.id, status: 'Received', receivedDate: todayISO() })
      if (item) {
        await updateItem.mutateAsync({ id: item.id, stock: Number(item.stock || 0) + Number(p.qty || 0) })
        await createMovement.mutateAsync({
          date: todayISO(), type: 'Receipt', item: item.name, itemId: item.id, itemCode: item.code,
          reference: p.code, department: 'Central Store', from: p.supplier, to: item.location || 'Central Store',
          qty: Number(p.qty || 0), unit: item.unit, status: 'Posted', reason: 'Goods Receipt',
          authorizedBy: 'Dr. Admin',
        } as Partial<Doc>)
      }
      toast.success(`Goods received for ${p.code}${item ? ` — ${item.name} stock updated` : ''}`)
    } catch {
      /* errors are toasted by the hooks */
    } finally {
      setReceiving(null)
    }
  }

  /* ----- columns ----- */

  const itemColumns: Column<Doc>[] = [
    {
      key: 'item',
      header: 'Item',
      cell: (i) => (
        <div>
          <div className="text-xs font-semibold text-brand-700">{i.code}</div>
          <div className="font-medium text-slate-800">{i.name}</div>
        </div>
      ),
    },
    {
      key: 'category',
      header: 'Category',
      cell: (i) => (
        <div>
          <div className="text-slate-700">{i.category}</div>
          <div className="text-xs text-slate-400">{i.unit}</div>
        </div>
      ),
    },
    {
      key: 'stock',
      header: 'Stock',
      cell: (i) => (
        <div>
          <span className="font-bold text-slate-800">{i.stock ?? 0}</span>
          <span className="text-xs text-slate-400"> / reorder {i.reorder ?? 0}</span>
        </div>
      ),
    },
    { key: 'status', header: 'Status', cell: (i) => <StatusBadge status={stockStatus(i)} /> },
    {
      key: 'batch',
      header: 'Batch / Expiry',
      cell: (i) => (
        <div>
          <div className="text-slate-700">{i.batch || '—'}</div>
          <div className="text-xs text-slate-400">{i.expiry === 'No Expiry' ? 'No Expiry' : fmtDate(i.expiry)}</div>
        </div>
      ),
    },
    {
      key: 'supplier',
      header: 'Supplier',
      cell: (i) => (
        <div>
          <div className="text-slate-700">{i.supplier || '—'}</div>
          <div className="text-xs text-slate-400">{i.location}</div>
        </div>
      ),
    },
    {
      key: 'cost',
      header: 'Cost',
      align: 'right',
      cell: (i) => (
        <div className="text-right">
          <div className="font-semibold text-slate-800">{fmtINR(i.cost)}</div>
          <div className="text-xs text-slate-400">GST {i.gst ?? 0}%</div>
        </div>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (i) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon-sm" aria-label="Edit item" onClick={(e) => { e.stopPropagation(); setEditingItem(i); setItemFormOpen(true) }}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon-sm" className="text-red-500 hover:bg-red-50" aria-label="Delete item" onClick={(e) => { e.stopPropagation(); setDeleteItem(i) }}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ]

  const movementColumns: Column<Doc>[] = [
    { key: 'date', header: 'Date', cell: (m) => <span className="whitespace-nowrap">{fmtDate(m.date)}</span> },
    {
      key: 'type',
      header: 'Type',
      cell: (m) => (
        <Badge tone={m.type === 'Receipt' ? 'green' : m.type === 'Issue' ? 'blue' : m.type === 'Transfer' ? 'violet' : 'amber'}>
          {m.type}
        </Badge>
      ),
    },
    {
      key: 'item',
      header: 'Item',
      cell: (m) => (
        <div>
          <div className="font-medium text-slate-800">{m.item}</div>
          <div className="text-xs text-slate-400">{m.reference}</div>
        </div>
      ),
    },
    {
      key: 'route',
      header: 'From → To',
      cell: (m) => (
        <span className="text-slate-600">{m.from || 'Store'} → {m.to || m.department || 'Internal'}</span>
      ),
    },
    {
      key: 'qty',
      header: 'Qty',
      align: 'right',
      cell: (m) => (
        <span className={cn('font-semibold', Number(m.qty) < 0 ? 'text-red-600' : 'text-slate-800')}>
          {Number(m.qty) > 0 && m.type === 'Adjustment' ? '+' : ''}{m.qty} {m.unit || ''}
        </span>
      ),
    },
    { key: 'reason', header: 'Reason', cell: (m) => <span className="text-slate-600">{m.reason || '—'}</span> },
    { key: 'by', header: 'Authorized By', cell: (m) => <span className="text-slate-600">{m.authorizedBy || '—'}</span> },
  ]

  const purchaseColumns: Column<Doc>[] = [
    {
      key: 'purchase',
      header: 'Purchase',
      cell: (p) => (
        <div>
          <div className="font-semibold text-brand-700">{p.code}</div>
          <div className="text-xs text-slate-400">{fmtDate(p.date)}</div>
        </div>
      ),
    },
    {
      key: 'supplier',
      header: 'Supplier',
      cell: (p) => (
        <div>
          <div className="text-slate-800">{p.supplier}</div>
          <div className="text-xs text-slate-400">Inv {p.invoice}</div>
        </div>
      ),
    },
    { key: 'items', header: 'Items', cell: (p) => <span className="text-slate-700">{p.item} × {p.qty}</span> },
    { key: 'total', header: 'Total', align: 'right', cell: (p) => <span className="font-semibold">{fmtINR(p.total)}</span> },
    { key: 'status', header: 'Status', cell: (p) => <StatusBadge status={p.status} /> },
    {
      key: 'action',
      header: '',
      align: 'right',
      cell: (p) =>
        p.status === 'Ordered' ? (
          <Button size="sm" variant="secondary" loading={receiving === p.id} onClick={(e) => { e.stopPropagation(); receive(p) }}>
            <PackageCheck className="h-3.5 w-3.5" /> Receive
          </Button>
        ) : (
          <span className="text-xs text-slate-400">{p.receivedDate ? `Recd ${fmtDate(p.receivedDate)}` : ''}</span>
        ),
    },
  ]

  const supplierColumns: Column<Doc>[] = [
    {
      key: 'supplier',
      header: 'Supplier',
      cell: (s) => (
        <div>
          <div className="font-medium text-slate-800">{s.name}</div>
          <div className="text-xs text-slate-400">{s.code}</div>
        </div>
      ),
    },
    { key: 'gstin', header: 'GSTIN', cell: (s) => <span className="text-slate-600">{s.gstin}</span> },
    {
      key: 'contact',
      header: 'Contact',
      cell: (s) => (
        <div>
          <div className="text-slate-700">{s.contact}</div>
          <div className="text-xs text-slate-400">{s.city}</div>
        </div>
      ),
    },
    { key: 'credit', header: 'Credit Terms', cell: (s) => <span className="text-slate-600">{s.credit}</span> },
    { key: 'balance', header: 'Balance', align: 'right', cell: (s) => <span className="font-semibold">{fmtINR(s.balance)}</span> },
    { key: 'status', header: 'Status', cell: (s) => <StatusBadge status={s.status} /> },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (s) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon-sm" aria-label="Edit supplier" onClick={(e) => { e.stopPropagation(); setEditingSupplier(s); setSupplierFormOpen(true) }}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon-sm" className="text-red-500 hover:bg-red-50" aria-label="Delete supplier" onClick={(e) => { e.stopPropagation(); setDeleteSupplier(s) }}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ]

  const headerAction =
    tab === 'movements' ? (
      <Button onClick={() => setMovementOpen(true)}>
        <ArrowLeftRight className="h-4 w-4" /> New Movement
      </Button>
    ) : tab === 'purchases' ? (
      <Button onClick={() => setPurchaseOpen(true)}>
        <Plus className="h-4 w-4" /> New Purchase
      </Button>
    ) : tab === 'suppliers' ? (
      <Button onClick={() => { setEditingSupplier(null); setSupplierFormOpen(true) }}>
        <Plus className="h-4 w-4" /> Add Supplier
      </Button>
    ) : (
      <Button onClick={() => { setEditingItem(null); setItemFormOpen(true) }}>
        <Plus className="h-4 w-4" /> Add Item
      </Button>
    )

  return (
    <div>
      <PageHeader
        title="Inventory"
        subtitle="Stock, batches, procurement, suppliers and consumption"
        actions={headerAction}
      />

      <div className="mb-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5 sm:gap-3">
        <StatCard label="Total items" value={kpis.total} icon={<Boxes className="h-5 w-5" />} onClick={() => { setTab('items'); setStockFilter('') }} />
        <StatCard label="Low stock" value={kpis.low} icon={<AlertTriangle className="h-5 w-5" />} accent="amber" onClick={() => { setTab('items'); setStockFilter('Low Stock') }} />
        <StatCard label="Out of stock" value={kpis.out} icon={<PackageX className="h-5 w-5" />} accent="red" onClick={() => { setTab('items'); setStockFilter('Out of Stock') }} />
        <StatCard label="Stock value" value={fmtINR(kpis.value)} icon={<IndianRupee className="h-5 w-5" />} accent="green" />
        <StatCard label="Expiring ≤ 180 days" value={kpis.expiring} icon={<CalendarClock className="h-5 w-5" />} accent="blue" className="col-span-2 sm:col-span-1" />
      </div>

      <Tabs
        className="mb-4"
        value={tab}
        onChange={(k) => { setTab(k as typeof tab); setQ('') }}
        tabs={[
          { key: 'items', label: 'Items', count: itemData?.total ?? 0 },
          { key: 'movements', label: 'Movements', count: movementData?.total ?? 0 },
          { key: 'purchases', label: 'Purchases', count: purchaseData?.total ?? 0 },
          { key: 'suppliers', label: 'Suppliers', count: supplierData?.total ?? 0 },
        ]}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchInput
          value={q}
          onChange={setQ}
          placeholder={
            tab === 'items' ? 'Search item, code, category or supplier…'
            : tab === 'movements' ? 'Search item, reference or department…'
            : tab === 'purchases' ? 'Search purchase, supplier, invoice or item…'
            : 'Search supplier, city or GSTIN…'
          }
          className="w-full sm:w-auto sm:min-w-0 sm:max-w-sm sm:flex-1"
        />
        {tab === 'items' && (
          <>
            <Select value={category} onChange={(e) => setCategory(e.target.value)} className="flex-1 sm:w-48 sm:flex-none">
              <option value="">All Categories</option>
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </Select>
            <Select value={stockFilter} onChange={(e) => setStockFilter(e.target.value)} className="flex-1 sm:w-36 sm:flex-none">
              <option value="">All Stock</option>
              {['Available', 'Low Stock', 'Out of Stock'].map((s) => <option key={s}>{s}</option>)}
            </Select>
          </>
        )}
        {tab === 'movements' && (
          <Select value={moveType} onChange={(e) => setMoveType(e.target.value)} className="w-36">
            <option value="">All Types</option>
            {['Receipt', 'Issue', 'Transfer', 'Adjustment'].map((t) => <option key={t}>{t}</option>)}
          </Select>
        )}
      </div>

      {tab === 'items' && (
        <Card>
          <DataTable
            rows={filteredItems}
            columns={itemColumns}
            rowKey={(i) => i.id}
            loading={itemsLoading}
            onRowClick={(i) => { setEditingItem(i); setItemFormOpen(true) }}
            empty={
              <EmptyState
                icon={<Boxes className="h-6 w-6" />}
                title={q || category || stockFilter ? 'No items match the filters' : 'No inventory items yet'}
                message={q || category || stockFilter ? 'Try a different search or filter.' : 'Add your first item to start tracking stock.'}
                action={
                  <Button size="sm" onClick={() => { setEditingItem(null); setItemFormOpen(true) }}>
                    <Plus className="h-4 w-4" /> Add Item
                  </Button>
                }
              />
            }
            mobileCard={(i) => (
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-semibold text-slate-900">{i.name}</span>
                  <StatusBadge status={stockStatus(i)} />
                </div>
                <div className="mt-0.5 truncate text-xs text-slate-500">
                  {i.code} · {i.category} · {i.batch || 'No batch'}
                </div>
                <div className="mt-1.5 flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-800">{i.stock ?? 0} {i.unit}</span>
                  <span className="text-slate-500">{fmtINR(i.cost)} · GST {i.gst ?? 0}%</span>
                </div>
              </div>
            )}
          />
        </Card>
      )}

      {tab === 'movements' && (
        <Card>
          <DataTable
            rows={movements}
            columns={movementColumns}
            rowKey={(m) => m.id}
            loading={movementsLoading}
            empty={
              <EmptyState
                icon={<ArrowLeftRight className="h-6 w-6" />}
                title="No stock movements yet"
                message="Issues, transfers, adjustments and goods receipts will appear here."
                action={
                  <Button size="sm" onClick={() => setMovementOpen(true)}>
                    <ArrowLeftRight className="h-4 w-4" /> New Movement
                  </Button>
                }
              />
            }
            mobileCard={(m) => (
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-semibold text-slate-900">{m.item}</span>
                  <Badge tone={m.type === 'Receipt' ? 'green' : m.type === 'Issue' ? 'blue' : m.type === 'Transfer' ? 'violet' : 'amber'}>{m.type}</Badge>
                </div>
                <div className="mt-0.5 truncate text-xs text-slate-500">
                  {fmtDate(m.date)} · {m.reference} · {m.from || 'Store'} → {m.to || m.department || 'Internal'}
                </div>
                <div className="mt-1 text-xs">
                  <span className="font-bold text-slate-800">{m.qty} {m.unit || ''}</span>
                  <span className="text-slate-400"> · {m.reason || '—'}</span>
                </div>
              </div>
            )}
          />
        </Card>
      )}

      {tab === 'purchases' && (
        <Card>
          <DataTable
            rows={purchases}
            columns={purchaseColumns}
            rowKey={(p) => p.id}
            loading={purchasesLoading}
            empty={
              <EmptyState
                icon={<ShoppingCart className="h-6 w-6" />}
                title="No purchases recorded"
                message="Raise a purchase order and receive it to post stock."
                action={
                  <Button size="sm" onClick={() => setPurchaseOpen(true)}>
                    <Plus className="h-4 w-4" /> New Purchase
                  </Button>
                }
              />
            }
            mobileCard={(p) => (
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-bold text-slate-900">{p.code}</span>
                  <StatusBadge status={p.status} />
                </div>
                <div className="mt-0.5 truncate text-xs text-slate-500">
                  {fmtDate(p.date)} · {p.supplier} · Inv {p.invoice}
                </div>
                <div className="mt-1.5 flex items-center justify-between">
                  <span className="text-xs text-slate-600">{p.item} × {p.qty}</span>
                  <span className="text-sm font-bold text-slate-800">{fmtINR(p.total)}</span>
                </div>
                {p.status === 'Ordered' && (
                  <Button size="sm" variant="secondary" className="mt-2 w-full" loading={receiving === p.id} onClick={() => receive(p)}>
                    <PackageCheck className="h-3.5 w-3.5" /> Receive Goods
                  </Button>
                )}
              </div>
            )}
          />
        </Card>
      )}

      {tab === 'suppliers' && (
        <Card>
          <DataTable
            rows={suppliers}
            columns={supplierColumns}
            rowKey={(s) => s.id}
            loading={suppliersLoading}
            onRowClick={(s) => { setEditingSupplier(s); setSupplierFormOpen(true) }}
            empty={
              <EmptyState
                icon={<Truck className="h-6 w-6" />}
                title="No suppliers yet"
                message="Add suppliers to link them to items and purchases."
                action={
                  <Button size="sm" onClick={() => { setEditingSupplier(null); setSupplierFormOpen(true) }}>
                    <Plus className="h-4 w-4" /> Add Supplier
                  </Button>
                }
              />
            }
            mobileCard={(s) => (
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-semibold text-slate-900">{s.name}</span>
                  <StatusBadge status={s.status} />
                </div>
                <div className="mt-0.5 truncate text-xs text-slate-500">
                  {s.code} · {s.city} · {s.contact}
                </div>
                <div className="mt-1 flex items-center justify-between text-xs">
                  <span className="text-slate-500">{s.credit}</span>
                  <span className="font-bold text-slate-800">{fmtINR(s.balance)}</span>
                </div>
              </div>
            )}
          />
        </Card>
      )}

      <ItemFormDialog
        open={itemFormOpen}
        onClose={() => setItemFormOpen(false)}
        editing={editingItem}
        suppliers={suppliers}
      />
      <MovementDialog open={movementOpen} onClose={() => setMovementOpen(false)} items={items} />
      <PurchaseDialog open={purchaseOpen} onClose={() => setPurchaseOpen(false)} items={items} suppliers={suppliers} />
      <SupplierFormDialog open={supplierFormOpen} onClose={() => setSupplierFormOpen(false)} editing={editingSupplier} />

      <ConfirmDialog
        open={!!deleteItem}
        onClose={() => setDeleteItem(null)}
        onConfirm={() => deleteItem && delItem.mutate(deleteItem.id, { onSuccess: () => setDeleteItem(null) })}
        loading={delItem.isPending}
        title="Delete inventory item?"
        message={deleteItem ? `${deleteItem.code} · ${deleteItem.name} will be removed permanently, along with its stock record.` : ''}
      />
      <ConfirmDialog
        open={!!deleteSupplier}
        onClose={() => setDeleteSupplier(null)}
        onConfirm={() => deleteSupplier && delSupplier.mutate(deleteSupplier.id, { onSuccess: () => setDeleteSupplier(null) })}
        loading={delSupplier.isPending}
        title="Delete supplier?"
        message={deleteSupplier ? `${deleteSupplier.code} · ${deleteSupplier.name} will be removed permanently.` : ''}
      />
    </div>
  )
}
