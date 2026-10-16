import { QueryState, Screen } from '@dentor/shared'
import { FilePreview } from '@/components/FilePreview'
import { usePatientFile } from '@/hooks/usePatients'
import { usePullToRefresh } from '@/hooks/usePullToRefresh'
import { useLocalSearchParams } from '@/nav'

export default function PatientFileScreen() {
  const { id, fileId } = useLocalSearchParams<{ id: string; fileId: string }>()
  const query = usePatientFile(id, fileId)
  const pull = usePullToRefresh(query.refetch)
  return (
    <Screen
      testID="screen-file"
      title={query.data?.name || 'File'}
      subtitle={query.data?.category}
      back
      {...pull}
    >
      <QueryState query={query}>{(file) => <FilePreview file={file} />}</QueryState>
    </Screen>
  )
}
