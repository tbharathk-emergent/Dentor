import type { useRouter } from '@/nav'

/** Anything `router.push()` accepts: a path or `{ pathname, params }`. */
export type AppHref = Parameters<ReturnType<typeof useRouter>['push']>[0]
