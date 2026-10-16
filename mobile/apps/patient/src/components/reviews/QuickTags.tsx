import { Chip, space } from '@dentor/shared'
import { StyleSheet, View } from 'react-native'

/** The quick compliments of the review form; the API accepts exactly these. */
export const REVIEW_TAGS = ['Clean Clinic', 'Friendly Doctor', 'Good Explanation', 'Painless Treatment', 'Affordable', 'On time service'] as const

export function QuickTags({ value, onChange }: { value: string[]; onChange: (tags: string[]) => void }) {
  return (
    <View testID="review-tags" style={styles.chips}>
      {REVIEW_TAGS.map((tag) => (
        <Chip
          key={tag}
          testID={`review-tag-${tag}`}
          label={tag}
          selected={value.includes(tag)}
          onPress={() => onChange(value.includes(tag) ? value.filter((item) => item !== tag) : [...value, tag])}
        />
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
})
