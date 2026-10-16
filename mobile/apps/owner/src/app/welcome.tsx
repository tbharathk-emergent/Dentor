import { StaffWelcomeScreen } from '@dentor/shared'
import art from '@/assets/design/onboarding.png'

export default function Welcome() {
  return <StaffWelcomeScreen app="owner" art={art} title="Experience the Better Dental Practise Management" body="Connect with qualified Dentists across Globe. Book, refer, and collaborate with ease using one professional platform." />
}
