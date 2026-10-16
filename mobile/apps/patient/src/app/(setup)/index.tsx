import { Banner, Button, Card, Screen, T, TextField, colors, useSession } from '@dentor/shared'
import { useQueryClient } from '@tanstack/react-query'
import { ChoiceChips } from '@/components/ChoiceChips'
import { ClinicSearch } from '@/components/setup/ClinicSearch'
import { keys } from '@/hooks/keys'
import { useJoinFlow } from '@/hooks/useJoinFlow'
import { useRefresh } from '@/hooks/useRefresh'
import { GENDERS } from '@/lib/options'
import { onlyDigits } from '@/lib/validate'

export default function Setup() {
  const { signOut } = useSession()
  const flow = useJoinFlow()
  const qc = useQueryClient()
  const { refreshing, onRefresh } = useRefresh(() => qc.invalidateQueries({ queryKey: keys.clinics }))
  const signOutLink = <Button testID="setup-signout" label="Log out" variant="ghost" full onPress={signOut} />

  if (flow.step === 'details' && flow.clinic) {
    return (
      <Screen
        testID="setup-details"
        title="Confirm your details"
        subtitle={flow.clinic.name}
        back
        onBack={flow.toClinics}
        footer={
          <>
            <Button testID="setup-join" label="Register with this clinic" size="lg" full loading={flow.joining} onPress={flow.submit} />
            {signOutLink}
          </>
        }
      >
        <Card>
          <T variant="bodyStrong">{flow.clinic.name}</T>
          <T variant="small" color={colors.textMuted}>{[flow.clinic.address, flow.clinic.city].filter(Boolean).join(' · ')}</T>
        </Card>
        <TextField testID="setup-name" label="Patient's full name" required value={flow.name} onChangeText={flow.setName} autoCapitalize="words" error={flow.errors.name} />
        <TextField
          testID="setup-age"
          label="Age"
          value={flow.age}
          onChangeText={(text) => flow.setAge(onlyDigits(text, 3))}
          keyboardType="number-pad"
          placeholder="Years"
          error={flow.errors.age}
        />
        <ChoiceChips testID="setup-gender" label="Gender" options={GENDERS} value={flow.gender} onChange={flow.setGender} clearable />
        <Banner tone="blue" icon="info" text="If this clinic already has a record for your mobile number, the app opens that record and keeps the details the clinic has." />
      </Screen>
    )
  }

  return (
    <Screen
      testID="setup-screen"
      title="Choose your clinic"
      subtitle={flow.accountName ? `Welcome, ${flow.accountName}` : undefined}
      refreshing={refreshing}
      onRefresh={onRefresh}
      footer={
        <>
          <Button testID="setup-continue" label="Continue" size="lg" full disabled={!flow.clinic} onPress={flow.toDetails} />
          {signOutLink}
        </>
      }
    >
      <T color={colors.textMuted}>Pick the dental clinic you visit. You will see your records there and can book appointments.</T>
      <ClinicSearch selected={flow.clinic} onSelect={flow.setClinic} />
    </Screen>
  )
}
