/**
 * The Consultant app's look, from the blue "Consultant app" half of the dentor Figma file
 * (docs/design/dentor.fig, frames from "First Screen" 3973:42507 to "logout" 3973:30719).
 * Imported first by index.js and index.web.tsx, before the shared theme reads it.
 *
 * Values marked "design" are the file's own; "derived" are tints the kit needs that the file
 * does not specify.
 */
import type { Brand } from '@dentor/shared' // type only: erased, so the theme is not loaded early
import pattern from './assets/design/pattern.png'

const brand: Brand = {
  colors: {
    header: '#0a338e', // design: bottom bar, primary buttons
    headerText: '#ffffff',
    headerMuted: '#ffffff',
    accent: '#fdc500', // design: icons on the bar, "Current Month", section bands
    title: '#0a338e', // design: screen titles ("my appointments", "Settings")
    barMuted: '#fdc500',
    brand700: '#0a338e', // design
    brand600: '#1252c9', // design: links and figures ("Hi, WelcomeBack", totals)
    brand800: '#082a75', // derived
    brand900: '#061f57', // derived
    brand500: '#1252c9',
    brand50: '#f3f6ff', // design: the "total appointments" band
    brand100: '#dde6fb', // derived
    brand200: '#b9c9f2', // derived
    bg: '#ffffff', // design
    textStrong: '#000000', // design
    text: '#000000',
    textMuted: '#746d6d', // design: card details
    border: '#cccbcb', // design: card outline
    fieldBg: '#fbf5f5', // design: login fields
    fieldBorder: '#d9d9d9', // design
  },
  fonts: { light: 'NotoSans-Regular', regular: 'NotoSans-Regular', medium: 'NotoSans-Medium', semibold: 'NotoSans-SemiBold', bold: 'NotoSans-Bold' }, // design: Noto Sans
  card: { border: true, shadow: 'design' }, // design: outline #cccbcb with drop shadow 0 4 4 25%
  radius: { md: 13, lg: 13 }, // design: cards radius 13
  screenHeader: 'left', // design: white header, back arrow and title in #0a338e on the left
  pattern, // design: the line-art background of the Log In frames, behind every screen
  patternByDefault: true,
}

;(globalThis as { __DENTOR_BRAND__?: Brand }).__DENTOR_BRAND__ = brand
