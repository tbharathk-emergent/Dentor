import { StaffLoginScreen } from '@dentor/shared'
import header from '@/assets/design/login-header.png'
import logo from '@/assets/design/logo-on-red.png'
import pattern from '@/assets/design/pattern.png'

export default function Login() {
  return (
    <StaffLoginScreen
      app="owner"
      appName="Dentor Clinic"
      tagline="Live revenue, operations and team oversight for your clinic."
      demoHint="Demo owner: owner@dentor.in / Owner@2026"
      // The Clinic app's "Log In" (dentor.fig 2312:232): folded red header, logo, line-art background.
      design={{ header, logo, pattern }}
    />
  )
}
