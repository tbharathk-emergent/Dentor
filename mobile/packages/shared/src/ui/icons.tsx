/**
 * Icon fonts (react-native-vector-icons, statically linked): Feather for the interface,
 * Material Design Icons for the tooth mark. Fonts are bundled by the native projects
 * (Android automatically, iOS through UIAppFonts) and by the web build's @font-face rules.
 */
import { Feather } from '@react-native-vector-icons/feather/static'
import { MaterialDesignIcons } from '@react-native-vector-icons/material-design-icons/static'
import type { ComponentProps } from 'react'

export type IconName = ComponentProps<typeof Feather>['name']

export { Feather, MaterialDesignIcons }
