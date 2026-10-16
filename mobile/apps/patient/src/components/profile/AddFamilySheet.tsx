import { Button, Sheet, T, TextField, colors, useToast } from '@dentor/shared'
import { useEffect, useState } from 'react'
import { ChoiceChips } from '@/components/ChoiceChips'
import { useAddFamilyMember } from '@/hooks/useProfiles'
import { GENDERS, RELATIONS } from '@/lib/options'
import { ageProblem, isClean, nameProblem, onlyDigits } from '@/lib/validate'

/** Registers a family member at the current clinic under the account's mobile number. */
export function AddFamilySheet({ visible, onClose, clinicName }: { visible: boolean; onClose: () => void; clinicName: string }) {
  const toast = useToast()
  const add = useAddFamilyMember()
  const [name, setName] = useState('')
  const [relation, setRelation] = useState('')
  const [age, setAge] = useState('')
  const [gender, setGender] = useState('')
  const [errors, setErrors] = useState<{ name?: string; age?: string }>({})

  useEffect(() => {
    if (visible) return
    setName('')
    setRelation('')
    setAge('')
    setGender('')
    setErrors({})
  }, [visible])

  const submit = () => {
    const found = { name: nameProblem(name, 'their'), age: ageProblem(age) }
    setErrors(found)
    if (!isClean(found)) return
    add.mutate(
      { name: name.trim(), relation, gender, age: age ? Number(age) : undefined },
      {
        onSuccess: ({ profile }) => {
          toast.success(`${profile.name} added (${profile.code})`)
          onClose()
        },
        onError: (error) => toast.error(error),
      },
    )
  }

  return (
    <Sheet
      testID="family-sheet"
      visible={visible}
      onClose={onClose}
      title="Add a family member"
      subtitle={`Registered at ${clinicName} on your mobile number`}
      footer={<Button testID="family-submit" label="Add family member" onPress={submit} loading={add.isPending} full />}
    >
      <TextField testID="family-name" label="Full name" required value={name} onChangeText={setName} autoCapitalize="words" error={errors.name} />
      <ChoiceChips testID="family-relation" label="Relation to you" options={RELATIONS} value={relation} onChange={setRelation} clearable />
      <TextField
        testID="family-age"
        label="Age"
        value={age}
        onChangeText={(text) => setAge(onlyDigits(text, 3))}
        keyboardType="number-pad"
        placeholder="Years"
        error={errors.age}
      />
      <ChoiceChips testID="family-gender" label="Gender" options={GENDERS} value={gender} onChange={setGender} clearable />
      <T variant="small" color={colors.textMuted}>After adding, switch to their profile to book visits and see their records.</T>
    </Sheet>
  )
}
