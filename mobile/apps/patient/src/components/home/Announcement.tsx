import { Card, Icon, T, colors, radius, space } from '@dentor/shared'
import { Image, StyleSheet, View } from 'react-native'
import type { HomeBanner } from '@/types'

/** What the clinic currently wants its patients to know (set in the reception app). */
export function Announcement({ banner }: { banner: HomeBanner }) {
  return (
    <Card testID="home-announcement" padded={false} style={styles.card}>
      {!!banner.image && <Image source={{ uri: banner.image }} resizeMode="cover" style={styles.image} accessibilityIgnoresInvertColors />}
      <View style={styles.body}>
        <View style={styles.label}>
          <Icon name="volume-2" size={14} color={colors.brand700} />
          <T variant="tiny" color={colors.brand700}>FROM YOUR CLINIC</T>
        </View>
        <T variant="h3">{banner.title}</T>
        {!!banner.subtitle && <T variant="small" color={colors.textMuted}>{banner.subtitle}</T>}
      </View>
    </Card>
  )
}

const styles = StyleSheet.create({
  card: { overflow: 'hidden' },
  image: { width: '100%', aspectRatio: 16 / 7, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, backgroundColor: colors.slateBg },
  body: { padding: space.lg, gap: space.xs },
  label: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
})
