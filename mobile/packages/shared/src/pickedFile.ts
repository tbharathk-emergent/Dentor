/** What a picker hands to the screens, whichever platform it ran on. */
export interface PickedFile {
  name: string
  /** `data:<mime>;base64,<content>` — the form the API stores. */
  dataUrl: string
  /** Size of the file content in bytes. */
  size: number
  mime: string
}

const EXTENSION_MIME: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', heic: 'image/heic', pdf: 'application/pdf',
}

export const mimeFromName = (name: string) => EXTENSION_MIME[name.split('.').pop()?.toLowerCase() ?? ''] ?? ''

export const nameFromUri = (uri: string, fallback: string) => {
  let last = uri.split(/[\\/]/).pop() ?? ''
  try {
    last = decodeURIComponent(last)
  } catch {
    /* keep the raw name */
  }
  return /\.[A-Za-z0-9]{2,5}$/.test(last) ? last : fallback
}

/** Bytes held by a base64 string (padding excluded). */
const base64Bytes = (base64: string) => Math.floor((base64.length * 3) / 4) - (base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0)

export function toPicked(name: string, mime: string, dataUrl: string): PickedFile {
  return { name, mime, dataUrl, size: base64Bytes(dataUrl.slice(dataUrl.indexOf(',') + 1)) }
}

/** Turns file content (a Blob or File) into a data URL. */
export function blobToDataUrl(blob: Blob, mime: string): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Could not read the selected file. Please try another one.'))
    reader.onload = () => {
      const content = String(reader.result).split(',')[1] ?? ''
      if (content) resolve(`data:${mime};base64,${content}`)
      else reject(new Error('The selected file is empty.'))
    }
    reader.readAsDataURL(blob)
  })
}
