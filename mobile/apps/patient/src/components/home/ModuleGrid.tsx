import { Badge, CONTENT_MAX_WIDTH, Icon, colors, imageSource, radius, space } from '@dentor/shared'
import { Image, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import { HOME_MODULES } from '@/components/home/modules'
import { useRouter } from '@/nav'
import type { HomeData } from '@/types'

/**
 * The home screen's tiles, three to a row: the design's 90 x 89 illustration over a Work Sans
 * Bold 12 label in #1e1e1e (frame "Home" 6:1887).
 */
export function ModuleGrid({ home }: { home: HomeData }) {
  const router = useRouter()
  // The design's 90 x 89 art, scaled with the column (three tiles to a row, up to 110 wide).
  const column = Math.min(useWindowDimensions().width, CONTENT_MAX_WIDTH) - 2 * space.lg
  const art = Math.min(110, Math.floor(column * 0.31))
  const size = { width: art, height: Math.round((art * 89) / 90) }
  return (
    <View testID="modules" style={styles.grid}>
      {HOME_MODULES.map((module) => {
        const count = module.badge?.(home) ?? 0
        return (
          <Pressable
            key={module.key}
            testID={`module-${module.key}`}
            accessibilityRole="button"
            accessibilityLabel={count ? `${module.label}, ${count} new` : module.label}
            onPress={() => router.push(module.href)}
            style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
          >
            {module.image ? (
              <Image source={imageSource(module.image)} style={size} resizeMode="contain" accessibilityIgnoresInvertColors />
            ) : (
              <View style={[size, styles.iconArt]}>
                <Icon name={module.icon} size={38} color={colors.brand700} />
              </View>
            )}
            <Text style={styles.label} numberOfLines={2}>{module.label}</Text>
            {count > 0 && (
              <View style={styles.badge}>
                <Badge testID={`badge-${module.key}`} label={count > 9 ? '9+' : String(count)} tone="red" />
              </View>
            )}
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: space.md },
  tile: { width: '31%', alignItems: 'center', gap: 4 },
  // Modules the design has no art for: an icon on the same pale tile the illustrations sit on.
  iconArt: { borderRadius: radius.lg, backgroundColor: colors.brand50, alignItems: 'center', justifyContent: 'center' },
  label: { fontFamily: 'WorkSans-Bold', fontSize: 12, lineHeight: 18, color: '#1e1e1e', textAlign: 'center' },
  pressed: { opacity: 0.85 },
  badge: { position: 'absolute', top: 4, right: 4 },
})
