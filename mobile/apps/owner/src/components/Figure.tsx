import { T, colors, space } from '@dentor/shared'
import type { ReactNode } from 'react'
import { View } from 'react-native'

/** A small labelled number inside a card; `FigureGrid` lays them out two to a row. */
export function Figure({ label, value, testID }: { label: string; value: string | number; testID?: string }) {
  return (
    <View style={{ flexBasis: '45%', flexGrow: 1, minWidth: 0, gap: 2 }}>
      {/* Two lines: "OPEN PIPELINE VALUE" is a few pixels too long for half a card on a 320 px phone. */}
      <T variant="tiny" color={colors.textMuted} numberOfLines={2}>
        {label}
      </T>
      <T variant="bodyStrong" numberOfLines={1} testID={testID}>
        {value}
      </T>
    </View>
  )
}

export function FigureGrid({ children }: { children: ReactNode }) {
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.md }}>{children}</View>
}
