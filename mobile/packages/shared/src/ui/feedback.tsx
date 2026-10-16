import { Feather } from './icons'
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { errorMessage } from '../api'
import { colors, font, radius, shadow, space, face } from '../theme'
import { Button } from './primitives'

/* ----------------------------------------------------------------- toast */

type ToastKind = 'success' | 'error' | 'info'
interface ToastApi {
  success: (message: string) => void
  error: (error: unknown, fallback?: string) => void
  info: (message: string) => void
}

const ToastCtx = createContext<ToastApi>({ success: () => {}, error: () => {}, info: () => {} })
export const useToast = () => useContext(ToastCtx)

export function ToastProvider({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets()
  const [toast, setToast] = useState<{ kind: ToastKind; message: string; id: number } | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const show = useCallback((kind: ToastKind, message: string) => {
    if (timer.current) clearTimeout(timer.current)
    setToast({ kind, message, id: Date.now() })
    timer.current = setTimeout(() => setToast(null), kind === 'error' ? 4500 : 3000)
  }, [])
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  const api = useRef<ToastApi>({
    success: (m) => show('success', m),
    info: (m) => show('info', m),
    error: (e, fallback) => show('error', typeof e === 'string' ? e : errorMessage(e, fallback)),
  }).current

  const tone = toast?.kind === 'error' ? colors.red : toast?.kind === 'success' ? colors.green : colors.ink
  return (
    <ToastCtx.Provider value={api}>
      {children}
      {toast && (
        <View pointerEvents="box-none" style={[styles.toastWrap, { top: insets.top + space.sm }]}>
          <Pressable
            testID={`toast-${toast.kind}`}
            accessibilityRole="alert"
            onPress={() => setToast(null)}
            style={[styles.toast, { backgroundColor: tone }]}
          >
            <Feather name={toast.kind === 'error' ? 'alert-circle' : toast.kind === 'success' ? 'check-circle' : 'info'} size={18} color="#fff" />
            <Text style={[font.small, { color: '#fff', flex: 1, ...face('semibold') }]}>{toast.message}</Text>
          </Pressable>
        </View>
      )}
    </ToastCtx.Provider>
  )
}

/* ----------------------------------------------------------------- sheet */

/** Bottom sheet for forms and details; keeps its actions above the keyboard and home indicator. */
export function Sheet({
  visible,
  onClose,
  title,
  subtitle,
  children,
  footer,
  testID,
}: {
  visible: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: ReactNode
  footer?: ReactNode
  testID?: string
}) {
  const insets = useSafeAreaInsets()
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.sheetRoot}>
        <Pressable accessibilityLabel="Close" style={StyleSheet.absoluteFill} onPress={onClose} />
        <View testID={testID ?? 'sheet'} style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, space.lg) }]}>
          <View style={styles.grabber} />
          <View style={styles.sheetHeader}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text numberOfLines={1} style={[font.h2, { color: colors.textStrong }]}>{title}</Text>
              {!!subtitle && <Text numberOfLines={2} style={[font.small, { color: colors.textMuted }]}>{subtitle}</Text>}
            </View>
            <Pressable testID="sheet-close" accessibilityRole="button" accessibilityLabel="Close" hitSlop={10} onPress={onClose} style={styles.close}>
              <Feather name="x" size={20} color={colors.textMuted} />
            </Pressable>
          </View>
          <ScrollView style={{ flexGrow: 0 }} contentContainerStyle={{ padding: space.lg, gap: space.lg }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {children}
          </ScrollView>
          {footer ? <View style={styles.sheetFooter}>{footer}</View> : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

/** Confirmation for destructive or irreversible actions. */
export function ConfirmSheet({
  visible,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  danger,
  loading,
}: {
  visible: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmLabel?: string
  danger?: boolean
  loading?: boolean
}) {
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={title}
      testID="confirm-sheet"
      footer={
        <>
          <Button testID="confirm-yes" label={confirmLabel} variant={danger ? 'danger' : 'primary'} onPress={onConfirm} loading={loading} full />
          <Button testID="confirm-no" label="Not now" variant="ghost" onPress={onClose} full />
        </>
      }
    >
      <Text style={[font.body, { color: colors.textMuted }]}>{message}</Text>
    </Sheet>
  )
}

const styles = StyleSheet.create({
  toastWrap: { position: 'absolute', left: space.lg, right: space.lg, alignItems: 'center', zIndex: 1000 },
  toast: { flexDirection: 'row', alignItems: 'center', gap: space.sm, maxWidth: 560, width: '100%', paddingHorizontal: space.lg, paddingVertical: space.md, borderRadius: radius.md, ...shadow },
  sheetRoot: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(11,31,51,0.45)' },
  sheet: { width: '100%', maxWidth: 640, alignSelf: 'center', maxHeight: '90%', backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong, marginTop: space.sm },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: space.sm },
  close: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.slateBg, alignItems: 'center', justifyContent: 'center' },
  sheetFooter: { paddingHorizontal: space.lg, paddingTop: space.md, gap: space.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
})
