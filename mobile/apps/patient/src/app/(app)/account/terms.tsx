import { Screen } from '@dentor/shared'
import { LegalText } from '@/components/LegalText'
import { TERMS } from '@/content/legal'

export default function Terms() {
  return (
    <Screen testID="terms-screen" title={TERMS.title} back>
      <LegalText document={TERMS} />
    </Screen>
  )
}
