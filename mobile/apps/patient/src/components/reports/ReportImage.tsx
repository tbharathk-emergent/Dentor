import { colors, radius } from '@dentor/shared'
import { useEffect, useState } from 'react'
import { Image, StyleSheet } from 'react-native'

/** An uploaded or clinic image at full width, in its own proportions. */
export function ReportImage({ uri, label }: { uri: string; label: string }) {
  const [ratio, setRatio] = useState(4 / 3)

  useEffect(() => {
    let alive = true
    Image.getSize(
      uri,
      (width, height) => {
        if (alive && width > 0 && height > 0) setRatio(width / height)
      },
      () => {
        /* keep the default proportions */
      },
    )
    return () => {
      alive = false
    }
  }, [uri])

  return (
    <Image
      testID="report-image"
      source={{ uri }}
      accessibilityLabel={label}
      resizeMode="contain"
      style={[styles.image, { aspectRatio: ratio }]}
    />
  )
}

const styles = StyleSheet.create({
  image: { width: '100%', borderRadius: radius.md, backgroundColor: colors.ink },
})
