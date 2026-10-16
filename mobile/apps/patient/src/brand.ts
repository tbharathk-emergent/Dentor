/**
 * The patient app's look, from the patient-app Figma file (docs/design/patient-app.fig).
 * Imported first by index.js and index.web.tsx, before the shared theme reads it.
 *
 * Every value marked "design" is the file's own. Values marked "derived" are tints the shared
 * kit needs (light backgrounds, hover shades) that the file does not specify.
 */
import type { Brand } from '@dentor/shared' // type only: erased, so the theme is not loaded early

const brand: Brand = {
  colors: {
    header: '#007ba4', // design: header band and bottom bar
    headerText: '#ffffff', // design: "Hi, WelcomeBack"
    headerMuted: '#ffffff',
    accent: '#ffc909', // design: patient name and id, header icons, home button
    title: '#1d8992', // design: centred screen titles ("Notification", "Settings")
    barMuted: '#ffffff', // design: bottom bar icons
    brand500: '#47b5be', // design: banners, "Call Clinic"
    brand700: '#1d8992', // design: buttons, date chips, icons
    brand600: '#1d8992',
    brand800: '#156a71', // derived: darker shade for text on brand tints
    brand900: '#0f4f54', // derived
    brand50: '#e8f4f5', // derived: light tint of #1d8992
    brand100: '#d1e9eb', // derived
    brand200: '#a5d3d7', // derived
    bg: '#ffffff', // design: screens are white
    textStrong: '#000000', // design
    text: '#1e1e1e', // design
    textMuted: '#666666', // design: card meta text
    border: '#d9d9d9', // design: card and field outlines
    fieldBg: '#fff9f9', // design: text fields
    fieldBorder: '#d9d9d9', // design
  },
  // design: Segoe UI and Noto Sans for text (Segoe UI is not licensed for apps; Noto Sans stands in),
  // League Spartan SemiBold for titles.
  fonts: { light: 'NotoSans-Regular', regular: 'NotoSans-Regular', medium: 'NotoSans-Medium', semibold: 'NotoSans-SemiBold', bold: 'NotoSans-Bold' },
  headingFonts: { light: 'LeagueSpartan-Light', regular: 'LeagueSpartan-Regular', medium: 'LeagueSpartan-Medium', semibold: 'LeagueSpartan-SemiBold', bold: 'LeagueSpartan-SemiBold' },
  type: { h1: { fontSize: 24, lineHeight: 28 } }, // design: League Spartan SemiBold 24 titles
  card: { border: true, shadow: 'design' }, // design: hairline outline with drop shadow 0 4 4 25%
  radius: { md: 10, lg: 10 }, // design: cards and fields r10
  screenHeader: 'centred',
}

;(globalThis as { __DENTOR_BRAND__?: Brand }).__DENTOR_BRAND__ = brand
