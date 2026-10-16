/*
 * Dentor service worker: makes the app installable and lets the shell open without a
 * connection. It caches only the app's own static files.
 *
 * It never touches API traffic: requests to /api and to any other origin (the API may live
 * on its own domain) go straight to the network, so patient data is never stored here and
 * the app always shows live data or its own "could not load" state.
 */
const CACHE = 'dentor-shell-v1'
const SHELL = '/index.html'

// The shell is index.html plus the script and style files it names. They are stored here, at
// install time: on a first visit the page has loaded them before this worker controls it, so
// they never pass through the `fetch` handler below, and an offline start would open a blank page.
async function precacheShell() {
  const cache = await caches.open(CACHE)
  const response = await fetch(SHELL, { cache: 'no-cache' })
  if (!response.ok) throw new Error(`The app shell answered ${response.status}`)
  await cache.put(SHELL, response.clone())
  const html = await response.text()
  await cache.addAll([...namedAssets(html), '/favicon.svg', '/manifest.webmanifest'])
}

self.addEventListener('install', (event) => {
  event.waitUntil(precacheShell().then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

const isHtml = (response) => (response.headers.get('content-type') || '').includes('text/html')

// HTML is stored for the shell and nothing else. Two things arrive as HTML under another name:
// an icon or the manifest opened in a tab is a navigation too, and a server that answers unknown
// paths with index.html (the usual single-page fallback) does so for a script that no longer exists.
async function store(request, response) {
  if (response.ok && response.type === 'basic' && isHtml(response) === (request === SHELL)) {
    const cache = await caches.open(CACHE)
    await cache.put(request, response.clone())
  }
  return response
}

// These files are the same for every requester, so a `Vary` header on them is ignored. With
// `Vary: Origin` the copies stored at install (asked for without an Origin header) would otherwise
// never match the page's own request for its scripts, which carries one.
const cachedCopy = (request) => caches.match(request, { ignoreVary: true })

const namedAssets = (html) => new Set([...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((match) => match[1]))

// Keeps the stored shell current. When the page has changed, a new release is out: its files
// have new names, so everything cached from the release before is dropped.
async function refreshShell(response) {
  try {
    const previous = await cachedCopy(SHELL)
    const [before, now] = await Promise.all([previous ? previous.text() : '', response.clone().text()])
    await store(SHELL, response)
    if (!before || before === now) return
    const keep = namedAssets(now)
    const cache = await caches.open(CACHE)
    for (const request of await cache.keys()) {
      const { pathname } = new URL(request.url)
      if (pathname.startsWith('/assets/') && !keep.has(pathname)) await cache.delete(request)
    }
  } catch {
    /* housekeeping only: the page itself has already been answered */
  }
}

// Pages: always try the network so a new release is picked up; offline falls back to the shell.
async function page(event) {
  try {
    const response = await fetch(event.request)
    if (response.ok && response.type === 'basic' && isHtml(response)) event.waitUntil(refreshShell(response.clone()))
    return response
  } catch {
    return (await cachedCopy(SHELL)) ?? Response.error()
  }
}

// Build output under /assets has a content hash in its name, so a cached copy never goes stale.
async function hashedAsset(request) {
  return (await cachedCopy(request)) ?? store(request, await fetch(request))
}

// Icons and other unhashed files: answer from the cache and refresh it in the background.
async function staticFile(request) {
  const cached = await cachedCopy(request)
  const fresh = fetch(request).then((response) => store(request, response))
  if (!cached) return fresh
  fresh.catch(() => {})
  return cached
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/') || url.pathname === '/api') return

  if (request.mode === 'navigate') event.respondWith(page(event))
  else if (url.pathname.startsWith('/assets/')) event.respondWith(hashedAsset(request))
  else if (/\.(png|svg|ico|webmanifest|woff2?)$/.test(url.pathname)) event.respondWith(staticFile(request))
})
