/**
 * Browser entry for the apps (the Vite build used for previews and end-to-end tests).
 * Loads the icon fonts and the design fonts (packages/shared/assets/fonts), which the native
 * builds bundle themselves, and mounts the app.
 */
import featherFont from '@react-native-vector-icons/feather/fonts/Feather.ttf'
import materialFont from '@react-native-vector-icons/material-design-icons/fonts/MaterialDesignIcons.ttf'
import GabrielaRegular from '../assets/fonts/Gabriela-Regular.ttf'
import LeagueSpartanLight from '../assets/fonts/LeagueSpartan-Light.ttf'
import LeagueSpartanRegular from '../assets/fonts/LeagueSpartan-Regular.ttf'
import LeagueSpartanMedium from '../assets/fonts/LeagueSpartan-Medium.ttf'
import LeagueSpartanSemiBold from '../assets/fonts/LeagueSpartan-SemiBold.ttf'
import NotoSansRegular from '../assets/fonts/NotoSans-Regular.ttf'
import NotoSansMedium from '../assets/fonts/NotoSans-Medium.ttf'
import NotoSansSemiBold from '../assets/fonts/NotoSans-SemiBold.ttf'
import NotoSansBold from '../assets/fonts/NotoSans-Bold.ttf'
import WorkSansMedium from '../assets/fonts/WorkSans-Medium.ttf'
import WorkSansBold from '../assets/fonts/WorkSans-Bold.ttf'
import JetBrainsMonoRegular from '../assets/fonts/JetBrainsMono-Regular.ttf'
import RobotoRegular from '../assets/fonts/Roboto-Regular.ttf'
import RobotoSemiBold from '../assets/fonts/Roboto-SemiBold.ttf'
import RobotoBold from '../assets/fonts/Roboto-Bold.ttf'
import RadioCanadaBold from '../assets/fonts/RadioCanada-Bold.ttf'
import LeagueSpartanBold from '../assets/fonts/LeagueSpartan-Bold.ttf'
import type { ComponentType } from 'react'
import { AppRegistry } from 'react-native'

const fontFace = (family: string, url: string) =>
  `@font-face { font-family: ${family}; src: url(${url}) format('truetype'); font-display: block; }`

export function mountWeb(App: ComponentType) {
  const style = document.createElement('style')
  // A design font is named after its file, as on Android and iOS.
  const designFonts = { 'Gabriela-Regular': GabrielaRegular, 'LeagueSpartan-Light': LeagueSpartanLight, 'LeagueSpartan-Regular': LeagueSpartanRegular, 'LeagueSpartan-Medium': LeagueSpartanMedium, 'LeagueSpartan-SemiBold': LeagueSpartanSemiBold, 'NotoSans-Regular': NotoSansRegular, 'NotoSans-Medium': NotoSansMedium, 'NotoSans-SemiBold': NotoSansSemiBold, 'NotoSans-Bold': NotoSansBold, 'WorkSans-Medium': WorkSansMedium, 'WorkSans-Bold': WorkSansBold, 'JetBrainsMono-Regular': JetBrainsMonoRegular, 'Roboto-Regular': RobotoRegular, 'Roboto-SemiBold': RobotoSemiBold, 'Roboto-Bold': RobotoBold, 'RadioCanada-Bold': RadioCanadaBold, 'LeagueSpartan-Bold': LeagueSpartanBold }
  style.textContent = fontFace('Feather', featherFont) + fontFace('MaterialDesignIcons', materialFont) +
    Object.entries(designFonts).map(([family, url]) => fontFace(`'${family}'`, url)).join('')
  document.head.appendChild(style)
  AppRegistry.registerComponent('DentorApp', () => App)
  // React Native's types describe a native root tag; in the browser it is the DOM node.
  AppRegistry.runApplication('DentorApp', { rootTag: document.getElementById('root') as never, initialProps: {} })
}
