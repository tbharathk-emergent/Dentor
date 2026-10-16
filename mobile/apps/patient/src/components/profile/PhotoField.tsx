import { Avatar, Button, T, colors, errorMessage, space } from '@dentor/shared'
import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { pickImage } from '@/lib/pickers'
import { photoProblem } from '@/lib/uploads'

/** The profile photo with "choose" and "remove" actions. `value` is a data URL, or '' for none. */
export function PhotoField({ name, value, onChange }: { name: string; value: string; onChange: (photo: string) => void }) {
  const [problem, setProblem] = useState<string | null>(null)

  const choose = async () => {
    setProblem(null)
    try {
      const picked = await pickImage()
      if (!picked) return
      const refused = photoProblem(picked)
      if (refused) setProblem(refused)
      else onChange(picked.dataUrl)
    } catch (error) {
      setProblem(errorMessage(error, 'Could not open that photo. Please try another one.'))
    }
  }

  return (
    <View style={styles.wrap}>
      <Avatar name={name} uri={value || undefined} size={88} />
      <View style={styles.actions}>
        <Button testID="photo-choose" label={value ? 'Change photo' : 'Add a photo'} icon="camera" variant="secondary" size="sm" onPress={choose} />
        {!!value && (
          <Button
            testID="photo-remove"
            label="Remove"
            variant="ghost"
            size="sm"
            onPress={() => {
              setProblem(null)
              onChange('')
            }}
          />
        )}
      </View>
      {!!problem && <T variant="small" color={colors.red} center testID="photo-problem">{problem}</T>}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: space.md },
  actions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: space.sm },
})
