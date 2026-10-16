import { api, colors, face, radius, space } from '@dentor/shared'
import { useQuery } from '@tanstack/react-query'
import { StyleSheet, Text, View } from 'react-native'

export interface Advertisement { title?: string; subtitle?: string; status?: string }

/** The clinic's own advertisement (set in the web app's "Manage Advertisement"), if it is active. */
export function useAdvertisement() {
  const ad = useQuery<Advertisement>({ queryKey: ['clinic', 'advertisement'], queryFn: () => api.get('/api/advertisement') })
  const value = ad.data
  return { ad, active: !!value?.title && (value.status ?? 'Active') === 'Active' ? value : null }
}

/**
 * Where the design draws its sample "DENTAL DISCOUNT" banner (dentor.fig "Home" 37:626), the clinic's own
 * advertisement: its title and text on the brand colour. The sample artwork is not shown as a real offer.
 */
export function AdBanner({ ad }: { ad: Advertisement }) {
  return (
    <View testID="home-banner" accessibilityRole="summary" style={styles.banner}>
      <Text numberOfLines={2} style={styles.title}>{ad.title}</Text>
      {!!ad.subtitle && <Text numberOfLines={3} style={styles.subtitle}>{ad.subtitle}</Text>}
    </View>
  )
}

const styles = StyleSheet.create({
  banner: { minHeight: 120, borderRadius: radius.md, backgroundColor: colors.header, padding: space.lg, paddingRight: 72, justifyContent: 'center', gap: space.xs },
  title: { ...face('bold'), fontSize: 20, lineHeight: 24, color: '#ffffff' },
  subtitle: { ...face('regular'), fontSize: 13, lineHeight: 18, color: '#ffffff' },
})
