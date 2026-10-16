import { EmptyState, fmtDateTime, fmtFileSize, IconTile, ListRow } from '@dentor/shared'
import { ListCard } from '@/components/ListCard'
import { dotJoin } from '@/lib/people'
import type { PatientFile } from '@/types'

/** X-rays, reports and other documents on the patient's record. Tap one to open it. */
export function PatientFiles({ files, onOpen }: { files: PatientFile[]; onOpen: (fileId: string) => void }) {
  if (files.length === 0) {
    return <EmptyState testID="files-empty" icon="folder" title="No files" message="X-rays and reports uploaded by the clinic or the patient appear here." />
  }
  return (
    <ListCard testID="file-list">
      {files.map((f) => (
        <ListRow
          key={f.id}
          testID={`file-${f.id}`}
          title={f.name || 'Untitled file'}
          subtitle={dotJoin(f.category, fmtFileSize(f.size))}
          meta={fmtDateTime(f.created_at)}
          left={<IconTile icon={/x-?ray|photo|image/i.test(f.category) ? 'image' : 'file'} tone="blue" />}
          onPress={() => onOpen(f.id)}
          chevron
        />
      ))}
    </ListCard>
  )
}
