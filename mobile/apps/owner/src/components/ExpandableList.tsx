import { Button, Divider, space } from '@dentor/shared'
import { useState, type ReactNode } from 'react'
import { View } from 'react-native'

/** Rows inside a card: the first few, with a button to show the rest. */
export function ExpandableList<Item>({
  items,
  keyOf,
  render,
  initial = 5,
  testID,
}: {
  items: Item[]
  keyOf: (item: Item) => string
  render: (item: Item) => ReactNode
  initial?: number
  testID: string
}) {
  const [expanded, setExpanded] = useState(false)
  const shown = expanded ? items : items.slice(0, initial)
  return (
    <View testID={testID}>
      {shown.map((item, index) => (
        <View key={keyOf(item)}>
          {index > 0 && <Divider inset={space.lg} />}
          {render(item)}
        </View>
      ))}
      {items.length > initial && (
        <>
          <Divider />
          <Button
            testID={`${testID}-toggle`}
            variant="ghost"
            full
            label={expanded ? 'Show fewer' : `Show all ${items.length}`}
            onPress={() => setExpanded((open) => !open)}
          />
        </>
      )}
    </View>
  )
}
