import { Feather } from './icons'
import { useBackOverride, useRouter } from '../navigation'
import type { ReactNode } from 'react'
import { Image, KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { imageSource } from '../image'
import { accentColors, cardBorder, colors, face, font, patternByDefault, radius, screenHeader, screenPattern, shadow, space, TOUCH } from '../theme'
import { IconButton, type IconName } from './primitives'

/** Readable column on tablets and in a desktop browser; full width on phones. */
export const CONTENT_MAX_WIDTH = 640

/**
 * Standard screen frame: brand header, safe areas, keyboard handling, pull-to-refresh and an
 * optional pinned footer for the primary action. Content never sits under the status bar,
 * the home indicator, the tab bar or a pinned footer.
 */
export function Screen({
  title,
  subtitle,
  back,
  onBack,
  right,
  headerExtra,
  children,
  footer,
  scroll = true,
  padded = true,
  refreshing,
  onRefresh,
  plainHeader,
  header,
  pattern,
  testID,
}: {
  title?: string
  subtitle?: string
  back?: boolean
  onBack?: () => void
  right?: ReactNode
  /** Rendered inside the coloured header, under the title (e.g. a summary strip). */
  headerExtra?: ReactNode
  children: ReactNode
  footer?: ReactNode
  scroll?: boolean
  padded?: boolean
  refreshing?: boolean
  onRefresh?: () => void
  /** White header instead of the brand colour (used on sign-in style screens). */
  plainHeader?: boolean
  /** Replaces the standard header altogether (it then handles the top safe area itself). */
  header?: ReactNode
  /** The design's line-art pattern behind the content (default: the app's brand decides). */
  pattern?: boolean
  testID?: string
}) {
  const insets = useSafeAreaInsets()
  const router = useRouter()
  // The design's white header with a centred title, or the coloured band.
  const centred = screenHeader === 'centred'
  const light = plainHeader || centred || screenHeader === 'left'
  const fg = light && !plainHeader ? colors.title : plainHeader ? colors.textStrong : colors.headerText
  // A custom back action also answers the Android back button and replaces the iOS swipe.
  useBackOverride(back ? onBack : undefined)
  const goBack = () => {
    if (onBack) onBack()
    else if (router.canGoBack()) router.back()
    else router.replace('/')
  }

  const body = (
    <View style={[styles.column, padded && { padding: space.lg }, { gap: space.lg }]}>{children}</View>
  )

  return (
    <View testID={testID} style={styles.root}>
      {header ? (
        header
      ) : (title || back || right) ? (
        <View style={[styles.header, { paddingTop: insets.top + space.sm, backgroundColor: light ? colors.surface : colors.header },
          plainHeader && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}>
          <View style={[styles.column, styles.headerRow]}>
            {back ? (
              <Pressable testID="back" accessibilityRole="button" accessibilityLabel="Go back" hitSlop={8} onPress={goBack} style={styles.backBtn}>
                <Feather name="chevron-left" size={26} color={fg} />
              </Pressable>
            ) : centred && right ? <View style={styles.backBtn} /> : null}
            <View style={{ flex: 1, minWidth: 0 }}>
              {!!title && <Text numberOfLines={1} accessibilityRole="header" style={[centred ? font.h1 : font.h2, { color: fg }, centred && styles.centredText]}>{title}</Text>}
              {!!subtitle && <Text numberOfLines={1} style={[font.small, { color: light ? colors.textMuted : colors.headerMuted }, centred && styles.centredText]}>{subtitle}</Text>}
            </View>
            {right ? <View style={styles.headerRight}>{right}</View> : centred && back ? <View style={styles.backBtn} /> : null}
          </View>
          {headerExtra ? <View style={[styles.column, { paddingHorizontal: space.lg, paddingBottom: space.md }]}>{headerExtra}</View> : null}
        </View>
      ) : (
        <View style={{ height: insets.top, backgroundColor: colors.bg }} />
      )}

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {screenPattern !== undefined && (pattern ?? patternByDefault) && (
          // decoration only: faint, behind the content, never read out or touched
          <Image testID="screen-pattern" source={imageSource(screenPattern)} resizeMode="cover" accessible={false}
            pointerEvents="none" style={styles.pattern} accessibilityIgnoresInvertColors />
        )}
        {scroll ? (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ flexGrow: 1, paddingBottom: footer ? space.lg : space.xxl + insets.bottom }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.brand700} colors={[colors.brand700]} /> : undefined}
          >
            {body}
          </ScrollView>
        ) : (
          <View style={{ flex: 1 }}>{body}</View>
        )}
        {footer ? (
          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, space.md) }]}>
            {/* Padded inside the column, like the content above, so the two line up on tablets too. */}
            <View style={[styles.column, { gap: space.sm, paddingHorizontal: space.lg }]}>{footer}</View>
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </View>
  )
}

export function HeaderAction({ icon, label, onPress, badge, onBrand = true, testID }: { icon: IconName; label: string; onPress?: () => void; badge?: number; onBrand?: boolean; testID?: string }) {
  return <IconButton icon={icon} label={label} onPress={onPress} badge={badge} color={screenHeader !== 'band' ? colors.title : onBrand ? colors.headerText : colors.text} testID={testID} />
}

export function Section({ title, action, onAction, children, style }: { title?: string; action?: string; onAction?: () => void; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ gap: space.sm }, style]}>
      {(title || action) && (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 24 }}>
          {!!title && <Text accessibilityRole="header" style={[font.h3, { color: colors.textStrong, flex: 1 }]} numberOfLines={1}>{title}</Text>}
          {!!action && (
            <Pressable accessibilityRole="button" hitSlop={10} onPress={onAction}>
              <Text style={[font.smallStrong, { color: colors.brand700 }]}>{action}</Text>
            </Pressable>
          )}
        </View>
      )}
      {children}
    </View>
  )
}

/** A tappable list row: leading element, title + subtitle, trailing element / chevron. */
export function ListRow({
  title,
  subtitle,
  meta,
  left,
  right,
  onPress,
  chevron,
  testID,
  stripe,
}: {
  title: string
  subtitle?: string
  meta?: string
  left?: ReactNode
  right?: ReactNode
  onPress?: () => void
  chevron?: boolean
  testID?: string
  /** Drawn as its own card with the designs' coloured left edge (chat, lab cases, complaints, tickets). */
  stripe?: string
}) {
  const rowStyle = stripe ? [styles.row, styles.stripeRow, { borderLeftColor: stripe }] : styles.row
  const inner = (
    <>
      {left}
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text numberOfLines={1} style={[font.bodyStrong, { color: colors.text }]}>{title}</Text>
        {!!subtitle && <Text numberOfLines={2} style={[font.small, { color: colors.textMuted }]}>{subtitle}</Text>}
        {!!meta && <Text numberOfLines={1} style={[font.tiny, { color: colors.textFaint, ...face('medium') }]}>{meta}</Text>}
      </View>
      {right}
      {chevron && <Feather name="chevron-right" size={18} color={colors.textFaint} />}
    </>
  )
  if (!onPress) return <View testID={testID} style={rowStyle}>{inner}</View>
  return (
    <Pressable testID={testID} accessibilityRole="button" onPress={onPress} style={({ pressed }) => [rowStyle, pressed && { backgroundColor: colors.slateBg }]}>
      {inner}
    </Pressable>
  )
}

export function KeyValue({ label, value, strong }: { label: string; value?: string | number | null; strong?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.lg, paddingVertical: 6 }}>
      <Text style={[font.small, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[strong ? font.bodyStrong : font.small, { color: colors.text, flexShrink: 1, textAlign: 'right' }]}>
        {value === undefined || value === null || value === '' ? '—' : String(value)}
      </Text>
    </View>
  )
}

/** Round icon tile used in grids and list rows. */
export function IconTile({ icon, tone = 'brand', size = 44 }: { icon: IconName; tone?: 'brand' | 'slate' | 'amber' | 'red' | 'green' | 'blue'; size?: number }) {
  const { bg, fg } = accentColors[tone]
  return (
    <View style={{ width: size, height: size, borderRadius: radius.md, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      <Feather name={icon} size={size * 0.46} color={fg} />
    </View>
  )
}

const styles = StyleSheet.create({
  pattern: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%', opacity: 0.7 },
  root: { flex: 1, backgroundColor: colors.bg },
  column: { width: '100%', maxWidth: CONTENT_MAX_WIDTH, alignSelf: 'center' },
  header: { paddingBottom: space.sm },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: TOUCH + 4, paddingHorizontal: space.lg },
  backBtn: { width: 36, height: TOUCH, marginLeft: -8, alignItems: 'center', justifyContent: 'center' },
  centredText: { textAlign: 'center' },
  headerRight: { flexDirection: 'row', alignItems: 'center', marginRight: -8 },
  footer: { paddingTop: space.md, backgroundColor: colors.surface, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, paddingHorizontal: space.lg, minHeight: 60 },
  stripeRow: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: cardBorder ? 1 : 0, borderColor: colors.border, borderLeftWidth: 6, ...shadow },
})
