import { useRef, useState } from 'react'
import { Download, FileText, Trash2, Upload } from 'lucide-react'
import { fmtDate, todayISO, useCreate, useDelete, useList, type Doc } from '@/lib/hooks'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import { ConfirmDialog, Dialog } from '@/components/ui/Dialog'
import { Field, Select } from '@/components/ui/Field'
import { EmptyState, ListSkeleton } from '@/components/ui/bits'

const CATEGORIES = ['X-ray', 'CBCT', 'OPG', 'Photo', 'Document', 'Other']
const MAX_SIZE = 5 * 1024 * 1024 // 5 MB

const fmtSize = (bytes: number | undefined) => {
  const b = Number(bytes ?? 0)
  if (b >= 1024 * 1024) return `${(b / (1024 * 1024)).toFixed(1)} MB`
  return `${Math.max(1, Math.round(b / 1024))} KB`
}

export function FilesTab({ patientCode }: { patientCode: string }) {
  const [uploadOpen, setUploadOpen] = useState(false)
  const [category, setCategory] = useState(CATEGORIES[0])
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState('')
  const [deleting, setDeleting] = useState<Doc | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const { data, isLoading } = useList('patient_files', { patientId: patientCode, sort: 'created_at', order: 'desc', limit: 200 })
  const create = useCreate('patient_files', { successMessage: 'File uploaded' })
  const remove = useDelete('patient_files', { successMessage: 'File deleted' })
  const files = data?.items ?? []

  const openUpload = () => {
    setFile(null)
    setError('')
    setCategory(CATEGORIES[0])
    setUploadOpen(true)
  }

  const pickFile = (f: File | null) => {
    setError('')
    if (f && f.size > MAX_SIZE) {
      setFile(null)
      setError(`“${f.name}” is ${fmtSize(f.size)} — files must be 5 MB or smaller.`)
      return
    }
    setFile(f)
  }

  const upload = () => {
    if (!file) {
      setError('Choose a file to upload.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      create.mutate(
        {
          patientId: patientCode,
          name: file.name,
          category,
          size: file.size,
          dataUrl: String(reader.result),
          date: todayISO(),
        } as Partial<Doc>,
        { onSuccess: () => setUploadOpen(false) },
      )
    }
    reader.onerror = () => setError('Could not read the file. Try again.')
    reader.readAsDataURL(file)
  }

  return (
    <Card>
      <CardHeader
        title="Patient Files"
        subtitle="X-rays, CBCT, OPG, photos and documents (max 5 MB each)"
        actions={
          <Button size="sm" onClick={openUpload}>
            <Upload className="h-4 w-4" /> Upload File
          </Button>
        }
      />
      {isLoading ? (
        <ListSkeleton rows={4} />
      ) : !files.length ? (
        <EmptyState
          icon={<FileText className="h-6 w-6" />}
          title="No files uploaded"
          message="Upload X-rays, scans or documents — image files show an instant preview."
          action={
            <Button size="sm" onClick={openUpload}>
              <Upload className="h-4 w-4" /> Upload File
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
          {files.map((f) => {
            const isImage = String(f.dataUrl || '').startsWith('data:image')
            return (
              <div key={f.id} className="overflow-hidden rounded-xl border border-slate-200">
                <div className="flex h-32 items-center justify-center bg-slate-50">
                  {isImage ? (
                    <img src={f.dataUrl} alt={f.name} className="h-full w-full object-cover" />
                  ) : (
                    <FileText className="h-10 w-10 text-slate-300" />
                  )}
                </div>
                <div className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-slate-800" title={f.name}>{f.name}</div>
                      <div className="mt-0.5 text-xs text-slate-500">{fmtSize(f.size)} · {fmtDate(f.date)}</div>
                    </div>
                    <Badge tone="blue">{f.category || 'Other'}</Badge>
                  </div>
                  <div className="mt-2.5 flex items-center gap-1.5">
                    <a
                      href={f.dataUrl}
                      download={f.name}
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-[13px] font-medium text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-50"
                    >
                      <Download className="h-3.5 w-3.5" /> Download
                    </a>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="ml-auto text-red-600 hover:bg-red-50"
                      aria-label="Delete file"
                      onClick={() => setDeleting(f)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Dialog
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        title="Upload Patient File"
        subtitle={`Patient ${patientCode} · stored securely in the patient record`}
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setUploadOpen(false)}>Cancel</Button>
            <Button onClick={upload} loading={create.isPending}>
              <Upload className="h-4 w-4" /> Upload
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Category">
            <Select value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </Select>
          </Field>
          <Field label="File" required error={error} hint="Images, PDF or DICOM · maximum 5 MB">
            <input
              ref={inputRef}
              type="file"
              accept="image/*,.pdf,.dcm"
              onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="flex w-full flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/60 px-4 py-6 text-center transition hover:border-brand-400 hover:bg-brand-50/40"
            >
              <Upload className="h-5 w-5 text-slate-400" />
              {file ? (
                <>
                  <span className="max-w-full truncate text-sm font-semibold text-slate-800">{file.name}</span>
                  <span className="text-xs text-slate-500">{fmtSize(file.size)} · tap to choose a different file</span>
                </>
              ) : (
                <>
                  <span className="text-sm font-medium text-slate-700">Choose a file</span>
                  <span className="text-xs text-slate-400">X-ray, CBCT, OPG, photo or PDF</span>
                </>
              )}
            </button>
          </Field>
        </div>
      </Dialog>

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) remove.mutate(deleting.id, { onSuccess: () => setDeleting(null) })
        }}
        loading={remove.isPending}
        title="Delete this file?"
        message={deleting ? `“${deleting.name}” will be permanently removed from the patient record.` : ''}
      />
    </Card>
  )
}
