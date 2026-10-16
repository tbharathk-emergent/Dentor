// Generated from the files in src/app by scripts/gen-routes.mjs. Do not edit by hand:
// run `npm run routes` after adding, moving or removing a screen.
import type { RouteDef } from '@dentor/shared'
import Screen0 from './app/(app)/(tabs)/finance'
import Screen1 from './app/(app)/(tabs)/index'
import Screen2 from './app/(app)/(tabs)/more'
import Screen3 from './app/(app)/(tabs)/operations'
import Screen4 from './app/(app)/(tabs)/team'
import Screen5 from './app/(app)/accounts/expenses'
import Screen6 from './app/(app)/accounts/index'
import Screen7 from './app/(app)/accounts/invoice/[id]'
import Screen8 from './app/(app)/accounts/invoices'
import Screen9 from './app/(app)/accounts/statement'
import Screen10 from './app/(app)/appointments/[id]'
import Screen11 from './app/(app)/appointments/index'
import Screen12 from './app/(app)/appointments/month'
import Screen13 from './app/(app)/appointments/new'
import Screen14 from './app/(app)/appointments/reschedule/[id]'
import Screen15 from './app/(app)/appointments/swap/[id]'
import Screen16 from './app/(app)/certificates/[id]'
import Screen17 from './app/(app)/certificates/index'
import Screen18 from './app/(app)/certificates/new'
import Screen19 from './app/(app)/change-password'
import Screen20 from './app/(app)/chat/[id]'
import Screen21 from './app/(app)/chat/index'
import Screen22 from './app/(app)/clinic-profile'
import Screen23 from './app/(app)/clinic-rules'
import Screen24 from './app/(app)/consult/[id]'
import Screen25 from './app/(app)/consult/book'
import Screen26 from './app/(app)/consult/consultant/[id]'
import Screen27 from './app/(app)/consult/index'
import Screen28 from './app/(app)/help'
import Screen29 from './app/(app)/jobs'
import Screen30 from './app/(app)/labs/[id]'
import Screen31 from './app/(app)/labs/book/[id]'
import Screen32 from './app/(app)/labs/complaints'
import Screen33 from './app/(app)/labs/index'
import Screen34 from './app/(app)/labs/invoices'
import Screen35 from './app/(app)/labs/list'
import Screen36 from './app/(app)/labs/orders'
import Screen37 from './app/(app)/notification-settings'
import Screen38 from './app/(app)/notifications'
import Screen39 from './app/(app)/offers/index'
import Screen40 from './app/(app)/offers/new'
import Screen41 from './app/(app)/overview'
import Screen42 from './app/(app)/patients/[id]'
import Screen43 from './app/(app)/patients/index'
import Screen44 from './app/(app)/patients/new'
import Screen45 from './app/(app)/plans'
import Screen46 from './app/(app)/privacy'
import Screen47 from './app/(app)/recall'
import Screen48 from './app/(app)/revisit'
import Screen49 from './app/(app)/rx/new'
import Screen50 from './app/(app)/settings'
import Screen51 from './app/(app)/store'
import Screen52 from './app/(app)/support'
import Screen53 from './app/(app)/tariff'
import Screen54 from './app/(app)/terms'
import Screen55 from './app/(app)/tracking'
import Screen56 from './app/(app)/wallet'
import Screen57 from './app/forgot'
import Screen58 from './app/login'
import Screen59 from './app/signup'
import Screen60 from './app/welcome'

export const routes: RouteDef[] = [
  { path: 'finance', group: 'app', tab: true, component: Screen0 },
  { path: '', group: 'app', tab: true, component: Screen1 },
  { path: 'more', group: 'app', tab: true, component: Screen2 },
  { path: 'operations', group: 'app', tab: true, component: Screen3 },
  { path: 'team', group: 'app', tab: true, component: Screen4 },
  { path: 'accounts/expenses', group: 'app', tab: false, component: Screen5 },
  { path: 'accounts', group: 'app', tab: false, component: Screen6 },
  { path: 'accounts/invoice/[id]', group: 'app', tab: false, component: Screen7 },
  { path: 'accounts/invoices', group: 'app', tab: false, component: Screen8 },
  { path: 'accounts/statement', group: 'app', tab: false, component: Screen9 },
  { path: 'appointments/[id]', group: 'app', tab: false, component: Screen10 },
  { path: 'appointments', group: 'app', tab: false, component: Screen11 },
  { path: 'appointments/month', group: 'app', tab: false, component: Screen12 },
  { path: 'appointments/new', group: 'app', tab: false, component: Screen13 },
  { path: 'appointments/reschedule/[id]', group: 'app', tab: false, component: Screen14 },
  { path: 'appointments/swap/[id]', group: 'app', tab: false, component: Screen15 },
  { path: 'certificates/[id]', group: 'app', tab: false, component: Screen16 },
  { path: 'certificates', group: 'app', tab: false, component: Screen17 },
  { path: 'certificates/new', group: 'app', tab: false, component: Screen18 },
  { path: 'change-password', group: 'app', tab: false, component: Screen19 },
  { path: 'chat/[id]', group: 'app', tab: false, component: Screen20 },
  { path: 'chat', group: 'app', tab: false, component: Screen21 },
  { path: 'clinic-profile', group: 'app', tab: false, component: Screen22 },
  { path: 'clinic-rules', group: 'app', tab: false, component: Screen23 },
  { path: 'consult/[id]', group: 'app', tab: false, component: Screen24 },
  { path: 'consult/book', group: 'app', tab: false, component: Screen25 },
  { path: 'consult/consultant/[id]', group: 'app', tab: false, component: Screen26 },
  { path: 'consult', group: 'app', tab: false, component: Screen27 },
  { path: 'help', group: 'app', tab: false, component: Screen28 },
  { path: 'jobs', group: 'app', tab: false, component: Screen29 },
  { path: 'labs/[id]', group: 'app', tab: false, component: Screen30 },
  { path: 'labs/book/[id]', group: 'app', tab: false, component: Screen31 },
  { path: 'labs/complaints', group: 'app', tab: false, component: Screen32 },
  { path: 'labs', group: 'app', tab: false, component: Screen33 },
  { path: 'labs/invoices', group: 'app', tab: false, component: Screen34 },
  { path: 'labs/list', group: 'app', tab: false, component: Screen35 },
  { path: 'labs/orders', group: 'app', tab: false, component: Screen36 },
  { path: 'notification-settings', group: 'app', tab: false, component: Screen37 },
  { path: 'notifications', group: 'app', tab: false, component: Screen38 },
  { path: 'offers', group: 'app', tab: false, component: Screen39 },
  { path: 'offers/new', group: 'app', tab: false, component: Screen40 },
  { path: 'overview', group: 'app', tab: false, component: Screen41 },
  { path: 'patients/[id]', group: 'app', tab: false, component: Screen42 },
  { path: 'patients', group: 'app', tab: false, component: Screen43 },
  { path: 'patients/new', group: 'app', tab: false, component: Screen44 },
  { path: 'plans', group: 'app', tab: false, component: Screen45 },
  { path: 'privacy', group: 'app', tab: false, component: Screen46 },
  { path: 'recall', group: 'app', tab: false, component: Screen47 },
  { path: 'revisit', group: 'app', tab: false, component: Screen48 },
  { path: 'rx/new', group: 'app', tab: false, component: Screen49 },
  { path: 'settings', group: 'app', tab: false, component: Screen50 },
  { path: 'store', group: 'app', tab: false, component: Screen51 },
  { path: 'support', group: 'app', tab: false, component: Screen52 },
  { path: 'tariff', group: 'app', tab: false, component: Screen53 },
  { path: 'terms', group: 'app', tab: false, component: Screen54 },
  { path: 'tracking', group: 'app', tab: false, component: Screen55 },
  { path: 'wallet', group: 'app', tab: false, component: Screen56 },
  { path: 'forgot', group: 'root', tab: false, component: Screen57 },
  { path: 'login', group: 'root', tab: false, component: Screen58 },
  { path: 'signup', group: 'root', tab: false, component: Screen59 },
  { path: 'welcome', group: 'root', tab: false, component: Screen60 },
]
