import type { TabsConfig } from '@dentor/shared'

/**
 * Bottom tabs of the signed-in area; `name` is the screen file in src/app/(app)/(tabs).
 *
 * The design's bar (frame "Home" 6933:11981) is a floating #0a338e pill of four gold icons:
 * home, wallet, appointments and profile. Patients is the app's own fifth tab.
 */
export const TABS: Record<string, TabsConfig> = {
  app: {
    items: [
      { name: 'index', label: 'Today', icon: 'home', mdi: 'home' },
      { name: 'earnings', label: 'Earnings', icon: 'credit-card', mdi: 'wallet' },
      { name: 'schedule', label: 'Schedule', icon: 'calendar', mdi: 'clipboard-list' },
      { name: 'patients', label: 'Patients', icon: 'users', mdi: 'account-group' },
      { name: 'profile', label: 'Profile', icon: 'user', mdi: 'account-circle' },
    ],
    initial: 'index',
    labels: false,
    pill: true,
  },
}
