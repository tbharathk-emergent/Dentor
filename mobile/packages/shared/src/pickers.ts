/**
 * Photo and document picking on iOS and Android — the only file that talks to the native
 * pickers (the browser build uses pickers.web.ts). Screens call `pickImage()` /
 * `pickDocument()` and get the file ready to send to the API.
 */
import { errorCodes, isErrorWithCode, pick, types } from '@react-native-documents/picker'
import { launchImageLibrary } from 'react-native-image-picker'
import { blobToDataUrl, mimeFromName, nameFromUri, toPicked, type PickedFile } from './pickedFile'

export type { PickedFile }

/** Reads a file the picker handed over (file:// on iOS, content:// on Android). Not an API call. */
async function readAsDataUrl(uri: string, mime: string): Promise<string> {
  return blobToDataUrl(await (await fetch(uri)).blob(), mime)
}

/** One photo from the library. Resolves null when the user closes the picker. */
export async function pickImage(): Promise<PickedFile | null> {
  const result = await launchImageLibrary({
    mediaType: 'photo',
    selectionLimit: 1,
    includeBase64: true,
    quality: 0.7,
    // iPhone photos are HEIC by default; "compatible" hands them over as JPEG.
    assetRepresentationMode: 'compatible',
  })
  if (result.didCancel) return null
  if (result.errorCode) {
    throw new Error(result.errorCode === 'permission' ? 'Allow photo access in Settings to attach a photo.' : result.errorMessage || 'Could not open your photos.')
  }
  const asset = result.assets?.[0]
  if (!asset) return null
  const name = asset.fileName || nameFromUri(asset.uri ?? '', 'photo.jpg')
  const mime = asset.type || mimeFromName(name) || 'image/jpeg'
  if (asset.base64) return toPicked(name, mime, `data:${mime};base64,${asset.base64}`)
  if (!asset.uri) throw new Error('Could not read the selected photo. Please try another one.')
  return toPicked(name, mime, await readAsDataUrl(asset.uri, mime))
}

/** One PDF from the device. Resolves null when the user closes the picker. */
export async function pickDocument(): Promise<PickedFile | null> {
  let file
  try {
    ;[file] = await pick({ type: [types.pdf], allowMultiSelection: false })
  } catch (error) {
    if (isErrorWithCode(error) && error.code === errorCodes.OPERATION_CANCELED) return null
    throw new Error('Could not open your files. Please try again.')
  }
  const name = file.name || nameFromUri(file.uri, 'document.pdf')
  const mime = file.type || mimeFromName(name) || 'application/pdf'
  return toPicked(name, mime, await readAsDataUrl(file.uri, mime))
}
