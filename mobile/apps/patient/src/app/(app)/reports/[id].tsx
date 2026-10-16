import { Button, ConfirmSheet, QueryState, Screen, useToast } from '@dentor/shared'
import { useState } from 'react'
import { ReportViewer } from '@/components/reports/ReportViewer'
import { useRefresh } from '@/hooks/useRefresh'
import { useDeleteReport, useReport, useReports } from '@/hooks/useReports'
import { useLocalSearchParams, useRouter } from '@/nav'

export default function ReportScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const toast = useToast()
  const report = useReport(id)
  const remove = useDeleteReport()
  const { refreshing, onRefresh } = useRefresh(report.refetch)
  const [confirming, setConfirming] = useState(false)

  // Only files the patient uploaded can be deleted; the clinic's stay on the record.
  const mine = !!useReports().data?.items.some((file) => file.id === id && file.mine)

  const confirmDelete = () =>
    remove.mutate(id, {
      onSuccess: () => {
        toast.success('File deleted')
        setConfirming(false)
        if (router.canGoBack()) router.back()
        else router.replace('/reports')
      },
      onError: (error) => {
        toast.error(error)
        setConfirming(false)
      },
    })

  return (
    <Screen
      testID="report-screen"
      title={report.data?.name ?? 'File'}
      back
      refreshing={refreshing}
      onRefresh={onRefresh}
      footer={mine ? <Button testID="report-delete" label="Delete this file" icon="trash-2" variant="outline" full onPress={() => setConfirming(true)} /> : undefined}
    >
      <QueryState query={report}>{(data) => <ReportViewer report={data} mine={mine} />}</QueryState>
      <ConfirmSheet
        visible={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={confirmDelete}
        title="Delete this file?"
        message="It will be removed from your records and the clinic will no longer see it. This cannot be undone."
        confirmLabel="Delete file"
        danger
        loading={remove.isPending}
      />
    </Screen>
  )
}
