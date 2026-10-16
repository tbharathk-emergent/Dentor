import { space } from '@dentor/shared'
import type { ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'

/** A vertical run of cards or fields with the standard gap between them. */
export function Rows({ children, tight, testID }: { children: ReactNode; tight?: boolean; testID?: string }) {
  return <View testID={testID} style={tight ? styles.tight : styles.rows}>{children}</View>
}

const styles = StyleSheet.create({
  rows: { gap: space.md },
  tight: { gap: space.sm },
})
