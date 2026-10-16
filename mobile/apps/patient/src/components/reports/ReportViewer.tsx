import { Card, EmptyState, KeyValue, fmtDateTime, fmtFileSize } from '@dentor/shared'
import { ReportImage } from '@/components/reports/ReportImage'
import type { ReportContent } from '@/types'

const mimeOf = (dataUrl: string) => (dataUrl.startsWith('data:') ? dataUrl.slice(5).split(/[;,]/)[0] : '')

/** Shows an image report in the app. Other files (PDFs) are described, with a plain note that they cannot be previewed here yet. */
export function ReportViewer({ report, mine }: { report: ReportContent; mine: boolean }) {
  const mime = mimeOf(report.dataUrl ?? '')
  return (
    <>
      {mime.startsWith('image/') ? (
        <ReportImage uri={report.dataUrl} label={report.name} />
      ) : (
        <EmptyState
          testID="report-no-preview"
          icon="file-text"
          title="PDF preview is not available in the app yet"
          message="This file is stored safely with your records. Ask the clinic if you need a printed or emailed copy."
        />
      )}
      <Card>
        <KeyValue label="Name" value={report.name} strong />
        <KeyValue label="Type" value={report.category} />
        <KeyValue label="Size" value={fmtFileSize(report.size)} />
        <KeyValue label="Added" value={fmtDateTime(report.created_at)} />
        <KeyValue label="Added by" value={mine ? 'You' : 'The clinic'} />
      </Card>
    </>
  )
}
