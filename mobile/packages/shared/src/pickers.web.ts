/** Photo and document picking in the browser build: the browser's own file chooser. */
import { blobToDataUrl, mimeFromName, toPicked, type PickedFile } from './pickedFile'

export type { PickedFile }

/** Opens the file chooser. Resolves null when the user closes it without choosing. */
function chooseFile(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = accept
    input.style.display = 'none'
    const done = (file: File | null) => {
      input.remove()
      resolve(file)
    }
    input.addEventListener('change', () => done(input.files?.[0] ?? null))
    input.addEventListener('cancel', () => done(null))
    document.body.appendChild(input)
    input.click()
  })
}

async function choose(accept: string, fallbackMime: string): Promise<PickedFile | null> {
  const file = await chooseFile(accept)
  if (!file) return null
  const mime = file.type || mimeFromName(file.name) || fallbackMime
  return toPicked(file.name, mime, await blobToDataUrl(file, mime))
}

/** One photo from the device. Resolves null when the user closes the chooser. */
export const pickImage = () => choose('image/*', 'image/jpeg')

/** One PDF from the device. Resolves null when the user closes the chooser. */
export const pickDocument = () => choose('application/pdf', 'application/pdf')
