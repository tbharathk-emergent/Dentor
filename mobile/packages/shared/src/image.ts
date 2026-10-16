import type { ImageSourcePropType } from 'react-native'

/** An imported image as an <Image> source: Metro gives an asset id, the browser build a URL. */
export const imageSource = (asset: number | string): ImageSourcePropType => (typeof asset === 'number' ? asset : { uri: asset })
