/**
 * Navigation for the Dentor apps, built on React Navigation.
 *
 * Screens are plain files under each app's `src/app/` folder; `scripts/gen-routes.mjs` turns
 * that folder into a route table (`src/routes.gen.ts`):
 *
 *   src/app/(app)/(tabs)/index.tsx          → path ""                  group "app"  tab
 *   src/app/(app)/appointments/[id].tsx     → path "appointments/[id]" group "app"
 *   src/app/login.tsx                       → path "login"             group "root"
 *
 * A folder in (parentheses) is a group: it does not appear in the path. The first group
 * names the session state that may reach the screen; `(tabs)` marks bottom-tab screens.
 * Only the routes of the active group are mounted, so a signed-out user cannot reach a
 * signed-in screen by any path or deep link.
 *
 * Screens navigate with `useRouter()` and read parameters with `useLocalSearchParams()`.
 */
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import {
  NavigationContainer,
  StackActions,
  useFocusEffect,
  useIsFocused,
  useNavigation,
  useRoute,
  type LinkingOptions,
} from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, type ComponentType } from 'react'
import { BackHandler, Platform, View } from 'react-native'
import type { IconName } from '../ui/icons'
import { BottomBar, type TabItem } from '../ui/tabbar'
import { matchRoute, routeName, type Href } from './match'

export { matchRoute, useFocusEffect }
export type { Href }

export interface RouteDef {
  /** Path pattern without a leading slash; "" is the index; "[id]" is a parameter. */
  path: string
  /** The session state this screen belongs to ("root" when the file is in no group). */
  group: string
  /** True for screens shown in the bottom tab bar. */
  tab: boolean
  component: ComponentType<any>
}

export interface TabsConfig {
  /** Tab buttons in order; `name` is the screen's file name ("index" for the first tab). */
  items: TabItem[]
  /** Optional raised action in the middle of the bar. */
  center?: { icon: IconName; label: string; href: Href }
  /** The tab that opens first and that Android's back button returns to (default: the first item). */
  initial?: string
  /** A tab drawn as the raised button in the middle of the bar, instead of a `center` action. */
  raised?: string
  /** False for a bar of icons without labels, as some designs have it. */
  labels?: boolean
  /** The floating rounded bar of the staff designs. */
  pill?: boolean
}

const TABS = '__tabs'

/**
 * In the browser build a tab that is not shown stays mounted underneath the shown one, still
 * visible to the page and to screen readers. Take it out of the page instead, as the native
 * builds do. Wrapped once per screen component.
 */
const webWrapped = new WeakMap<ComponentType<any>, ComponentType<any>>()
function webHidden(Component: ComponentType<any>): ComponentType<any> {
  if (Platform.OS !== 'web') return Component
  let wrapped = webWrapped.get(Component)
  if (!wrapped) {
    wrapped = function WebTab(props: any) {
      const focused = useIsFocused()
      return (
        <View style={{ flex: 1, display: focused ? 'flex' : 'none' }}>
          <Component {...props} />
        </View>
      )
    }
    webWrapped.set(Component, wrapped)
  }
  return wrapped
}

/* ------------------------------------------------------------------ router */

const RoutesCtx = createContext<RouteDef[]>([])

export interface Router {
  /** Opens a screen on top of the current one (or switches to it, for a tab). */
  push: (href: Href) => void
  /** Opens a screen in place of the current one. */
  replace: (href: Href) => void
  back: () => void
  canGoBack: () => boolean
}

export function useRouter(): Router {
  const navigation = useNavigation<any>()
  const routes = useContext(RoutesCtx)
  return useMemo(() => {
    const go = (href: Href, mode: 'push' | 'replace') => {
      const match = matchRoute(routes, href)
      if (!match) {
        if (__DEV__) console.warn(`No screen for path ${JSON.stringify(href)}`)
        return
      }
      const name = routeName(match.route.path)
      const params = Object.keys(match.params).length ? match.params : undefined
      if (match.route.tab) {
        // All tabs live in one stack entry: return to it and select the tab.
        navigation.navigate(TABS, { screen: name, params }, { pop: true })
      } else if (mode === 'replace') {
        navigation.dispatch(StackActions.replace(name, params))
      } else {
        navigation.dispatch(StackActions.push(name, params))
      }
    }
    return {
      push: (href) => go(href, 'push'),
      replace: (href) => go(href, 'replace'),
      back: () => navigation.goBack(),
      canGoBack: () => navigation.canGoBack(),
    }
  }, [navigation, routes])
}

/** Path and query parameters of the current screen (always strings). */
export function useLocalSearchParams<T extends Record<string, string | undefined> = Record<string, string>>(): T {
  const route = useRoute()
  return (route.params ?? {}) as T
}

/** Renders nothing and replaces the current screen with `href`. */
export function Redirect({ href }: { href: Href }) {
  const router = useRouter()
  useEffect(() => {
    router.replace(href)
  }, [router, href])
  return null
}

/**
 * Sends the device's own ways of going back through `onBack`: the Android back button calls
 * it, and the iOS edge swipe is switched off so the screen's back button is the way out.
 * For screens whose back button does more than leave, such as an unsaved form or a step in
 * a flow. Pass undefined for the normal behaviour.
 */
export function useBackOverride(onBack: (() => void) | undefined) {
  const navigation = useNavigation<any>()
  const active = !!onBack
  const latest = useRef(onBack)
  latest.current = onBack

  useEffect(() => {
    if (!active) return
    navigation.setOptions({ gestureEnabled: false })
    return () => navigation.setOptions({ gestureEnabled: true })
  }, [navigation, active])

  useFocusEffect(
    useCallback(() => {
      // Only Android has a back button; elsewhere BackHandler is absent or logs an error.
      if (!active || Platform.OS !== 'android') return
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        latest.current?.()
        return true
      })
      return () => subscription.remove()
    }, [active]),
  )
}

/* --------------------------------------------------------------- navigator */

const Stack = createNativeStackNavigator()
const Tab = createBottomTabNavigator()

// "[id]" → ":id" for React Navigation's URL patterns (used by the browser build).
const linkPath = (path: string) => path.replace(/\[(.+?)\]/g, ':$1')

function buildLinking(routes: RouteDef[], hasTabs: boolean): LinkingOptions<any> {
  const screens: Record<string, any> = {}
  const tabScreens: Record<string, string> = {}
  for (const r of routes) {
    if (r.tab) tabScreens[routeName(r.path)] = linkPath(r.path)
    else screens[routeName(r.path)] = linkPath(r.path)
  }
  if (hasTabs) screens[TABS] = { path: '', screens: tabScreens }
  return { prefixes: [], config: { screens } }
}

/**
 * Mounts the screens of one group. Pass the group for the current session state; when it
 * changes (sign-in, sign-out) the whole navigation tree is rebuilt from that group's routes.
 * `tabs` must be a constant (defined outside the component) keyed by group name.
 * `start` names the first screen of a group without an index screen (e.g. `{ root: 'login' }`).
 */
export function AppNavigator({
  routes,
  group,
  tabs,
  start,
}: {
  routes: RouteDef[]
  group: string
  tabs?: Partial<Record<string, TabsConfig>>
  start?: Partial<Record<string, string>>
}) {
  const active = useMemo(() => routes.filter((r) => r.group === group), [routes, group])
  const tabRoutes = useMemo(() => active.filter((r) => r.tab), [active])
  const stackRoutes = useMemo(() => {
    const rest = active.filter((r) => !r.tab)
    // In a group without tabs the index screen (or the group's named start) opens first.
    const first = start?.[group] ?? ''
    return [...rest.filter((r) => r.path === first), ...rest.filter((r) => r.path !== first)]
  }, [active, start, group])
  const tabsConfig = tabs?.[group]
  const hasTabs = tabRoutes.length > 0
  // The browser build keeps the address bar in step with the current screen.
  const linking = useMemo(() => (Platform.OS === 'web' ? buildLinking(active, hasTabs) : undefined), [active, hasTabs])

  const TabsScreen = useMemo(() => {
    if (!hasTabs) return null
    const items: TabItem[] = tabsConfig?.items ?? tabRoutes.map((r) => ({ name: routeName(r.path), label: routeName(r.path), icon: 'circle' }))
    const position = (r: RouteDef) => {
      const at = items.findIndex((item) => item.name === routeName(r.path))
      return at < 0 ? items.length : at
    }
    // Mounted in the configured order, so the first configured tab is the one that opens.
    const ordered = [...tabRoutes].sort((a, b) => position(a) - position(b))
    const center = tabsConfig?.center
    const initial = tabsConfig?.initial
    return function Tabs() {
      const router = useRouter()
      return (
        <Tab.Navigator
          screenOptions={{ headerShown: false }}
          initialRouteName={initial}
          backBehavior={initial ? 'initialRoute' : 'firstRoute'}
          tabBar={(props) => (
            <BottomBar
              state={props.state}
              navigation={props.navigation}
              items={items}
              center={center ? { icon: center.icon, label: center.label, onPress: () => router.push(center.href) } : undefined}
              raised={tabsConfig?.raised}
              labels={tabsConfig?.labels ?? true}
              pill={tabsConfig?.pill}
            />
          )}
        >
          {ordered.map((r) => (
            <Tab.Screen key={routeName(r.path)} name={routeName(r.path)} component={webHidden(r.component)} />
          ))}
        </Tab.Navigator>
      )
    }
  }, [hasTabs, tabRoutes, tabsConfig])

  return (
    <RoutesCtx.Provider value={active}>
      <NavigationContainer key={group} linking={linking} documentTitle={{ enabled: false }}>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {TabsScreen ? <Stack.Screen name={TABS} component={TabsScreen} /> : null}
          {stackRoutes.map((r) => (
            <Stack.Screen key={routeName(r.path)} name={routeName(r.path)} component={r.component} />
          ))}
        </Stack.Navigator>
      </NavigationContainer>
    </RoutesCtx.Provider>
  )
}
