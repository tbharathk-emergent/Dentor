import { Feather } from './icons'
import { useState, type ReactNode } from 'react'
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native'
import { initials } from '../format'
import { cardBorder, colors, font, radius, shadow, space, statusTone, textColorFor, toneColors, TOUCH, type Tone, face } from '../theme'

export type { IconName } from './icons'
import type { IconName } from './icons'

export function Icon({ name, size = 20, color = colors.textMuted }: { name: IconName; size?: number; color?: string }) {
  return <Feather name={name} size={size} color={color} />
}

/* ------------------------------------------------------------------ text */

type TextVariant = keyof typeof font

export function T({
  children,
  variant = 'body',
  color,
  style,
  numberOfLines,
  center,
  testID,
}: {
  children: ReactNode
  variant?: TextVariant
  /** Defaults to the text colour of the variant: stronger for headings. */
  color?: string
  style?: StyleProp<TextStyle>
  numberOfLines?: number
  center?: boolean
  testID?: string
}) {
  return (
    <Text testID={testID} numberOfLines={numberOfLines} style={[font[variant], { color: color ?? textColorFor(variant) }, center && { textAlign: 'center' }, style]}>
      {children}
    </Text>
  )
}

/* ---------------------------------------------------------------- button */

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'

const buttonColors: Record<ButtonVariant, { bg: string; fg: string; border: string }> = {
  primary: { bg: colors.brand700, fg: colors.onBrand, border: colors.brand700 },
  secondary: { bg: colors.brand50, fg: colors.brand800, border: colors.brand200 },
  outline: { bg: colors.surface, fg: colors.text, border: colors.borderStrong },
  ghost: { bg: 'transparent', fg: colors.brand700, border: 'transparent' },
  danger: { bg: colors.red, fg: colors.onBrand, border: colors.red },
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  loading,
  disabled,
  full,
  style,
  testID,
}: {
  label: string
  onPress?: () => void
  variant?: ButtonVariant
  size?: 'sm' | 'md' | 'lg'
  icon?: IconName
  loading?: boolean
  disabled?: boolean
  full?: boolean
  style?: StyleProp<ViewStyle>
  testID?: string
}) {
  const c = buttonColors[variant]
  const height = size === 'lg' ? 52 : size === 'sm' ? 36 : TOUCH + 2
  const off = disabled || loading
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      disabled={off}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { height, backgroundColor: c.bg, borderColor: c.border, opacity: off ? 0.55 : pressed ? 0.85 : 1 },
        size === 'sm' && { paddingHorizontal: space.md },
        full && { alignSelf: 'stretch' },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={c.fg} />
      ) : (
        <>
          {icon && <Feather name={icon} size={size === 'sm' ? 15 : 18} color={c.fg} />}
          <Text numberOfLines={1} style={[size === 'sm' ? font.smallStrong : font.bodyStrong, { color: c.fg }]}>
            {label}
          </Text>
        </>
      )}
    </Pressable>
  )
}

export function IconButton({
  icon,
  onPress,
  label,
  color = colors.text,
  badge,
  testID,
}: {
  icon: IconName
  onPress?: () => void
  label: string
  color?: string
  badge?: number
  testID?: string
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [styles.iconButton, pressed && { opacity: 0.6 }]}
    >
      <Feather name={icon} size={22} color={color} />
      {!!badge && (
        <View style={styles.dot}>
          <Text style={styles.dotText}>{badge > 9 ? '9+' : badge}</Text>
        </View>
      )}
    </Pressable>
  )
}

/* ----------------------------------------------------------------- field */

export function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  hint,
  secure,
  keyboardType,
  icon,
  multiline,
  maxLength,
  autoCapitalize = 'sentences',
  editable = true,
  required,
  onSubmitEditing,
  testID,
}: {
  label?: string
  value: string
  onChangeText: (text: string) => void
  placeholder?: string
  error?: string
  hint?: string
  secure?: boolean
  keyboardType?: KeyboardTypeOptions
  icon?: IconName
  multiline?: boolean
  maxLength?: number
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters'
  editable?: boolean
  required?: boolean
  onSubmitEditing?: () => void
  testID?: string
}) {
  const [hidden, setHidden] = useState(!!secure)
  const [focused, setFocused] = useState(false)
  return (
    <View style={{ gap: 6 }}>
      {!!label && (
        <Text style={[font.smallStrong, { color: colors.text }]}>
          {label}
          {required && <Text style={{ color: colors.red }}> *</Text>}
        </Text>
      )}
      <View
        style={[
          styles.field,
          multiline && { height: undefined, minHeight: 96, alignItems: 'flex-start', paddingVertical: space.md },
          focused && { borderColor: colors.brand600 },
          !!error && { borderColor: colors.red },
          !editable && { backgroundColor: colors.slateBg },
        ]}
      >
        {icon && <Feather name={icon} size={18} color={colors.textFaint} />}
        <TextInput
          testID={testID}
          accessibilityLabel={label || placeholder}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textFaint}
          secureTextEntry={hidden}
          keyboardType={keyboardType}
          multiline={multiline}
          maxLength={maxLength}
          autoCapitalize={secure ? 'none' : autoCapitalize}
          autoCorrect={!secure && keyboardType === undefined}
          editable={editable}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onSubmitEditing={onSubmitEditing}
          returnKeyType={onSubmitEditing ? 'done' : undefined}
          textAlignVertical={multiline ? 'top' : 'center'}
          style={[styles.input, multiline && { minHeight: 72 }]}
        />
        {secure && (
          <Pressable accessibilityRole="button" accessibilityLabel={hidden ? 'Show password' : 'Hide password'} hitSlop={10} onPress={() => setHidden((h) => !h)}>
            <Feather name={hidden ? 'eye' : 'eye-off'} size={18} color={colors.textMuted} />
          </Pressable>
        )}
      </View>
      {!!error ? (
        <Text style={[font.small, { color: colors.red }]}>{error}</Text>
      ) : hint ? (
        <Text style={[font.small, { color: colors.textMuted }]}>{hint}</Text>
      ) : null}
    </View>
  )
}

/* ------------------------------------------------------------- surfaces */

export function Card({
  children,
  onPress,
  style,
  padded = true,
  testID,
  stripe,
}: {
  children: ReactNode
  onPress?: () => void
  style?: StyleProp<ViewStyle>
  padded?: boolean
  testID?: string
  /** The designs' coloured left edge on list cards (status or kind), e.g. dentor.fig "RE- VISIT", "Chat", "complaints". */
  stripe?: string
}) {
  const base = [styles.card, padded && { padding: space.lg }, !!stripe && { borderLeftWidth: 6, borderLeftColor: stripe }, style]
  if (!onPress) return <View testID={testID} style={base}>{children}</View>
  return (
    <Pressable testID={testID} accessibilityRole="button" onPress={onPress} style={({ pressed }) => [base, pressed && { opacity: 0.9 }]}>
      {children}
    </Pressable>
  )
}

export function Divider({ inset = 0 }: { inset?: number }) {
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: inset }} />
}

export function Row({ children, gap = space.md, style, wrap }: { children: ReactNode; gap?: number; style?: StyleProp<ViewStyle>; wrap?: boolean }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, wrap && { flexWrap: 'wrap' }, style]}>{children}</View>
}

/* ---------------------------------------------------------------- badges */

export function Badge({ label, tone = 'slate', testID }: { label: string; tone?: Tone; testID?: string }) {
  const c = toneColors[tone]
  return (
    <View testID={testID} style={[styles.badge, { backgroundColor: c.bg }]}>
      <Text numberOfLines={1} style={[font.tiny, { color: c.fg }]}>{label}</Text>
    </View>
  )
}

export function StatusBadge({ status }: { status?: string | null }) {
  if (!status) return null
  return <Badge label={status} tone={statusTone(status)} />
}

export function Avatar({ name, uri, size = 44 }: { name?: string | null; uri?: string | null; size?: number }) {
  if (uri) return <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.slateBg }} />
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={{ color: colors.brand800, ...face('bold'), fontSize: size * 0.36 }}>{initials(name)}</Text>
    </View>
  )
}

/* -------------------------------------------------------------- choosers */

export function Chip({ label, selected, onPress, disabled, testID }: { label: string; selected?: boolean; onPress?: () => void; disabled?: boolean; testID?: string }) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected, disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.chip,
        selected && { backgroundColor: colors.brand700, borderColor: colors.brand700 },
        disabled && { opacity: 0.4 },
      ]}
    >
      <Text style={[font.smallStrong, { color: selected ? colors.onBrand : colors.text }]}>{label}</Text>
    </Pressable>
  )
}

export function Segmented<K extends string>({
  options,
  value,
  onChange,
}: {
  options: { key: K; label: string }[]
  value: K
  onChange: (key: K) => void
}) {
  return (
    <View style={styles.segmented}>
      {options.map((o) => {
        const on = o.key === value
        return (
          <Pressable
            key={o.key}
            testID={`segment-${o.key}`}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(o.key)}
            style={[styles.segment, on && styles.segmentOn]}
          >
            <Text numberOfLines={1} style={[font.smallStrong, { color: on ? colors.brand800 : colors.textMuted }]}>{o.label}</Text>
          </Pressable>
        )
      })}
    </View>
  )
}

/** Inline notice: info, success, warning or error. */
export function Banner({ text, tone = 'blue', icon, testID }: { text: string; tone?: Tone; icon?: IconName; testID?: string }) {
  const c = toneColors[tone]
  return (
    <View testID={testID} style={[styles.banner, { backgroundColor: c.bg }]}>
      {icon && <Feather name={icon} size={16} color={c.fg} style={{ marginTop: 2 }} />}
      <Text style={[font.small, { color: c.fg, flex: 1, ...face('medium') }]}>{text}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    paddingHorizontal: space.xl,
    borderRadius: radius.md,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  iconButton: { width: TOUCH, height: TOUCH, alignItems: 'center', justifyContent: 'center' },
  dot: {
    position: 'absolute', top: 4, right: 2, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4,
    backgroundColor: colors.red, alignItems: 'center', justifyContent: 'center',
  },
  dotText: { color: '#fff', fontSize: 10, ...face('bold') },
  field: {
    flexDirection: 'row', alignItems: 'center', gap: space.sm, height: 48, paddingHorizontal: space.md,
    borderWidth: 1, borderColor: colors.fieldBorder, borderRadius: radius.md, backgroundColor: colors.fieldBg,
  },
  // 16px keeps iOS Safari from zooming the page when a field is focused.
  input: { flex: 1, minWidth: 0, fontSize: 16, color: colors.text, paddingVertical: 0, outlineWidth: 0 },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: cardBorder ? 1 : 0, borderColor: colors.border, ...shadow },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill, alignSelf: 'flex-start', maxWidth: 160 },
  avatar: { backgroundColor: colors.brand100, alignItems: 'center', justifyContent: 'center' },
  chip: {
    minHeight: 38, paddingHorizontal: space.lg, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.borderStrong,
    backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center',
  },
  segmented: { flexDirection: 'row', backgroundColor: colors.slateBg, borderRadius: radius.md, padding: 3 },
  segment: { flex: 1, minHeight: 36, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm, paddingHorizontal: space.sm },
  segmentOn: { backgroundColor: colors.surface, ...shadow },
  banner: { flexDirection: 'row', gap: space.sm, padding: space.md, borderRadius: radius.md },
})
