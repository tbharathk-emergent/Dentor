import { Button, Sheet, TextField, space } from '@dentor/shared'
import { useState, type ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'
import { Checkbox } from '@/components/Checkbox'
import { ChoiceChips } from '@/components/ChoiceChips'
import { LegalText } from '@/components/LegalText'
import { MobileField } from '@/components/auth/MobileField'
import { PRIVACY, TERMS, type LegalDocument } from '@/content/legal'
import { GENDERS } from '@/lib/options'
import type { SignupErrors, SignupValues } from '@/lib/signup'
import { PASSWORD_RULE, onlyDigits } from '@/lib/validate'

/** The sign-up fields. `notice` is where the caller shows what the server said (already registered, wait, …). */
export function SignupForm({
  values,
  errors,
  onChange,
  onSubmit,
  submitting,
  notice,
}: {
  values: SignupValues
  errors: SignupErrors
  onChange: <K extends keyof SignupValues>(key: K, value: SignupValues[K]) => void
  onSubmit: () => void
  submitting: boolean
  notice?: ReactNode
}) {
  const [reading, setReading] = useState<LegalDocument | null>(null)
  const [readerOpen, setReaderOpen] = useState(false)
  const read = (document: LegalDocument) => {
    setReading(document)
    setReaderOpen(true)
  }

  return (
    <>
      <TextField testID="signup-name" label="Full name" required icon="user" value={values.name} onChangeText={(v) => onChange('name', v)} autoCapitalize="words" error={errors.name} />
      <MobileField testID="signup-mobile" value={values.mobile} onChange={(v) => onChange('mobile', v)} error={errors.mobile} hint="We will send a code by SMS to verify it." />
      <TextField
        testID="signup-email"
        label="Email (optional)"
        icon="mail"
        value={values.email}
        onChangeText={(v) => onChange('email', v)}
        placeholder="name@example.com"
        keyboardType="email-address"
        autoCapitalize="none"
        error={errors.email}
      />
      <ChoiceChips testID="signup-gender" label="Gender" required options={GENDERS} value={values.gender} onChange={(v) => onChange('gender', v)} error={errors.gender} />
      <TextField
        testID="signup-age"
        label="Age"
        required
        value={values.age}
        onChangeText={(v) => onChange('age', onlyDigits(v, 3))}
        keyboardType="number-pad"
        placeholder="Years"
        error={errors.age}
      />
      <TextField
        testID="signup-password"
        label="Password"
        required
        secure
        icon="lock"
        value={values.password}
        onChangeText={(v) => onChange('password', v)}
        error={errors.password}
        hint={PASSWORD_RULE}
      />
      <TextField
        testID="signup-confirm"
        label="Confirm password"
        required
        secure
        icon="lock"
        value={values.confirm}
        onChangeText={(v) => onChange('confirm', v)}
        error={errors.confirm}
        onSubmitEditing={onSubmit}
      />

      <View style={styles.terms}>
        <Checkbox testID="signup-terms" checked={values.agreed} onChange={(v) => onChange('agreed', v)} error={errors.agreed}>
          I agree to the Terms of use and the Privacy policy.
        </Checkbox>
        <View style={styles.links}>
          <Button testID="signup-read-terms" label="Read the terms" variant="ghost" size="sm" onPress={() => read(TERMS)} />
          <Button testID="signup-read-privacy" label="Read the privacy policy" variant="ghost" size="sm" onPress={() => read(PRIVACY)} />
        </View>
      </View>

      {notice}
      <Button testID="signup-submit" label="Send verification code" size="lg" full loading={submitting} onPress={onSubmit} />

      <Sheet testID="legal-sheet" visible={readerOpen} onClose={() => setReaderOpen(false)} title={reading?.title ?? ''}>
        {reading && <LegalText document={reading} />}
      </Sheet>
    </>
  )
}

const styles = StyleSheet.create({
  terms: { gap: space.xs },
  links: { flexDirection: 'row', flexWrap: 'wrap', columnGap: space.sm, marginLeft: -space.md },
})
