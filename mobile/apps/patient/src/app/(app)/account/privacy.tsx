import { Screen } from '@dentor/shared'
import { LegalText } from '@/components/LegalText'
import { PRIVACY } from '@/content/legal'

export default function Privacy() {
  return (
    <Screen testID="privacy-screen" title={PRIVACY.title} back>
      <LegalText document={PRIVACY} />
    </Screen>
  )
}
