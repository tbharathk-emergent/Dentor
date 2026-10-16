import { Banner } from '@dentor/shared'
import { View } from 'react-native'

/** The API's reason for refusing a form, shown beside the button that was pressed. */
export function FormError({ message, testID }: { message: string; testID: string }) {
  if (!message) return null
  return (
    <View testID={testID} accessibilityRole="alert">
      <Banner tone="red" icon="alert-circle" text={message} />
    </View>
  )
}
