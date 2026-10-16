import { CONTENT_MAX_WIDTH, IconButton, T, TOUCH, colors, space } from '@dentor/shared'
import { useCallback, useEffect, useRef, type ComponentRef, type ReactNode } from 'react'
import { Keyboard, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter } from '@/nav'

/**
 * Screen frame for a message thread. Same header as the kit's `Screen`, but the body is a
 * list that stays scrolled to the newest message, with the composer pinned above the
 * keyboard — which `Screen` cannot do because it owns its scroll view.
 */
export function ThreadFrame({
  title,
  subtitle,
  right,
  children,
  composer,
  testID,
}: {
  title: string
  subtitle?: string
  right?: ReactNode
  /** The messages, oldest first. */
  children: ReactNode
  composer: ReactNode
  testID?: string
}) {
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null)
  const toNewest = useCallback(() => scroll.current?.scrollToEnd({ animated: false }), [])

  useEffect(() => {
    const shown = Keyboard.addListener('keyboardDidShow', toNewest)
    return () => shown.remove()
  }, [toNewest])

  return (
    <View testID={testID} style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + space.sm }]}>
        <View style={[styles.column, styles.headerRow]}>
          <View style={styles.back}>
            <IconButton
              testID="back"
              icon="chevron-left"
              label="Go back"
              color={colors.onBrand}
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
            />
          </View>
          <View style={styles.titles}>
            <T variant="h2" color={colors.onBrand} numberOfLines={1}>{title}</T>
            {!!subtitle && <T variant="small" color={colors.brand100} numberOfLines={1}>{subtitle}</T>}
          </View>
          {right ? <View style={styles.right}>{right}</View> : null}
        </View>
      </View>

      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          ref={scroll}
          testID="thread-scroll"
          style={styles.fill}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={toNewest}
        >
          <View style={[styles.column, styles.messages]}>{children}</View>
        </ScrollView>
        <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, space.sm) }]}>
          <View style={[styles.column, styles.composerColumn]}>{composer}</View>
        </View>
      </KeyboardAvoidingView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  fill: { flex: 1 },
  column: { width: '100%', maxWidth: CONTENT_MAX_WIDTH, alignSelf: 'center' },
  header: { paddingBottom: space.sm, backgroundColor: colors.brand700 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: TOUCH + 4, paddingHorizontal: space.lg },
  back: { marginLeft: -space.md, marginRight: -space.xs },
  titles: { flex: 1, minWidth: 0 },
  right: { flexDirection: 'row', alignItems: 'center', marginRight: -space.sm },
  // Side padding sits inside the centred column (as in the kit's `Screen`), so on a tablet the
  // thread and the composer keep to the same column as the header above them.
  content: { flexGrow: 1, paddingVertical: space.lg },
  messages: { flexGrow: 1, gap: space.sm, paddingHorizontal: space.lg },
  composer: {
    paddingTop: space.sm, backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border,
  },
  composerColumn: { paddingHorizontal: space.md },
})
