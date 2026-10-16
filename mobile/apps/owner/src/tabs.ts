import type { TabsConfig } from '@dentor/shared'

/**
 * The bottom bar of the Dentor Clinic app; `name` is the screen file in src/app/(app)/(tabs).
 *
 * The design's bar (dentor.fig "Home" 37:626) is a floating #ff0004 pill of white icons: home,
 * wallet, appointments and profile. Entries are replaced by the designed screens as they are built
 * (docs/IMPLEMENTATION_PLAN.md); meanwhile the app's own Finance and Operations fill the middle.
 * Screens in the folder that are not listed here (Team) stay reachable from the menu.
 */
export const TABS: Record<string, TabsConfig> = {
  app: {
    items: [
      { name: 'index', label: 'Home', icon: 'home', mdi: 'home' },
      { name: 'finance', label: 'Accounts', icon: 'credit-card', mdi: 'wallet' },
      { name: 'operations', label: 'Operations', icon: 'activity', mdi: 'clipboard-list' },
      { name: 'more', label: 'Profile', icon: 'user', mdi: 'account-circle' },
    ],
    initial: 'index',
    labels: false,
    pill: true,
  },
}
