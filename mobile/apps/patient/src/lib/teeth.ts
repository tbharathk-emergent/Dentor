import { TOOTH_CONDITIONS } from '@dentor/shared'

/** The adult dentition in FDI notation, in the order a chart is read. */
export const QUADRANTS: { key: string; label: string; teeth: number[] }[] = [
  { key: 'ur', label: 'Upper right', teeth: [18, 17, 16, 15, 14, 13, 12, 11] },
  { key: 'ul', label: 'Upper left', teeth: [21, 22, 23, 24, 25, 26, 27, 28] },
  { key: 'lr', label: 'Lower right', teeth: [48, 47, 46, 45, 44, 43, 42, 41] },
  { key: 'll', label: 'Lower left', teeth: [31, 32, 33, 34, 35, 36, 37, 38] },
]

export const HEALTHY = 'Healthy'

/** Conditions the clinic can chart (the reception app's list, from the shared theme), in legend order. */
export const CONDITIONS = TOOTH_CONDITIONS
