import { fmtFileSize } from '@dentor/shared'
import type { PickedFile } from '@/lib/pickers'

/** Largest report the API stores (it measures the encoded upload, so this does too). */
const MAX_REPORT_BYTES = 5 * 1024 * 1024
/** Longest profile-photo data URL the API stores: about 1.5 MB of image. */
const MAX_PHOTO_CHARS = 2_000_000

const REPORT_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/heic', 'application/pdf']

/** Why this file cannot be uploaded as a report, or undefined when it can. */
export function reportProblem(file: PickedFile): string | undefined {
  if (!REPORT_TYPES.includes(file.mime.toLowerCase())) return 'Choose a PNG, JPG, WEBP or HEIC photo, or a PDF.'
  if (Math.floor((file.dataUrl.length * 3) / 4) > MAX_REPORT_BYTES) {
    return `This file is ${fmtFileSize(file.size)}. Files must be 5 MB or smaller.`
  }
  return undefined
}

/** Why this image cannot be used as the profile photo, or undefined when it can. */
export function photoProblem(file: PickedFile): string | undefined {
  if (!file.mime.toLowerCase().startsWith('image/')) return 'Choose a photo.'
  if (file.dataUrl.length > MAX_PHOTO_CHARS) return `This photo is ${fmtFileSize(file.size)}. Choose one under 1.5 MB.`
  return undefined
}
