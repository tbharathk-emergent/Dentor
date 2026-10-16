/**
 * Dentor mobile design tokens — the reception web app's palette (the CMS design's teal on
 * soft slate neutrals), tuned for touch. Each app overrides it with its own design (src/brand.ts).
 *
 * Screens must take colours, spacing and type from here so that a design pass
 * (when the Figma files become readable) is a change to this file and the UI kit,
 * not to every screen.
 *
 * The colours are the reception web app's. Its brand and ink scales are declared in
 * frontend/src/index.css; everything else there is Tailwind's own palette (v4), which is
 * written in OKLCH, so the hex values below are what a browser paints for those classes.
 * A comment of the form `// slate-500` after a hex value names the web colour it stands for;
 * `npm test` checks every such pair against the web app's stylesheet (tests/consistency.test.mjs).
 */
import { Platform } from 'react-native'
import type { Tone } from './status'

// Which status, lead stage, login role or risk level is shown in which tone is in status.ts.
export { leadStageTone, riskTone, roleTone, statusTone } from './status'
export type { Tone } from './status'

/**
 * Each app may set its own brand from its Figma design before anything else loads: its
 * `src/brand.ts`, imported first by index.js and index.web.tsx, puts a `Brand` on
 * `globalThis.__DENTOR_BRAND__`. Without one an app keeps the reception web app's palette and
 * the system font, which is what the values below are.
 */
export interface Brand {
  /** Overrides of the palette below and of the brand-only colours after it. */
  colors?: Partial<Record<keyof typeof webColors | keyof typeof brandColors, string>>
  /** Font files per weight (each is its own family, named as the file). */
  fonts?: Partial<Record<FontWeightName, string>>
  /** Headings may use another family than the text. */
  headingFonts?: Partial<Record<FontWeightName, string>>
  /** Type sizes per text variant, where the design differs from the defaults. */
  type?: Partial<Record<TextVariantName, { fontSize: number; lineHeight: number }>>
  /** Shadow and outline of cards. */
  card?: { border?: boolean; shadow?: 'soft' | 'design' }
  radius?: Partial<Record<'sm' | 'md' | 'lg' | 'xl', number>>
  /**
   * "band": coloured header with the title on the left (default). "centred": white header,
   * title centred in the title colour. "left": white header, title on the left in the title colour.
   */
  screenHeader?: 'band' | 'centred' | 'left'
  /**
   * The designs' line-art pattern behind screens (staff apps). `patternByDefault` puts it behind every
   * screen; otherwise a screen asks for it with `<Screen pattern>`, as the design draws it there.
   */
  pattern?: number | string
  patternByDefault?: boolean
}
export type FontWeightName = 'light' | 'regular' | 'medium' | 'semibold' | 'bold'
type TextVariantName = 'h1' | 'h2' | 'h3' | 'body' | 'bodyStrong' | 'small' | 'smallStrong' | 'tiny'
const brand: Brand = (globalThis as { __DENTOR_BRAND__?: Brand }).__DENTOR_BRAND__ ?? {}

const webColors = {
  brand50: '#eaf7fa', // brand-50
  brand100: '#b9e7f3', // brand-100
  brand200: '#8fd6ea', // brand-200
  brand500: '#0092ab', // brand-500
  brand600: '#117d92', // brand-600
  brand700: '#146575', // brand-700
  brand800: '#10525f', // brand-800
  brand900: '#0c3f49', // brand-900
  ink: '#0b1f33', // ink-900

  bg: '#f8fafc', // slate-50, the page background
  surface: '#ffffff',
  border: '#e2e8f0', // slate-200, cards and dividers
  borderStrong: '#cad5e2', // slate-300, fields and outline buttons

  textStrong: '#0f172b', // slate-900, headings and figures
  text: '#1d293d', // slate-800, everything else
  textMuted: '#62748e', // slate-500
  textFaint: '#90a1b9', // slate-400
  onBrand: '#ffffff',

  // Badge colours: the text shade (-700) on the tint (-50) of the web app's <Badge>.
  green: '#007a55', // emerald-700
  greenBg: '#ecfdf5', // emerald-50
  amber: '#bb4d00', // amber-700
  amberBg: '#fffbeb', // amber-50
  redDark: '#c10007', // red-700
  redBg: '#fef2f2', // red-50
  blue: '#0069a8', // sky-700
  blueBg: '#f0f9ff', // sky-50
  violet: '#7008e7', // violet-700
  violetBg: '#f5f3ff', // violet-50
  slate: '#45556c', // slate-600
  slateBg: '#f1f5f9', // slate-100

  red: '#e7000b', // red-600, for destructive buttons, error messages and count dots
} as const

/** Colours only a brand uses; by default they are the palette's own. */
const brandColors = {
  /** The coloured header band and bottom bar. */
  header: webColors.brand700,
  headerText: webColors.onBrand,
  headerMuted: webColors.brand100,
  /** Highlight on the header (names, the active tab): the design's gold where it has one. */
  accent: webColors.onBrand,
  /** Titles on white headers. */
  title: webColors.textStrong,
  /** Inactive icons on the bottom bar. */
  barMuted: webColors.brand200,
  /** Text fields. */
  fieldBg: webColors.surface,
  fieldBorder: webColors.borderStrong,
}

export const colors: typeof webColors & typeof brandColors = { ...webColors, ...brandColors, ...(brand.colors as object) } as never

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28 } as const
export const radius = { sm: 8, md: 12, lg: 16, xl: 24, pill: 999, ...brand.radius }

const SYSTEM_WEIGHT: Record<FontWeightName, '300' | '400' | '500' | '600' | '700'> = { light: '300', regular: '400', medium: '500', semibold: '600', bold: '700' }

/**
 * Text style for a weight: the brand's font file for it, or the system font at that weight.
 * A custom font file carries its weight, so no fontWeight is set with it (Android would
 * otherwise draw a synthetic bold).
 */
export function face(weight: FontWeightName, heading = false): { fontFamily?: string; fontWeight: '300' | '400' | '500' | '600' | '700' | 'normal' } {
  const family = (heading ? brand.headingFonts?.[weight] : undefined) ?? brand.fonts?.[weight]
  return family ? { fontFamily: family, fontWeight: 'normal' } : { fontWeight: SYSTEM_WEIGHT[weight] }
}

const size = (variant: TextVariantName, fontSize: number, lineHeight: number) => brand.type?.[variant] ?? { fontSize, lineHeight }

export const font = {
  h1: { ...size('h1', 24, 30), ...face('bold', true) },
  h2: { ...size('h2', 19, 25), ...face('bold', true) },
  h3: { ...size('h3', 16, 22), ...face('semibold', true) },
  body: { ...size('body', 15, 21), ...face('regular') },
  bodyStrong: { ...size('bodyStrong', 15, 21), ...face('semibold') },
  small: { ...size('small', 13, 18), ...face('regular') },
  smallStrong: { ...size('smallStrong', 13, 18), ...face('semibold') },
  tiny: { ...size('tiny', 11, 15), ...face('semibold') },
}

export const textColorFor = (variant: keyof typeof font) => (variant === 'h1' || variant === 'h2' || variant === 'h3' ? colors.textStrong : colors.text)

const designShadow = Platform.select({
  // The designs' "drop shadow 0, 4, blur 4, black 25%".
  ios: { shadowColor: '#000000', shadowOpacity: 0.25, shadowRadius: 2, shadowOffset: { width: 0, height: 4 } },
  android: { elevation: 4 },
  default: { boxShadow: '0 4px 4px rgba(0,0,0,0.25)' },
}) as object

export const shadow = brand.card?.shadow === 'design' ? designShadow : Platform.select({
  ios: { shadowColor: '#0f172a', shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
  android: { elevation: 2 },
  // The web app's --shadow-card (frontend/src/index.css).
  default: { boxShadow: '0 1px 2px 0 rgba(15,23,42,0.05), 0 1px 3px 0 rgba(15,23,42,0.06)' },
}) as object

/** Whether cards draw a hairline outline (the web style) or rely on their shadow (the designs). */
export const cardBorder = brand.card?.border ?? true

export const screenHeader = brand.screenHeader ?? 'band'

/**
 * The designs' coloured left edges on list cards (dentor.fig "RE- VISIT", "on going", "complaints / new",
 * "Chat"): green when done, orange while in progress, red for new or needing attention, and a cycle of six
 * for conversations. Read from the PDF pages; the file gives no named tokens for them.
 */
export const stripeColors = {
  done: '#1f9d3a',
  progress: '#f7941d',
  attention: '#e7000b',
  cycle: ['#ff0004', '#0b1f9c', '#11a08f', '#7d7a1c', '#c6df26', '#f7941d'],
}

/** The line-art pattern behind screens, when the app's design has one. */
export const screenPattern = brand.pattern
export const patternByDefault = !!brand.patternByDefault

/** Minimum comfortable touch target. */
export const TOUCH = 44

/** Switch colours in the brand; react-native-web reads the "on" thumb from activeThumbColor. */
export const switchColors = () =>
  ({ trackColor: { true: colors.header, false: colors.border }, thumbColor: '#ffffff', activeThumbColor: '#ffffff' }) as {
    trackColor: { true: string; false: string }
    thumbColor: string
  }

/** Text and tint of a badge or banner, per tone: the web app's `tones` in components/ui/Badge.tsx. */
export const toneColors: Record<Tone, { fg: string; bg: string }> = {
  brand: { fg: colors.brand800, bg: colors.brand50 },
  green: { fg: colors.green, bg: colors.greenBg },
  amber: { fg: colors.amber, bg: colors.amberBg },
  red: { fg: colors.redDark, bg: colors.redBg },
  blue: { fg: colors.blue, bg: colors.blueBg },
  violet: { fg: colors.violet, bg: colors.violetBg },
  slate: { fg: colors.slate, bg: colors.slateBg },
}

/**
 * Icon colour on its tint in figure tiles and list rows: the web app's `accents` in
 * components/ui/bits.tsx (StatCard), one shade lighter than badge text. The web app has no
 * violet accent, so violet keeps its badge shade.
 */
export const accentColors: Record<Tone, { fg: string; bg: string }> = {
  brand: { fg: colors.brand700, bg: colors.brand50 },
  green: { fg: '#009966', bg: colors.greenBg }, // emerald-600
  amber: { fg: '#e17100', bg: colors.amberBg }, // amber-600
  red: { fg: colors.red, bg: colors.redBg }, // red-600
  blue: { fg: '#0084d1', bg: colors.blueBg }, // sky-600
  violet: { fg: colors.violet, bg: colors.violetBg },
  slate: { fg: colors.textMuted, bg: colors.slateBg }, // slate-500
}

/* ------------------------------------------------------------ dental chart */

/** What a tooth can be charted as, in legend order: the web app's TOOTH_CONDITIONS. */
export const TOOTH_CONDITIONS = ['Healthy', 'Caries', 'Filled', 'Crown', 'Root Canal', 'Missing', 'Implant', 'Fractured'] as const

export interface ToothLook {
  bg: string
  fg: string
  border: string
  dashed?: boolean
}

/** A charted tooth's fill, number and outline: CONDITION_STYLE in the web app's DentalChartTab. */
const TOOTH_LOOKS: Record<string, ToothLook> = {
  Healthy: { bg: colors.surface, fg: colors.textMuted, border: colors.border }, // white, slate-500, slate-200
  Caries: { bg: '#fef3c6', fg: '#973c00', border: '#ffb900' }, // amber-100, amber-800, amber-400
  Filled: { bg: '#e2e8f0', fg: '#314158', border: '#90a1b9' }, // slate-200, slate-700, slate-400
  Crown: { bg: '#dff2fe', fg: '#00598a', border: '#00bcff' }, // sky-100, sky-800, sky-400
  'Root Canal': { bg: '#ffe2e2', fg: '#9f0712', border: '#ff6467' }, // red-100, red-800, red-400
  Missing: { bg: '#f8fafc', fg: '#cad5e2', border: '#cad5e2', dashed: true }, // slate-50, slate-300, slate-300
  Implant: { bg: '#ede9fe', fg: '#5d0ec0', border: '#a684ff' }, // violet-100, violet-800, violet-400
  Fractured: { bg: '#ffedd4', fg: '#9f2d00', border: '#ff8904' }, // orange-100, orange-800, orange-400
}

/** The look of a condition the clinic can chart; undefined for one this list does not know. */
export const toothLook = (condition?: string | null): ToothLook | undefined => TOOTH_LOOKS[condition || 'Healthy']
