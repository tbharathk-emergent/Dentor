/**
 * The app's only doorway to navigation. Screens, hooks and components import it from here and
 * use `push` / `replace` / `back` / `canGoBack` with a path string such as '/notifications'
 * or `{ pathname: '/reports/[id]', params: { id } }`.
 */
export { useFocusEffect, useLocalSearchParams, useRouter } from '@dentor/shared'
