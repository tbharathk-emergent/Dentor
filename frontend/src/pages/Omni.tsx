import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import {
  ArrowLeft,
  CheckCheck,
  CheckCircle2,
  Copy,
  Download,
  Inbox as InboxIcon,
  LayoutTemplate,
  Megaphone,
  MessageSquarePlus,
  Pencil,
  Plus,
  Send,
  Smartphone,
} from 'lucide-react'
import { toast } from 'sonner'
import { fmtDate, fmtINR, todayISO, useCreate, useDelete, useList, useUpdate, type Doc } from '@/lib/hooks'
import { cn } from '@/lib/cn'
import { StatusBadge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ConfirmDialog, Dialog } from '@/components/ui/Dialog'
import { Field, Input, Select, Textarea } from '@/components/ui/Field'
import { Tabs } from '@/components/ui/Tabs'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { Avatar, EmptyState, ListSkeleton, PageHeader, SearchInput } from '@/components/ui/bits'
import { downloadCSV } from '@/components/growth/csv'

const CHANNELS = ['WhatsApp', 'SMS', 'Email', 'Instagram', 'Website Chat']
const CHANNEL_COLOR: Record<string, string> = {
  WhatsApp: '#20b75a',
  SMS: '#2279cf',
  Email: '#de6b2a',
  Instagram: '#c23a91',
  'Website Chat': '#7654c8',
}
const ASSIGNEES = ['Reception', 'Dr. Kumar', 'Dr. Anitha', 'Dr. Gowtham', 'Unassigned']
const TEMPLATE_VARS = ['{{patient_name}}', '{{date}}', '{{time}}', '{{treatment}}', '{{amount}}']
const CAMPAIGN_VARS = ['{{patient_name}}', '{{doctor_name}}', '{{appointment_date}}', '{{clinic_name}}']
const OBJECTIVES = ['Appointment Booking', 'Treatment Follow-up', 'Patient Recall', 'Payment Collection', 'Awareness & Education', 'Feedback / Reviews']
const CAMPAIGN_CHANNELS = ['WhatsApp', 'SMS', 'Email', 'WhatsApp + SMS', 'Email + WhatsApp']
const AUDIENCES: { key: string; label: string; reach: number }[] = [
  { key: 'all', label: 'All opted-in patients', reach: 486 },
  { key: 'recall', label: 'Recall due patients', reach: 284 },
  { key: 'pending', label: 'Pending treatment patients', reach: 86 },
  { key: 'inactive', label: 'No visit for 6+ months', reach: 138 },
  { key: 'outstanding', label: 'Outstanding balance patients', reach: 64 },
  { key: 'custom', label: 'Custom segment', reach: 120 },
]

const nowTime = () =>
  new Date().toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }).toUpperCase()

function ChannelDot({ channel, className }: { channel: string; className?: string }) {
  return (
    <span
      className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[13px] font-bold text-white', className)}
      style={{ backgroundColor: CHANNEL_COLOR[channel] ?? '#64748b' }}
    >
      {channel?.[0] ?? '?'}
    </span>
  )
}

const substitute = (text: string, name?: string) =>
  name ? text.replaceAll('{{patient_name}}', name) : text

/* ------------------------------------------------------------------ */
/* Inbox                                                               */
/* ------------------------------------------------------------------ */

function InboxTab({
  selectedId,
  setSelectedId,
  composer,
  setComposer,
  templates,
  onNewConversation,
}: {
  selectedId: string | null
  setSelectedId: (id: string | null) => void
  composer: string
  setComposer: (v: string) => void
  templates: Doc[]
  onNewConversation: () => void
}) {
  const [search, setSearch] = useState('')
  const [chFilter, setChFilter] = useState('All')
  const { data, isLoading } = useList('omni_conversations', { limit: 200, sort: 'updated_at', order: 'desc' })
  const update = useUpdate('omni_conversations')
  const scrollRef = useRef<HTMLDivElement>(null)

  const conversations = data?.items ?? []
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return conversations.filter((c) => {
      if (chFilter !== 'All' && c.channel !== chFilter) return false
      if (term && !`${c.name} ${c.topic} ${c.patientId} ${c.phone}`.toLowerCase().includes(term)) return false
      return true
    })
  }, [conversations, search, chFilter])

  const selected = conversations.find((c) => c.id === selectedId) ?? null
  const approvedTemplates = templates.filter((t) => t.status === 'Approved')

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [selectedId, selected?.messages?.length])

  const openConversation = (c: Doc) => {
    setSelectedId(c.id)
    if (Number(c.unread) > 0) update.mutate({ id: c.id, unread: 0 })
  }

  const send = () => {
    if (!selected || !composer.trim()) return
    const messages = [...(selected.messages ?? []), ['out', composer.trim(), nowTime()]]
    update.mutate(
      { id: selected.id, messages, unread: 0, time: nowTime() },
      { onSuccess: () => toast.success(`Message added to ${selected.channel} conversation`) },
    )
    setComposer('')
  }

  const applyTemplate = (id: string) => {
    const t = approvedTemplates.find((x) => x.id === id)
    if (t) setComposer(substitute(t.text, selected?.name))
  }

  return (
    <Card className="flex h-[calc(100dvh-220px)] min-h-[520px] overflow-hidden">
      {/* Conversation list */}
      <div className={cn('flex w-full flex-col border-slate-200 md:w-[320px] md:shrink-0 md:border-r', selected && 'hidden md:flex')}>
        <div className="space-y-2.5 border-b border-slate-100 p-3">
          <SearchInput value={search} onChange={setSearch} placeholder="Search conversations…" />
          <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
            {['All', ...CHANNELS].map((c) => (
              <button
                key={c}
                onClick={() => setChFilter(c)}
                className={cn(
                  'shrink-0 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                  chFilter === c
                    ? 'border-brand-600 bg-brand-700 text-white'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300',
                )}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <ListSkeleton rows={5} />
          ) : !filtered.length ? (
            <EmptyState
              icon={<InboxIcon className="h-6 w-6" />}
              title="No conversations"
              message={search || chFilter !== 'All' ? 'Try another search or channel.' : 'Start a conversation to engage a patient.'}
              action={<Button size="sm" onClick={onNewConversation}><MessageSquarePlus className="h-4 w-4" /> New Conversation</Button>}
            />
          ) : (
            <ul className="divide-y divide-slate-100">
              {filtered.map((c) => {
                const lastMsg = c.messages?.length ? c.messages[c.messages.length - 1][1] : c.topic
                return (
                  <li key={c.id}>
                    <button
                      onClick={() => openConversation(c)}
                      className={cn('flex w-full items-start gap-2.5 px-3 py-2.5 text-left transition hover:bg-slate-50', c.id === selectedId && 'bg-brand-50/70')}
                    >
                      <ChannelDot channel={c.channel} />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-semibold text-slate-800">{c.name}</span>
                          <span className="shrink-0 text-[11px] text-slate-400">{c.time}</span>
                        </span>
                        <span className="block truncate text-xs text-slate-500">{lastMsg}</span>
                        <span className="mt-0.5 flex items-center justify-between gap-2">
                          <span className="truncate text-[11px] text-slate-400">{c.channel} · {c.assigned}</span>
                          {Number(c.unread) > 0 && (
                            <span className="flex h-4.5 min-w-[18px] shrink-0 items-center justify-center rounded-full bg-brand-700 px-1 text-[10px] font-bold text-white">
                              {c.unread}
                            </span>
                          )}
                        </span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Thread */}
      <div className={cn('flex min-w-0 flex-1 flex-col', !selected && 'hidden md:flex')}>
        {!selected ? (
          <EmptyState
            className="flex-1"
            icon={<InboxIcon className="h-6 w-6" />}
            title="Select a conversation"
            message="Pick a patient thread from the list to view messages and reply."
          />
        ) : (
          <>
            {/* Patient context header */}
            <div className="border-b border-slate-100 px-3 py-2.5 sm:px-4">
              <div className="flex items-center gap-2.5">
                <Button variant="ghost" size="icon-sm" className="md:hidden" onClick={() => setSelectedId(null)} aria-label="Back">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <Avatar name={selected.name} className="h-9 w-9" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-semibold text-slate-900">{selected.name}</span>
                    <span className="hidden text-xs text-slate-400 sm:inline">{selected.patientId}</span>
                  </div>
                  <div className="truncate text-xs text-slate-500">
                    {selected.channel} · {selected.topic} · Consent: {selected.consent}
                  </div>
                </div>
                <div className="hidden w-36 sm:block">
                  <Select
                    value={ASSIGNEES.includes(selected.assigned) ? selected.assigned : 'Unassigned'}
                    onChange={(e) =>
                      update.mutate(
                        { id: selected.id, assigned: e.target.value },
                        { onSuccess: () => toast.success(`Conversation assigned to ${e.target.value}`) },
                      )
                    }
                    className="h-8 text-[13px]"
                  >
                    {ASSIGNEES.map((a) => <option key={a}>{a}</option>)}
                  </Select>
                </div>
                <Button
                  size="sm"
                  variant={selected.status === 'Resolved' ? 'secondary' : 'outline'}
                  onClick={() =>
                    update.mutate(
                      { id: selected.id, status: selected.status === 'Resolved' ? 'Open' : 'Resolved' },
                      { onSuccess: () => toast.success(selected.status === 'Resolved' ? 'Conversation reopened' : 'Conversation resolved') },
                    )
                  }
                >
                  <CheckCircle2 className="h-4 w-4" />
                  <span className="hidden sm:inline">{selected.status === 'Resolved' ? 'Resolved' : 'Resolve'}</span>
                </Button>
              </div>
              <div className="mt-1.5 flex items-center gap-2 sm:hidden">
                <span className="text-[11px] text-slate-400">{selected.phone}</span>
                <div className="ml-auto w-32">
                  <Select
                    value={ASSIGNEES.includes(selected.assigned) ? selected.assigned : 'Unassigned'}
                    onChange={(e) => update.mutate({ id: selected.id, assigned: e.target.value })}
                    className="h-7 text-xs"
                  >
                    {ASSIGNEES.map((a) => <option key={a}>{a}</option>)}
                  </Select>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 space-y-2.5 overflow-y-auto bg-slate-50/60 px-3 py-4 sm:px-5">
              {(selected.messages ?? []).map((m: [string, string, string], i: number) => (
                <div key={i} className={cn('flex', m[0] === 'out' ? 'justify-end' : 'justify-start')}>
                  <div
                    className={cn(
                      'max-w-[82%] rounded-2xl px-3.5 py-2 text-sm shadow-sm sm:max-w-[65%]',
                      m[0] === 'out'
                        ? 'rounded-br-md bg-brand-700 text-white'
                        : 'rounded-bl-md border border-slate-200 bg-white text-slate-800',
                    )}
                  >
                    <p className="whitespace-pre-wrap">{m[1]}</p>
                    <div className={cn('mt-0.5 flex items-center justify-end gap-1 text-[10px]', m[0] === 'out' ? 'text-brand-100' : 'text-slate-400')}>
                      {m[2]}
                      {m[0] === 'out' && <CheckCheck className="h-3 w-3" />}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Composer */}
            <div className="border-t border-slate-100 p-3">
              <div className="flex items-end gap-2">
                <div className="min-w-0 flex-1 space-y-2">
                  <Select value="" onChange={(e) => { applyTemplate(e.target.value); e.target.value = '' }} className="h-8 text-[13px]">
                    <option value="">Quick template…</option>
                    {approvedTemplates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </Select>
                  <Textarea
                    value={composer}
                    onChange={(e) => setComposer(e.target.value)}
                    placeholder="Type a secure patient message…"
                    className="min-h-[56px]"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) send()
                    }}
                  />
                </div>
                <Button onClick={send} disabled={!composer.trim()} aria-label="Send message">
                  <Send className="h-4 w-4" /> <span className="hidden sm:inline">Send</span>
                </Button>
              </div>
              <p className="mt-1.5 text-[11px] text-slate-400">
                Messages are logged to the patient record — external delivery requires a connected gateway.
              </p>
            </div>
          </>
        )}
      </div>
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/* New Conversation dialog                                             */
/* ------------------------------------------------------------------ */

function NewConversationDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  onCreated: (c: Doc) => void
}) {
  const [patient, setPatient] = useState('')
  const [channel, setChannel] = useState('WhatsApp')
  const [assigned, setAssigned] = useState('Reception')
  const [topic, setTopic] = useState('')
  const [message, setMessage] = useState('')
  const [consent, setConsent] = useState(true)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const { data: patientData } = useList('patients', { limit: 300 }, { enabled: open })
  const create = useCreate('omni_conversations')

  useEffect(() => {
    if (open) {
      setPatient(''); setChannel('WhatsApp'); setAssigned('Reception')
      setTopic(''); setMessage(''); setConsent(true); setErrors({})
    }
  }, [open])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (!patient.trim()) errs.patient = 'Choose or type a patient name.'
    if (!message.trim()) errs.message = 'Write the first message.'
    if (!consent) errs.consent = 'Communication consent must be verified before messaging.'
    setErrors(errs)
    if (Object.keys(errs).length) {
      if (errs.consent) toast.error(errs.consent)
      return
    }
    const match = (patientData?.items ?? []).find((p) => p.name.toLowerCase() === patient.trim().toLowerCase())
    create.mutate(
      {
        name: patient.trim(),
        patientId: match?.code ?? 'New',
        channel,
        time: 'Now',
        unread: 0,
        status: 'Open',
        assigned,
        phone: match?.mobile ? `+91 ${match.mobile}` : '',
        topic: topic.trim() || 'General Inquiry',
        consent: 'Opted-in',
        messages: [['out', message.trim(), 'Now']],
      },
      {
        onSuccess: (c) => {
          toast.success(`Conversation started with ${patient.trim()}`)
          onCreated(c as Doc)
          onClose()
        },
      },
    )
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="New Conversation"
      subtitle="Reach a patient on their preferred channel"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit as never} loading={create.isPending}>Start Conversation</Button>
        </>
      }
    >
      <form onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Patient" required error={errors.patient} className="sm:col-span-2">
          <Input
            list="omni-patient-options"
            value={patient}
            onChange={(e) => setPatient(e.target.value)}
            placeholder="Search patient name…"
            autoFocus
          />
          <datalist id="omni-patient-options">
            {(patientData?.items ?? []).map((p) => <option key={p.id} value={p.name}>{p.code}</option>)}
          </datalist>
        </Field>
        <Field label="Channel">
          <Select value={channel} onChange={(e) => setChannel(e.target.value)}>
            {CHANNELS.map((c) => <option key={c}>{c}</option>)}
          </Select>
        </Field>
        <Field label="Assign To">
          <Select value={assigned} onChange={(e) => setAssigned(e.target.value)}>
            {['Reception', 'Dr. Kumar', 'Dr. Anitha', 'Dr. Gowtham'].map((a) => <option key={a}>{a}</option>)}
          </Select>
        </Field>
        <Field label="Topic" className="sm:col-span-2">
          <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. Recall Reminder, Invoice Copy" />
        </Field>
        <Field label="Message" required error={errors.message} className="sm:col-span-2">
          <Textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="First message to the patient…" />
        </Field>
        <label className="flex items-start gap-2 text-[13px] text-slate-700 sm:col-span-2">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-brand-700"
          />
          Patient communication consent verified
        </label>
        <button type="submit" className="hidden" />
      </form>
    </Dialog>
  )
}

/* ------------------------------------------------------------------ */
/* Templates                                                           */
/* ------------------------------------------------------------------ */

const TEMPLATE_CATEGORIES = ['Utility', 'Clinical', 'Retention', 'Engagement', 'Laboratory']

function TemplatesTab({ templates, isLoading, onUse }: { templates: Doc[]; isLoading: boolean; onUse: (t: Doc) => void }) {
  const [search, setSearch] = useState('')
  const [chFilter, setChFilter] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Doc | null>(null)
  const [deleting, setDeleting] = useState<Doc | null>(null)
  const [form, setForm] = useState({ name: '', channel: 'WhatsApp', category: 'Utility', status: 'Draft', text: '' })
  const create = useCreate('omni_templates', { successMessage: 'Template created' })
  const update = useUpdate('omni_templates', { successMessage: 'Template updated' })
  const del = useDelete('omni_templates', { successMessage: 'Template deleted' })

  const filtered = templates.filter((t) => {
    if (chFilter && t.channel !== chFilter) return false
    const term = search.trim().toLowerCase()
    if (term && !`${t.name} ${t.category} ${t.text} ${t.code}`.toLowerCase().includes(term)) return false
    return true
  })

  const openForm = (t?: Doc) => {
    setEditing(t ?? null)
    setForm(t
      ? { name: t.name, channel: t.channel, category: t.category, status: t.status, text: t.text }
      : { name: '', channel: 'WhatsApp', category: 'Utility', status: 'Draft', text: '' })
    setFormOpen(true)
  }

  const save = () => {
    if (!form.name.trim() || !form.text.trim()) {
      toast.error('Template name and message are required')
      return
    }
    if (editing) update.mutate({ id: editing.id, ...form }, { onSuccess: () => setFormOpen(false) })
    else create.mutate(form, { onSuccess: () => setFormOpen(false) })
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchInput value={search} onChange={setSearch} placeholder="Search message templates…" className="min-w-0 flex-1 sm:max-w-xs" />
        <Select value={chFilter} onChange={(e) => setChFilter(e.target.value)} className="w-36">
          <option value="">All Channels</option>
          {['WhatsApp', 'SMS', 'Email'].map((c) => <option key={c}>{c}</option>)}
        </Select>
        <Button className="ml-auto" onClick={() => openForm()}>
          <Plus className="h-4 w-4" /> New Template
        </Button>
      </div>

      {isLoading ? (
        <ListSkeleton rows={4} />
      ) : !filtered.length ? (
        <Card>
          <EmptyState
            icon={<LayoutTemplate className="h-6 w-6" />}
            title={search || chFilter ? 'No templates match' : 'No templates yet'}
            message="Approved templates appear as quick replies in the inbox."
            action={<Button size="sm" onClick={() => openForm()}><Plus className="h-4 w-4" /> New Template</Button>}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((t) => (
            <Card key={t.id} className="flex flex-col p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-slate-900">{t.name}</div>
                  <div className="text-xs text-slate-500">{t.code} · {t.category}</div>
                </div>
                <StatusBadge status={t.status} />
              </div>
              <p className="mt-2.5 flex-1 rounded-lg bg-slate-50 px-3 py-2 text-[13px] text-slate-600">{t.text}</p>
              <div className="mt-3 flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: CHANNEL_COLOR[t.channel] ?? '#64748b' }} />
                  {t.channel}
                </span>
                <div className="flex gap-1.5">
                  <Button size="sm" variant="secondary" onClick={() => onUse(t)}>Use</Button>
                  <Button size="sm" variant="outline" onClick={() => openForm(t)}><Pencil className="h-3.5 w-3.5" /> Edit</Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? 'Edit Template' : 'New Template'}
        subtitle={editing ? `${editing.code} · ${editing.channel}` : 'Reusable, pre-approved patient messaging'}
        footer={
          <>
            {editing && (
              <Button variant="danger-outline" className="sm:mr-auto" onClick={() => { setFormOpen(false); setDeleting(editing) }}>
                Delete
              </Button>
            )}
            <Button variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button onClick={save} loading={create.isPending || update.isPending}>
              {editing ? 'Save Changes' : 'Create Template'}
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Template Name" required className="sm:col-span-3">
            <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Appointment Confirmation" autoFocus />
          </Field>
          <Field label="Channel">
            <Select value={form.channel} onChange={(e) => setForm((f) => ({ ...f, channel: e.target.value }))}>
              {['WhatsApp', 'SMS', 'Email'].map((c) => <option key={c}>{c}</option>)}
            </Select>
          </Field>
          <Field label="Category">
            <Select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}>
              {TEMPLATE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </Select>
          </Field>
          <Field label="Status">
            <Select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
              {['Draft', 'Approved'].map((s) => <option key={s}>{s}</option>)}
            </Select>
          </Field>
          <Field label="Message" required className="sm:col-span-3" hint="Only Approved templates show up as quick replies in the inbox.">
            <Textarea
              value={form.text}
              onChange={(e) => setForm((f) => ({ ...f, text: e.target.value }))}
              placeholder="Use variables such as {{patient_name}}, {{date}}, {{time}}"
            />
          </Field>
          <div className="flex flex-wrap gap-1.5 sm:col-span-3">
            {TEMPLATE_VARS.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setForm((f) => ({ ...f, text: (f.text ? f.text + ' ' : '') + v }))}
                className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 font-mono text-[11px] text-slate-600 transition hover:border-brand-300 hover:bg-brand-50"
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      </Dialog>

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && del.mutate(deleting.id, { onSuccess: () => setDeleting(null) })}
        title="Delete template?"
        message={`“${deleting?.name}” will be removed permanently. Conversations already using it are not affected.`}
        loading={del.isPending}
      />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Campaigns                                                           */
/* ------------------------------------------------------------------ */

function CampaignsTab() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [viewing, setViewing] = useState<Doc | null>(null)
  const [deleting, setDeleting] = useState<Doc | null>(null)
  const [newOpen, setNewOpen] = useState(false)
  const { data, isLoading } = useList('omni_campaigns', { limit: 200, sort: 'created_at', order: 'desc' })
  const create = useCreate('omni_campaigns')
  const update = useUpdate('omni_campaigns')
  const del = useDelete('omni_campaigns', { successMessage: 'Campaign deleted' })

  const campaigns = (data?.items ?? []).filter((c) => {
    if (statusFilter && c.status !== statusFilter) return false
    const term = search.trim().toLowerCase()
    if (term && !`${c.name} ${c.code} ${c.channel}`.toLowerCase().includes(term)) return false
    return true
  })

  const engagement = (c: Doc) => (Number(c.sent) ? Math.round((Number(c.engaged) / Number(c.sent)) * 100) : 0)

  const toggleRun = (c: Doc) => {
    const next = c.status === 'Running' ? 'Scheduled' : 'Running'
    update.mutate(
      { id: c.id, status: next, ...(next === 'Running' ? { sent: c.audience } : {}) },
      { onSuccess: (u) => { setViewing(u as Doc); toast.success(next === 'Running' ? 'Campaign started' : 'Campaign paused') } },
    )
  }

  const duplicate = (c: Doc) => {
    create.mutate(
      {
        name: `${c.name} Copy`, channel: c.channel, audience: c.audience,
        sent: 0, delivered: 0, engaged: 0, status: 'Scheduled', date: todayISO(),
        objective: c.objective, message: c.message,
      },
      { onSuccess: (n) => { setViewing(null); toast.success(`Campaign duplicated as ${(n as Doc).code}`) } },
    )
  }

  const exportCSV = () => {
    downloadCSV(
      'DENTOR-Omnichannel-Campaigns.csv',
      ['ID', 'Name', 'Channel', 'Audience', 'Sent', 'Delivered', 'Engaged', 'Status', 'Date'],
      campaigns.map((c) => [c.code, c.name, c.channel, c.audience, c.sent, c.delivered, c.engaged, c.status, c.date]),
    )
  }

  const columns: Column<Doc>[] = [
    {
      key: 'name',
      header: 'Campaign',
      cell: (c) => (
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-slate-800">{c.name}</div>
          <div className="text-xs text-slate-400">{c.code}</div>
        </div>
      ),
    },
    { key: 'channel', header: 'Channel', cell: (c) => <span className="whitespace-nowrap text-[13px] text-slate-600">{c.channel}</span> },
    { key: 'date', header: 'Date', cell: (c) => <span className="whitespace-nowrap text-[13px] text-slate-500">{fmtDate(c.date)}</span> },
    { key: 'audience', header: 'Audience', align: 'right', cell: (c) => <span className="tabular-nums">{c.audience ?? 0}</span> },
    { key: 'sent', header: 'Sent', align: 'right', cell: (c) => <span className="tabular-nums">{c.sent ?? 0}</span> },
    { key: 'delivered', header: 'Delivered', align: 'right', cell: (c) => <span className="tabular-nums">{c.delivered ?? 0}</span> },
    { key: 'engaged', header: 'Engaged', align: 'right', cell: (c) => <span className="tabular-nums">{c.engaged ?? 0}</span> },
    {
      key: 'engagement',
      header: 'Engagement',
      align: 'right',
      cell: (c) => <span className="font-semibold tabular-nums text-slate-800">{engagement(c)}%</span>,
    },
    { key: 'status', header: 'Status', cell: (c) => <StatusBadge status={c.status} /> },
    {
      key: 'actions',
      header: '',
      cell: (c) => (
        <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); setViewing(c) }}>View</Button>
      ),
    },
  ]

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchInput value={search} onChange={setSearch} placeholder="Search campaigns…" className="min-w-0 flex-1 sm:max-w-xs" />
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-32">
          <option value="">All Status</option>
          {['Running', 'Scheduled', 'Completed', 'Draft'].map((s) => <option key={s}>{s}</option>)}
        </Select>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" onClick={exportCSV}><Download className="h-4 w-4" /> <span className="hidden sm:inline">Export</span></Button>
          <Button onClick={() => setNewOpen(true)}><Plus className="h-4 w-4" /> New Campaign</Button>
        </div>
      </div>

      <Card>
        <DataTable
          rows={campaigns}
          columns={columns}
          rowKey={(c) => c.id}
          loading={isLoading}
          onRowClick={(c) => setViewing(c)}
          empty={
            <EmptyState
              icon={<Megaphone className="h-6 w-6" />}
              title={search || statusFilter ? 'No campaigns match' : 'No campaigns yet'}
              message="Launch a campaign to re-engage patients at scale."
              action={<Button size="sm" onClick={() => setNewOpen(true)}><Plus className="h-4 w-4" /> New Campaign</Button>}
            />
          }
          mobileCard={(c) => (
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-semibold text-slate-800">{c.name}</span>
                <StatusBadge status={c.status} />
              </div>
              <div className="text-xs text-slate-500">{c.code} · {c.channel} · {fmtDate(c.date)}</div>
              <div className="mt-1.5 grid grid-cols-4 gap-1.5 text-center">
                {[['Audience', c.audience], ['Sent', c.sent], ['Engaged', c.engaged], ['Rate', `${engagement(c)}%`]].map(([k, v]) => (
                  <div key={String(k)} className="rounded-lg bg-slate-50 py-1.5">
                    <div className="text-[13px] font-semibold tabular-nums text-slate-800">{v ?? 0}</div>
                    <div className="text-[10px] uppercase tracking-wide text-slate-400">{k}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        />
      </Card>

      {/* View campaign dialog */}
      <Dialog
        open={!!viewing}
        onClose={() => setViewing(null)}
        title={viewing?.name ?? ''}
        subtitle={viewing ? `${viewing.code} · ${viewing.channel} · ${fmtDate(viewing.date)}` : undefined}
        footer={
          viewing && (
            <>
              <Button variant="danger-outline" className="sm:mr-auto" onClick={() => { setDeleting(viewing); setViewing(null) }}>
                Delete
              </Button>
              <Button variant="outline" onClick={() => duplicate(viewing)} loading={create.isPending}>
                <Copy className="h-4 w-4" /> Duplicate
              </Button>
              {(viewing.status === 'Running' || viewing.status === 'Scheduled') && (
                <Button variant="secondary" onClick={() => toggleRun(viewing)} loading={update.isPending}>
                  {viewing.status === 'Running' ? 'Pause Campaign' : 'Start Campaign'}
                </Button>
              )}
              <Button onClick={() => setViewing(null)}>Done</Button>
            </>
          )
        }
      >
        {viewing && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {[
                ['Audience', viewing.audience ?? 0],
                ['Sent', viewing.sent ?? 0],
                ['Delivered', viewing.delivered ?? 0],
                ['Engaged', viewing.engaged ?? 0],
                ['Delivery rate', `${Number(viewing.sent) ? Math.round((Number(viewing.delivered) / Number(viewing.sent)) * 100) : 0}%`],
                ['Engagement', `${engagement(viewing)}%`],
              ].map(([k, v]) => (
                <div key={String(k)} className="rounded-lg bg-slate-50 px-3 py-2.5">
                  <div className="text-lg font-bold tabular-nums text-slate-900">{v}</div>
                  <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{k}</div>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2.5">
              <span className="text-[13px] text-slate-500">Current status</span>
              <StatusBadge status={viewing.status} />
            </div>
            {viewing.message && (
              <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-slate-400">Campaign message</div>
                <p className="whitespace-pre-wrap text-[13px] text-slate-700">{viewing.message}</p>
              </div>
            )}
          </div>
        )}
      </Dialog>

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && del.mutate(deleting.id, { onSuccess: () => setDeleting(null) })}
        title="Delete campaign?"
        message={`“${deleting?.name}” and its delivery stats will be removed permanently.`}
        loading={del.isPending}
      />

      <NewCampaignDialog open={newOpen} onClose={() => setNewOpen(false)} />
    </div>
  )
}

function NewCampaignDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [form, setForm] = useState({
    name: '', objective: OBJECTIVES[0], channel: 'WhatsApp', audience: 'all',
    message: '', mode: 'now', date: todayISO(), time: '10:30',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const create = useCreate('omni_campaigns')

  useEffect(() => {
    if (open) {
      setForm({ name: '', objective: OBJECTIVES[0], channel: 'WhatsApp', audience: 'all', message: '', mode: 'now', date: todayISO(), time: '10:30' })
      setErrors({})
    }
  }, [open])

  const reach = AUDIENCES.find((a) => a.key === form.audience)?.reach ?? 0
  const cost = reach * (form.channel.includes('SMS') ? 0.55 : 0.8)
  const preview = form.message
    .replaceAll('{{patient_name}}', 'Ananya Ramesh')
    .replaceAll('{{doctor_name}}', 'Dr. Vivekanandan')
    .replaceAll('{{appointment_date}}', '12 Sep 2026')
    .replaceAll('{{clinic_name}}', 'DENTOR')

  const launch = () => {
    const errs: Record<string, string> = {}
    if (!form.name.trim()) errs.name = 'Give the campaign a name.'
    if (!form.message.trim()) errs.message = 'Write the campaign message.'
    setErrors(errs)
    if (Object.keys(errs).length) return
    const now = form.mode === 'now'
    create.mutate(
      {
        name: form.name.trim(),
        objective: form.objective,
        channel: form.channel,
        audience: reach,
        sent: now ? reach : 0,
        delivered: 0,
        engaged: 0,
        status: now ? 'Running' : 'Scheduled',
        date: now ? todayISO() : form.date,
        schedule: now ? '' : form.time,
        message: form.message.trim(),
      },
      {
        onSuccess: (c) => {
          toast.success(now ? `Campaign ${(c as Doc).code} launched to ${reach} patients` : `Campaign ${(c as Doc).code} scheduled for ${fmtDate(form.date)}`)
          onClose()
        },
      },
    )
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="New Campaign"
      subtitle="Audience → Message → Delivery → Launch"
      size="xl"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={launch} loading={create.isPending}>
            <Megaphone className="h-4 w-4" /> {form.mode === 'now' ? 'Launch Campaign' : 'Schedule Campaign'}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Campaign Name" required error={errors.name} className="sm:col-span-2">
            <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Six-Month Recall Drive" autoFocus />
          </Field>
          <Field label="Objective">
            <Select value={form.objective} onChange={(e) => setForm((f) => ({ ...f, objective: e.target.value }))}>
              {OBJECTIVES.map((o) => <option key={o}>{o}</option>)}
            </Select>
          </Field>
          <Field label="Channel">
            <Select value={form.channel} onChange={(e) => setForm((f) => ({ ...f, channel: e.target.value }))}>
              {CAMPAIGN_CHANNELS.map((c) => <option key={c}>{c}</option>)}
            </Select>
          </Field>
          <Field label="Audience" hint={`Estimated reach · ${reach} patients`} className="sm:col-span-2">
            <Select value={form.audience} onChange={(e) => setForm((f) => ({ ...f, audience: e.target.value }))}>
              {AUDIENCES.map((a) => <option key={a.key} value={a.key}>{a.label}</option>)}
            </Select>
          </Field>
          <Field label="Campaign Message" required error={errors.message} className="sm:col-span-2">
            <Textarea
              value={form.message}
              onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
              placeholder="Hello {{patient_name}}, it's time for your dental check-up at {{clinic_name}}…"
            />
          </Field>
          <div className="-mt-2 flex flex-wrap gap-1.5 sm:col-span-2">
            {CAMPAIGN_VARS.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setForm((f) => ({ ...f, message: (f.message ? f.message + ' ' : '') + v }))}
                className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 font-mono text-[11px] text-slate-600 transition hover:border-brand-300 hover:bg-brand-50"
              >
                {v}
              </button>
            ))}
          </div>
          <Field label="Delivery">
            <Select value={form.mode} onChange={(e) => setForm((f) => ({ ...f, mode: e.target.value }))}>
              <option value="now">Send now</option>
              <option value="schedule">Schedule once</option>
            </Select>
          </Field>
          {form.mode === 'schedule' && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Date">
                <Input type="date" value={form.date} min={todayISO()} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
              </Field>
              <Field label="Time">
                <Input type="time" value={form.time} onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))} />
              </Field>
            </div>
          )}
        </div>

        {/* Live preview + estimates */}
        <div className="space-y-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-900 p-3 shadow-inner">
            <div className="mb-2 flex items-center gap-1.5 text-[11px] font-medium text-slate-300">
              <Smartphone className="h-3.5 w-3.5" /> DENTOR · {form.channel}
            </div>
            <div className="rounded-xl rounded-tl-sm bg-white px-3 py-2.5 text-[13px] leading-snug text-slate-800">
              {preview || <span className="text-slate-400">Your message preview appears here…</span>}
            </div>
          </div>
          <div className="space-y-2 rounded-xl border border-slate-200 p-3.5">
            <div className="flex items-center justify-between text-[13px]">
              <span className="text-slate-500">Estimated reach</span>
              <span className="font-semibold tabular-nums text-slate-800">{reach} patients</span>
            </div>
            <div className="flex items-center justify-between text-[13px]">
              <span className="text-slate-500">Rate per message</span>
              <span className="font-semibold tabular-nums text-slate-800">₹{form.channel.includes('SMS') ? '0.55' : '0.80'}</span>
            </div>
            <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-[13px]">
              <span className="font-medium text-slate-600">Estimated cost</span>
              <span className="text-base font-bold text-brand-800">{fmtINR(Math.round(cost))}</span>
            </div>
          </div>
        </div>
      </div>
    </Dialog>
  )
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function Omni() {
  const [tab, setTab] = useState('inbox')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [composer, setComposer] = useState('')
  const [newConvOpen, setNewConvOpen] = useState(false)
  const { data: templateData, isLoading: templatesLoading } = useList('omni_templates', { limit: 100, sort: 'code', order: 'asc' })
  const { data: convData } = useList('omni_conversations', { limit: 200 })
  const templates = templateData?.items ?? []
  const unread = (convData?.items ?? []).reduce((s, c) => s + Number(c.unread || 0), 0)

  const useTemplate = (t: Doc) => {
    const conv = (convData?.items ?? []).find((c) => c.id === selectedId)
    setComposer(substitute(t.text, conv?.name))
    setTab('inbox')
    toast.success(`Template “${t.name}” loaded in composer`)
  }

  return (
    <div>
      <PageHeader
        title="Omnichannel Communication"
        subtitle="Unified patient engagement, messaging and clinical communication centre"
        actions={
          <Button onClick={() => setNewConvOpen(true)}>
            <MessageSquarePlus className="h-4 w-4" /> New Conversation
          </Button>
        }
      />

      <Tabs
        className="mb-4"
        value={tab}
        onChange={setTab}
        tabs={[
          { key: 'inbox', label: 'Inbox', count: unread || undefined },
          { key: 'templates', label: 'Templates', count: templates.length || undefined },
          { key: 'campaigns', label: 'Campaigns' },
        ]}
      />

      {tab === 'inbox' && (
        <InboxTab
          selectedId={selectedId}
          setSelectedId={setSelectedId}
          composer={composer}
          setComposer={setComposer}
          templates={templates}
          onNewConversation={() => setNewConvOpen(true)}
        />
      )}
      {tab === 'templates' && <TemplatesTab templates={templates} isLoading={templatesLoading} onUse={useTemplate} />}
      {tab === 'campaigns' && <CampaignsTab />}

      <NewConversationDialog
        open={newConvOpen}
        onClose={() => setNewConvOpen(false)}
        onCreated={(c) => {
          setTab('inbox')
          setSelectedId(c.id)
        }}
      />
    </div>
  )
}
