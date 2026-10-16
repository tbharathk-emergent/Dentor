import { Children, type ReactNode } from 'react'
import { View } from 'react-native'

/** Badges stacked at the trailing edge of a row, right-aligned. */
export function BadgeStack({ children }: { children: ReactNode }) {
  return (
    <View style={{ gap: 4, flexShrink: 0 }}>
      {Children.toArray(children).map((child, index) => (
        <View key={index} style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
          {child}
        </View>
      ))}
    </View>
  )
}
