// Generated from the files in src/app by scripts/gen-routes.mjs. Do not edit by hand:
// run `npm run routes` after adding, moving or removing a screen.
import type { RouteDef } from '@dentor/shared'
import Screen0 from './app/(app)/(tabs)/earnings'
import Screen1 from './app/(app)/(tabs)/index'
import Screen2 from './app/(app)/(tabs)/patients'
import Screen3 from './app/(app)/(tabs)/profile'
import Screen4 from './app/(app)/(tabs)/schedule'
import Screen5 from './app/(app)/appointments/[id]'
import Screen6 from './app/(app)/availability'
import Screen7 from './app/(app)/change-password'
import Screen8 from './app/(app)/chat/[id]'
import Screen9 from './app/(app)/chat/index'
import Screen10 from './app/(app)/delete-account'
import Screen11 from './app/(app)/edit-profile'
import Screen12 from './app/(app)/help'
import Screen13 from './app/(app)/inventory'
import Screen14 from './app/(app)/jobs'
import Screen15 from './app/(app)/notification-settings'
import Screen16 from './app/(app)/notifications'
import Screen17 from './app/(app)/patients/[id]/files/[fileId]'
import Screen18 from './app/(app)/patients/[id]/index'
import Screen19 from './app/(app)/patients/[id]/prescribe'
import Screen20 from './app/(app)/patients/[id]/treatment'
import Screen21 from './app/(app)/plans'
import Screen22 from './app/(app)/prescriptions/[id]'
import Screen23 from './app/(app)/prescriptions/index'
import Screen24 from './app/(app)/privacy'
import Screen25 from './app/(app)/requests/[id]'
import Screen26 from './app/(app)/requests/index'
import Screen27 from './app/(app)/reviews'
import Screen28 from './app/(app)/settings'
import Screen29 from './app/(app)/store'
import Screen30 from './app/(app)/support'
import Screen31 from './app/(app)/terms'
import Screen32 from './app/(app)/wallet'
import Screen33 from './app/forgot'
import Screen34 from './app/login'
import Screen35 from './app/signup'
import Screen36 from './app/welcome'

export const routes: RouteDef[] = [
  { path: 'earnings', group: 'app', tab: true, component: Screen0 },
  { path: '', group: 'app', tab: true, component: Screen1 },
  { path: 'patients', group: 'app', tab: true, component: Screen2 },
  { path: 'profile', group: 'app', tab: true, component: Screen3 },
  { path: 'schedule', group: 'app', tab: true, component: Screen4 },
  { path: 'appointments/[id]', group: 'app', tab: false, component: Screen5 },
  { path: 'availability', group: 'app', tab: false, component: Screen6 },
  { path: 'change-password', group: 'app', tab: false, component: Screen7 },
  { path: 'chat/[id]', group: 'app', tab: false, component: Screen8 },
  { path: 'chat', group: 'app', tab: false, component: Screen9 },
  { path: 'delete-account', group: 'app', tab: false, component: Screen10 },
  { path: 'edit-profile', group: 'app', tab: false, component: Screen11 },
  { path: 'help', group: 'app', tab: false, component: Screen12 },
  { path: 'inventory', group: 'app', tab: false, component: Screen13 },
  { path: 'jobs', group: 'app', tab: false, component: Screen14 },
  { path: 'notification-settings', group: 'app', tab: false, component: Screen15 },
  { path: 'notifications', group: 'app', tab: false, component: Screen16 },
  { path: 'patients/[id]/files/[fileId]', group: 'app', tab: false, component: Screen17 },
  { path: 'patients/[id]', group: 'app', tab: false, component: Screen18 },
  { path: 'patients/[id]/prescribe', group: 'app', tab: false, component: Screen19 },
  { path: 'patients/[id]/treatment', group: 'app', tab: false, component: Screen20 },
  { path: 'plans', group: 'app', tab: false, component: Screen21 },
  { path: 'prescriptions/[id]', group: 'app', tab: false, component: Screen22 },
  { path: 'prescriptions', group: 'app', tab: false, component: Screen23 },
  { path: 'privacy', group: 'app', tab: false, component: Screen24 },
  { path: 'requests/[id]', group: 'app', tab: false, component: Screen25 },
  { path: 'requests', group: 'app', tab: false, component: Screen26 },
  { path: 'reviews', group: 'app', tab: false, component: Screen27 },
  { path: 'settings', group: 'app', tab: false, component: Screen28 },
  { path: 'store', group: 'app', tab: false, component: Screen29 },
  { path: 'support', group: 'app', tab: false, component: Screen30 },
  { path: 'terms', group: 'app', tab: false, component: Screen31 },
  { path: 'wallet', group: 'app', tab: false, component: Screen32 },
  { path: 'forgot', group: 'root', tab: false, component: Screen33 },
  { path: 'login', group: 'root', tab: false, component: Screen34 },
  { path: 'signup', group: 'root', tab: false, component: Screen35 },
  { path: 'welcome', group: 'root', tab: false, component: Screen36 },
]
