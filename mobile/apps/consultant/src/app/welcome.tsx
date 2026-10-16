import { StaffWelcomeScreen } from '@dentor/shared'
import art from '@/assets/design/onboarding.png'

export default function Welcome() {
  return <StaffWelcomeScreen app="consultant" art={art} title="Explore now to experience the benefits" body="Connect with qualified dentists across Globe. Book, refer, and collaborate with ease using one professional platform." />
}
