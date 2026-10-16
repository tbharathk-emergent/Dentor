import { Feather, MaterialDesignIcons } from './icons'
import { useEffect, useRef, type ReactNode } from 'react'
import { ActivityIndicator, Animated, Platform, StyleSheet, Text, View, type DimensionValue } from 'react-native'
import { errorMessage } from '../api'
import { colors, font, radius, space } from '../theme'
import { Button, type IconName } from './primitives'

export function Loading({ label }: { label?: string }) {
  return (
    <View testID="loading" style={styles.center}>
      <ActivityIndicator size="large" color={colors.brand700} />
      {!!label && <Text style={[font.small, { color: colors.textMuted }]}>{label}</Text>}
    </View>
  )
}

// The browser has no native animation driver (and warns if asked for one).
const useNativeDriver = Platform.OS !== 'web'

export function Skeleton({ height = 16, width = '100%', style }: { height?: number; width?: DimensionValue; style?: object }) {
  const pulse = useRef(new Animated.Value(0.5)).current
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 650, useNativeDriver }),
        Animated.timing(pulse, { toValue: 0.5, duration: 650, useNativeDriver }),
      ]),
    )
    loop.start()
    return () => loop.stop()
  }, [pulse])
  return <Animated.View style={[{ height, width, borderRadius: radius.sm, backgroundColor: colors.border, opacity: pulse }, style]} />
}

export function SkeletonList({ rows = 4 }: { rows?: number }) {
  return (
    <View testID="loading" style={{ gap: space.md }}>
      {Array.from({ length: rows }).map((_, i) => (
        <View key={i} style={styles.skeletonCard}>
          <Skeleton height={44} width={44} style={{ borderRadius: radius.md }} />
          <View style={{ flex: 1, gap: 8 }}>
            <Skeleton height={14} width="62%" />
            <Skeleton height={12} width="88%" />
          </View>
        </View>
      ))}
    </View>
  )
}

/** The friendly tooth used on empty and confirmation screens. */
export function ToothMark({ size = 72, tone = 'brand' }: { size?: number; tone?: 'brand' | 'green' | 'slate' }) {
  const fg = tone === 'green' ? colors.green : tone === 'slate' ? colors.textFaint : colors.brand700
  const bg = tone === 'green' ? colors.greenBg : tone === 'slate' ? colors.slateBg : colors.brand50
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      <MaterialDesignIcons name="tooth-outline" size={size * 0.54} color={fg} />
    </View>
  )
}

export function EmptyState({ title, message, icon, action, onAction, testID }: { title: string; message?: string; icon?: IconName; action?: string; onAction?: () => void; testID?: string }) {
  return (
    <View testID={testID ?? 'empty'} style={styles.center}>
      {icon ? (
        <View style={styles.emptyIcon}><Feather name={icon} size={28} color={colors.textFaint} /></View>
      ) : (
        <ToothMark tone="slate" />
      )}
      <Text style={[font.h3, { color: colors.text, textAlign: 'center' }]}>{title}</Text>
      {!!message && <Text style={[font.small, { color: colors.textMuted, textAlign: 'center', maxWidth: 300 }]}>{message}</Text>}
      {!!action && <Button label={action} onPress={onAction} variant="secondary" size="sm" style={{ alignSelf: 'center', marginTop: space.sm }} />}
    </View>
  )
}

export function ErrorState({ error, onRetry }: { error?: unknown; onRetry?: () => void }) {
  return (
    <View testID="error" style={styles.center}>
      <View style={[styles.emptyIcon, { backgroundColor: colors.redBg }]}><Feather name="wifi-off" size={26} color={colors.red} /></View>
      <Text style={[font.h3, { color: colors.text, textAlign: 'center' }]}>Could not load this</Text>
      <Text style={[font.small, { color: colors.textMuted, textAlign: 'center', maxWidth: 300 }]}>{errorMessage(error)}</Text>
      {onRetry && <Button label="Try again" icon="refresh-cw" onPress={onRetry} variant="outline" size="sm" style={{ alignSelf: 'center', marginTop: space.sm }} />}
    </View>
  )
}

/**
 * Renders the loading / error / loaded states of a react-query result in one place, so
 * every screen handles slow networks and failures the same way.
 */
export function QueryState<T>({
  query,
  children,
  skeleton,
}: {
  query: { data: T | undefined; isLoading: boolean; isError: boolean; error: unknown; refetch: () => unknown }
  children: (data: T) => ReactNode
  skeleton?: ReactNode
}) {
  if (query.isLoading) return <>{skeleton ?? <SkeletonList />}</>
  if (query.isError || query.data === undefined) return <ErrorState error={query.error} onRetry={() => query.refetch()} />
  return <>{children(query.data)}</>
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center', gap: space.sm, paddingVertical: space.xxl, paddingHorizontal: space.lg },
  emptyIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.slateBg, alignItems: 'center', justifyContent: 'center' },
  skeletonCard: { flexDirection: 'row', gap: space.md, alignItems: 'center', padding: space.lg, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
})
