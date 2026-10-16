/** Path matching for the route table. No React or React Native imports, so it runs anywhere. */

/** A path such as "/appointments/42", or a pattern with its parameters. */
export type Href = string | { pathname: string; params?: Record<string, string | number | undefined | null> }

export type RouteParams = Record<string, string>

export interface RoutePattern {
  /** Path pattern without a leading slash; "" is the index; "[id]" is a parameter. */
  path: string
}

const decode = (value: string) => {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function splitHref(href: Href): { segments: string[]; params: RouteParams } {
  const params: RouteParams = {}
  let pathname: string
  if (typeof href === 'string') {
    const [path, query = ''] = href.split('?')
    pathname = path
    for (const pair of query.split('&')) {
      if (!pair) continue
      const [k, v = ''] = pair.split('=')
      params[decode(k)] = decode(v.replace(/\+/g, ' '))
    }
  } else {
    pathname = href.pathname
    for (const [k, v] of Object.entries(href.params ?? {})) {
      if (v !== undefined && v !== null) params[k] = String(v)
    }
  }
  const segments = pathname
    .split('/')
    .filter((s) => s && !/^\(.+\)$/.test(s)) // groups never appear in a path
    .filter((s, i, all) => !(s === 'index' && i === all.length - 1))
  return { segments, params }
}

/**
 * Finds the route for a path. A static segment wins over a "[param]" segment, so
 * "/prescriptions/new" reaches `prescriptions/new` even when `prescriptions/[id]` exists.
 * A parameter may be given in the path ("/patients/7") or as a pattern with params
 * ({ pathname: '/patients/[id]', params: { id: 7 } }); other params pass through unchanged.
 */
export function matchRoute<R extends RoutePattern>(routes: readonly R[], href: Href): { route: R; params: RouteParams } | null {
  const { segments, params } = splitHref(href)
  let best: { route: R; params: RouteParams; dynamic: number } | null = null
  for (const route of routes) {
    const pattern = route.path ? route.path.split('/') : []
    if (pattern.length !== segments.length) continue
    const found: RouteParams = {}
    let dynamic = 0
    let ok = true
    for (let i = 0; i < pattern.length; i += 1) {
      const name = /^\[(.+)\]$/.exec(pattern[i])?.[1]
      if (name) {
        if (segments[i] !== pattern[i]) found[name] = decode(segments[i])
        else if (params[name] === undefined) ok = false // pattern given without its value
        dynamic += 1
      } else if (pattern[i] !== segments[i]) {
        ok = false
      }
      if (!ok) break
    }
    if (ok && (!best || dynamic < best.dynamic)) best = { route, params: { ...params, ...found }, dynamic }
  }
  return best ? { route: best.route, params: best.params } : null
}

/** The name a route is registered under: its path, or "index" for the root. */
export const routeName = (path: string) => path || 'index'
