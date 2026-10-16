import type { TabItem } from '@dentor/shared'

/**
 * The bottom bar, as the patient-app design draws it: icons only, with Home as the raised
 * round button in the middle. `name` is the route file inside `(app)/(tabs)`.
 *
 * The design links the bell to Notifications, the person to Profile and the home button to
 * Home. Where its grid and list icons lead is not set in the file (their links point inside
 * the bar itself), so they keep what the app had there: dental records and visits.
 */
export const TAB_ITEMS: TabItem[] = [
  { name: 'notifications', label: 'Notifications', icon: 'bell', mdi: 'bell' },
  { name: 'records', label: 'Records', icon: 'grid', mdi: 'view-grid' },
  { name: 'index', label: 'Home', icon: 'home', mdi: 'home' },
  { name: 'appointments', label: 'Visits', icon: 'list', mdi: 'format-list-bulleted-square' },
  { name: 'profile', label: 'Profile', icon: 'user', mdi: 'account' },
]
