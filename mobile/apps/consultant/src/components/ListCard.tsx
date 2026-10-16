import { Card, Divider, radius, space } from '@dentor/shared'
import { Children, Fragment, type ReactNode } from 'react'
import { View } from 'react-native'

/** A card of rows separated by hairlines. */
export function ListCard({ children, testID }: { children: ReactNode; testID?: string }) {
  const rows = Children.toArray(children)
  return (
    <Card padded={false} testID={testID}>
      {/* Clips the pressed-row highlight to the rounded corners. Clipping the card itself would cut off its shadow on iOS. */}
      <View style={{ borderRadius: radius.lg - 1, overflow: 'hidden' }}>
        {rows.map((row, i) => (
          <Fragment key={i}>
            {i > 0 && <Divider inset={space.lg} />}
            {row}
          </Fragment>
        ))}
      </View>
    </Card>
  )
}
