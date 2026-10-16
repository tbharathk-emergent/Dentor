// Generated from the files in src/app by scripts/gen-routes.mjs. Do not edit by hand:
// run `npm run routes` after adding, moving or removing a screen.
import type { RouteDef } from '@dentor/shared'
import Screen0 from './app/(app)/(tabs)/appointments'
import Screen1 from './app/(app)/(tabs)/index'
import Screen2 from './app/(app)/(tabs)/notifications'
import Screen3 from './app/(app)/(tabs)/payments'
import Screen4 from './app/(app)/(tabs)/profile'
import Screen5 from './app/(app)/(tabs)/records'
import Screen6 from './app/(app)/(tabs)/reports'
import Screen7 from './app/(app)/(tabs)/reviews'
import Screen8 from './app/(app)/account/clinic'
import Screen9 from './app/(app)/account/delete'
import Screen10 from './app/(app)/account/edit'
import Screen11 from './app/(app)/account/family'
import Screen12 from './app/(app)/account/notification-settings'
import Screen13 from './app/(app)/account/password'
import Screen14 from './app/(app)/account/privacy'
import Screen15 from './app/(app)/account/settings'
import Screen16 from './app/(app)/account/terms'
import Screen17 from './app/(app)/appointment/[id]'
import Screen18 from './app/(app)/book'
import Screen19 from './app/(app)/chat'
import Screen20 from './app/(app)/consents'
import Screen21 from './app/(app)/fetch'
import Screen22 from './app/(app)/offers'
import Screen23 from './app/(app)/payments/[id]'
import Screen24 from './app/(app)/prescriptions/[id]'
import Screen25 from './app/(app)/prescriptions/index'
import Screen26 from './app/(app)/reports/[id]'
import Screen27 from './app/(app)/reviews/new'
import Screen28 from './app/(auth)/forgot-email'
import Screen29 from './app/(auth)/forgot'
import Screen30 from './app/(auth)/index'
import Screen31 from './app/(auth)/login'
import Screen32 from './app/(auth)/otp-login'
import Screen33 from './app/(auth)/signup'
import Screen34 from './app/(setup)/index'

export const routes: RouteDef[] = [
  { path: 'appointments', group: 'app', tab: true, component: Screen0 },
  { path: '', group: 'app', tab: true, component: Screen1 },
  { path: 'notifications', group: 'app', tab: true, component: Screen2 },
  { path: 'payments', group: 'app', tab: true, component: Screen3 },
  { path: 'profile', group: 'app', tab: true, component: Screen4 },
  { path: 'records', group: 'app', tab: true, component: Screen5 },
  { path: 'reports', group: 'app', tab: true, component: Screen6 },
  { path: 'reviews', group: 'app', tab: true, component: Screen7 },
  { path: 'account/clinic', group: 'app', tab: false, component: Screen8 },
  { path: 'account/delete', group: 'app', tab: false, component: Screen9 },
  { path: 'account/edit', group: 'app', tab: false, component: Screen10 },
  { path: 'account/family', group: 'app', tab: false, component: Screen11 },
  { path: 'account/notification-settings', group: 'app', tab: false, component: Screen12 },
  { path: 'account/password', group: 'app', tab: false, component: Screen13 },
  { path: 'account/privacy', group: 'app', tab: false, component: Screen14 },
  { path: 'account/settings', group: 'app', tab: false, component: Screen15 },
  { path: 'account/terms', group: 'app', tab: false, component: Screen16 },
  { path: 'appointment/[id]', group: 'app', tab: false, component: Screen17 },
  { path: 'book', group: 'app', tab: false, component: Screen18 },
  { path: 'chat', group: 'app', tab: false, component: Screen19 },
  { path: 'consents', group: 'app', tab: false, component: Screen20 },
  { path: 'fetch', group: 'app', tab: false, component: Screen21 },
  { path: 'offers', group: 'app', tab: false, component: Screen22 },
  { path: 'payments/[id]', group: 'app', tab: false, component: Screen23 },
  { path: 'prescriptions/[id]', group: 'app', tab: false, component: Screen24 },
  { path: 'prescriptions', group: 'app', tab: false, component: Screen25 },
  { path: 'reports/[id]', group: 'app', tab: false, component: Screen26 },
  { path: 'reviews/new', group: 'app', tab: false, component: Screen27 },
  { path: 'forgot-email', group: 'auth', tab: false, component: Screen28 },
  { path: 'forgot', group: 'auth', tab: false, component: Screen29 },
  { path: '', group: 'auth', tab: false, component: Screen30 },
  { path: 'login', group: 'auth', tab: false, component: Screen31 },
  { path: 'otp-login', group: 'auth', tab: false, component: Screen32 },
  { path: 'signup', group: 'auth', tab: false, component: Screen33 },
  { path: '', group: 'setup', tab: false, component: Screen34 },
]
