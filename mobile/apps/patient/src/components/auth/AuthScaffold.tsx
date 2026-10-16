import { CONTENT_MAX_WIDTH, IconButton, colors, imageSource, space, useBackOverride } from '@dentor/shared'
import type { ReactNode } from 'react'
import { Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import headerArt from '@/assets/design/login-header.png'
import logo from '@/assets/design/logo-on-teal.png'
import pattern from '@/assets/design/pattern.png'

/**
 * Frame for the signed-out screens, as the patient design draws them: white, with the dental
 * line-art pattern behind the content.
 *
 * - `hero` (frame "Log In" 1:7323): the folded teal header with the DENTOR logo, the title in
 *   gold League Spartan SemiBold 24 and the tagline in white.
 * - otherwise (frames "forget password" 108:3392 and the rest of that flow): a back chevron and
 *   the title centred in League Spartan SemiBold 24, #1d8992, then the subtitle.
 *
 * The company line "A Unit Of IQDS DENTAL INDIA Pvt. Ltd.," closes every screen, as in the design.
 */
export function AuthScaffold({
  title,
  subtitle,
  onBack,
  hero,
  children,
  testID,
}: {
  title: string
  subtitle?: string
  onBack?: () => void
  hero?: boolean
  children: ReactNode
  testID?: string
}) {
  const insets = useSafeAreaInsets()
  // The design is drawn for a 360 pt phone. On a tablet the header keeps a phone's size (at most
  // 380 wide, centred) so the form stays above the keyboard. Sizes are worked out here: iOS
  // applies an aspect ratio before a maximum width.
  const heroWidth = Math.min(useWindowDimensions().width, 380)
  const heroSize = { width: heroWidth, height: Math.round((heroWidth * 300) / 361) }
  const logoSize = { width: Math.round(heroWidth * 0.7), height: Math.round((heroWidth * 0.7 * 97) / 253) }
  // The Android back button does what this screen's own back button does.
  useBackOverride(onBack)
  return (
    <KeyboardAvoidingView testID={testID} style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Image source={imageSource(pattern)} style={styles.pattern} resizeMode="cover" accessibilityIgnoresInvertColors />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {hero ? (
          <View style={[styles.hero, heroSize, { height: heroSize.height + insets.top, paddingTop: insets.top }]}>
            <Image source={imageSource(headerArt)} style={styles.heroArt} resizeMode="stretch" accessibilityIgnoresInvertColors />
            <View style={styles.heroContent}>
              <Image source={imageSource(logo)} style={logoSize} resizeMode="contain" accessibilityLabel="DENTOR, Dentistry Amassed" />
              <Text accessibilityRole="header" style={styles.heroTitle}>{title}</Text>
              {!!subtitle && <Text style={styles.heroSubtitle}>{subtitle}</Text>}
            </View>
          </View>
        ) : (
          <View style={[styles.bar, { paddingTop: insets.top + space.md }]}>
            {onBack ? (
              <View style={styles.back}>
                <IconButton testID="back" icon="chevron-left" label="Go back" color={colors.title} onPress={onBack} />
              </View>
            ) : (
              <View style={styles.back} />
            )}
            <Text accessibilityRole="header" numberOfLines={2} style={styles.title}>{title}</Text>
            <View style={styles.back} />
          </View>
        )}
        <View style={[styles.body, { paddingBottom: Math.max(insets.bottom, space.lg) }]}>
          {!hero && !!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
          {children}
          <Text style={styles.company}>A Unit Of IQDS DENTAL INDIA Pvt. Ltd.,</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  pattern: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%' },
  scroll: { flexGrow: 1 },
  // design: the folded header art is 361 x 335 on a 360 wide screen
  hero: { alignSelf: 'center' },
  heroArt: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' },
  heroContent: { flex: 1, alignItems: 'center', paddingTop: '6%', paddingHorizontal: space.lg },
  heroTitle: { marginTop: space.md, fontFamily: 'LeagueSpartan-SemiBold', fontSize: 24, lineHeight: 28, color: '#fdc500', textAlign: 'center' },
  // Stretched to the column: iOS does not wrap a centred text that only has a maximum width.
  heroSubtitle: { marginTop: 2, alignSelf: 'stretch', paddingHorizontal: space.md, fontFamily: 'NotoSans-Regular', fontSize: 11, lineHeight: 14, color: '#ffffff', textAlign: 'center' },
  bar: { width: '100%', maxWidth: CONTENT_MAX_WIDTH, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.md },
  back: { width: 44 },
  title: { flex: 1, fontFamily: 'LeagueSpartan-SemiBold', fontSize: 24, lineHeight: 28, color: colors.title, textAlign: 'center' },
  body: { flexGrow: 1, width: '100%', maxWidth: CONTENT_MAX_WIDTH, alignSelf: 'center', gap: space.lg, paddingHorizontal: 24, paddingTop: space.lg },
  subtitle: { fontFamily: 'NotoSans-Medium', fontSize: 13, lineHeight: 18, color: '#000000', textAlign: 'center' },
  company: { marginTop: 'auto', paddingTop: space.xl, fontFamily: 'NotoSans-Bold', fontSize: 12, lineHeight: 16, color: '#070707', textAlign: 'center' },
})
