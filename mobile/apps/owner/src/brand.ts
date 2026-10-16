/**
 * The Owner app's look, from the red "Clinic app" half of the dentor Figma file
 * (docs/design/dentor.fig, frames from "PERMISSIONS" 4151:3880 to "referel certificate"
 * 4893:4031). Imported first by index.js and index.web.tsx, before the shared theme reads it.
 *
 * Which design the Owner app should follow is still an open question (docs/DESIGN_REVIEW.md,
 * "Decisions needed"); this applies the Clinic app's colours, type and chrome to the screens
 * the Owner app has. Values marked "design" are the file's own; "derived" are tints the kit
 * needs that the file does not specify.
 */
import type { Brand } from '@dentor/shared' // type only: erased, so the theme is not loaded early
import pattern from './assets/design/pattern.png'

const brand: Brand = {
  colors: {
    header: '#ff0004', // design: bottom bar, buttons
    headerText: '#ffffff',
    headerMuted: '#ffffff',
    accent: '#ffffff', // design: icons on the red bar
    title: '#ff0004', // design: screen titles ("Settings", "LABS")
    barMuted: '#ffffff',
    brand700: '#ff0004', // design
    brand600: '#ff0004', // design: "Hi, WelcomeBack"
    brand500: '#ff2226', // design: login button
    brand800: '#c20003', // derived
    brand900: '#8f0002', // derived
    brand50: '#fff9f9', // design: tinted backgrounds
    brand100: '#ffdad6', // design
    brand200: '#ffb3b0', // derived
    bg: '#ffffff', // design
    textStrong: '#000000', // design
    text: '#000000',
    textMuted: '#746d6d', // design
    border: '#d9d9d9', // design
    fieldBg: '#fbf5f5', // design: login fields
    fieldBorder: '#d9d9d9', // design
  },
  fonts: { light: 'NotoSans-Regular', regular: 'NotoSans-Regular', medium: 'NotoSans-Medium', semibold: 'NotoSans-SemiBold', bold: 'NotoSans-Bold' }, // design: Noto Sans
  card: { border: true, shadow: 'design' }, // design: drop shadow 0 4 4 25%
  radius: { md: 8, lg: 10 }, // design: radius 8 and 10 most used
  screenHeader: 'left', // design: white header, red back arrow and title on the left
  pattern, // design: the line-art background of the Log In frames, behind the screens that draw it (labs, complaints, offers, booking a consultant)
  patternByDefault: false,
}

;(globalThis as { __DENTOR_BRAND__?: Brand }).__DENTOR_BRAND__ = brand
