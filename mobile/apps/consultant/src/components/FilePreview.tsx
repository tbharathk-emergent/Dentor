import { Card, colors, EmptyState, fmtDateTime, fmtFileSize, KeyValue, radius } from '@dentor/shared'
import { useEffect, useState } from 'react'
import { Image, StyleSheet, View } from 'react-native'
import type { PatientFileContent } from '@/types'

type Kind = 'image' | 'pdf' | 'other' | 'missing'

function kindOf(dataUrl: string | undefined): Kind {
  if (!dataUrl) return 'missing'
  if (dataUrl.startsWith('data:image/')) return 'image'
  if (dataUrl.startsWith('data:application/pdf')) return 'pdf'
  return 'other'
}

/** Shows an image in the app; says plainly when a file type cannot be previewed here. */
export function FilePreview({ file }: { file: PatientFileContent }) {
  const kind = kindOf(file.dataUrl)
  return (
    <>
      {kind === 'image' && <ImagePreview uri={file.dataUrl!} label={file.name} />}
      {kind === 'pdf' && (
        <EmptyState
          testID="file-no-preview"
          icon="file-text"
          title="PDF preview is not available in the app yet"
          message="Open this file in the reception web app, or ask the front desk to share it with you."
        />
      )}
      {kind === 'other' && (
        <EmptyState testID="file-no-preview" icon="file" title="This file type cannot be shown in the app" message="Open it in the reception web app." />
      )}
      {kind === 'missing' && (
        <EmptyState testID="file-no-preview" icon="file" title="This file has no content" message="Only its details were saved. Ask the front desk to upload it again." />
      )}
      <Card testID="file-details">
        <KeyValue label="Name" value={file.name} />
        <KeyValue label="Category" value={file.category} />
        <KeyValue label="Size" value={fmtFileSize(file.size)} />
        <KeyValue label="Added" value={fmtDateTime(file.created_at)} />
      </Card>
    </>
  )
}

function ImagePreview({ uri, label }: { uri: string; label: string }) {
  // Until the real proportions are known, a square keeps the layout from jumping much.
  const [ratio, setRatio] = useState(1)
  useEffect(() => {
    let alive = true
    Image.getSize(
      uri,
      (width, height) => {
        // Very tall or very wide scans are letterboxed rather than allowed to fill the screen.
        if (alive && width > 0 && height > 0) setRatio(Math.min(2, Math.max(0.6, width / height)))
      },
      () => {},
    )
    return () => {
      alive = false
    }
  }, [uri])
  return (
    <View style={styles.frame}>
      <Image testID="file-image" accessibilityLabel={label} source={{ uri }} resizeMode="contain" style={{ width: '100%', aspectRatio: ratio }} />
    </View>
  )
}

const styles = StyleSheet.create({
  frame: { borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.ink },
})
