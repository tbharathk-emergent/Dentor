import { Share } from 'react-native'
import { Button, EmptyState, QueryState, Screen, fmtDate, fmtFileSize, toISODate } from '@dentor/shared'
import { Text, View } from 'react-native'
import { useState } from 'react'
import { InfoBanner } from '@/components/InfoBanner'
import { PatientHeader } from '@/components/PatientHeader'
import { Rows } from '@/components/Rows'
import { ReportRow } from '@/components/reports/ReportRow'
import { UploadSheet } from '@/components/reports/UploadSheet'
import { useRefresh } from '@/hooks/useRefresh'
import { useRefreshOnFocus } from '@/hooks/useRefreshOnFocus'
import { useReports } from '@/hooks/useReports'
import { useLocalSearchParams, useRouter } from '@/nav'

export default function Reports() {
  const router = useRouter()
  const list = useReports()
  // The home screen's CBCT tile opens the list on that category.
  const { category } = useLocalSearchParams<{ category?: string }>()
  const only = category?.trim().toLowerCase()
  const { refreshing, onRefresh } = useRefresh(list.refetch)
  // A tab stays mounted: coming back to it shows fresh data.
  useRefreshOnFocus(list.refetch)
  const [uploading, setUploading] = useState(false)

  return (
    <Screen
      testID="reports-screen"
      header={<PatientHeader />}
      refreshing={refreshing}
      onRefresh={onRefresh}
      footer={
        <>
          <Button testID="reports-upload" label="Upload a file" icon="upload" full onPress={() => setUploading(true)} />
          {/* "share records" (patient-app.fig 51:776): a list of what the clinic holds, to send to another dentist */}
          <Button testID="reports-share" label="Share records" icon="share-2" variant="ghost" full onPress={() => {
            const items = list.data?.items ?? []
            Share.share({ message: ['My dental records:', ...items.map((f) => `${fmtDate(f.created_at)} · ${f.category} · ${f.name}`)].join('\n') }).catch(() => undefined)
          }} />
        </>
      }
    >
      <InfoBanner text="Review your post-operative instructions Digitally:" />
      {!!only && <Text accessibilityRole="header" style={{ fontFamily: 'LeagueSpartan-SemiBold', fontSize: 24, lineHeight: 28, color: '#1d8992' }}>{category}</Text>}
      <QueryState query={list}>
        {(data) =>
          only && !data.items.some((file) => file.category.toLowerCase() === only) ? (
            <EmptyState testID="reports-empty" icon="image" title={`No ${category} files yet`} message={`${category} scans from the clinic appear here.`} action="Show all files" onAction={() => router.replace('/reports')} />
          ) : data.items.length === 0 ? (
            <EmptyState testID="reports-empty" icon="image" title="No files yet" message="X-rays and reports from the clinic, and files you upload, appear here." />
          ) : (
            <Rows testID="report-list">
              {byDay(data.items.filter((file) => !only || file.category.toLowerCase() === only)).map((group) => (
                <View key={group.day} style={{ gap: 8 }}>
                  {/* design: the date above each group, Roboto 12.6 #6b7280 */}
                  <Text style={{ fontFamily: 'Roboto-Regular', fontSize: 13, lineHeight: 19, color: '#6b7280' }}>{fmtDate(group.day)}</Text>
                  {group.items.map((file) => (
                    <ReportRow
                      key={file.id}
                      file={file}
                      subtitle={[file.category, fmtFileSize(file.size)].filter(Boolean).join(' · ')}
                      onPress={() => router.push({ pathname: '/reports/[id]', params: { id: file.id } })}
                    />
                  ))}
                </View>
              ))}
            </Rows>
          )
        }
      </QueryState>
      <UploadSheet visible={uploading} onClose={() => setUploading(false)} />
    </Screen>
  )
}

/** Files under the day they were added, newest day first (the API lists newest first). */
function byDay<T extends { created_at: string }>(items: T[]): { day: string; items: T[] }[] {
  const groups: { day: string; items: T[] }[] = []
  for (const item of items) {
    const day = item.created_at ? toISODate(new Date(item.created_at)) : ''
    const last = groups[groups.length - 1]
    if (last?.day === day) last.items.push(item)
    else groups.push({ day, items: [item] })
  }
  return groups
}
