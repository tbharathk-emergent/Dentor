import { StaffLoginScreen } from '@dentor/shared'
import header from '@/assets/design/login-header.png'
import logo from '@/assets/design/logo-on-navy.png'
import pattern from '@/assets/design/pattern.png'

export default function Login() {
  return (
    <StaffLoginScreen
      app="consultant"
      appName="Dentor Consultant"
      tagline="Your schedule, patients and prescriptions in one place."
      demoHint="Demo consultant: kumar@dentor.in / Consultant@2026"
      // The design's "Log In" (dentor.fig 3973:6122): folded navy header, logo, line-art background.
      design={{ header, logo, pattern }}
    />
  )
}
