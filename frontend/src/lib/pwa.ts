import { useEffect, useState } from 'react'

/** The browser's "install this app" offer (Chromium). Absent in browsers without one. */
interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let offer: InstallPromptEvent | null = null
const listeners = new Set<() => void>()
const changed = () => listeners.forEach((listener) => listener())

/**
 * Registers the service worker (production builds only, so development always loads fresh
 * code) and keeps hold of the browser's install offer for `useInstallPrompt`.
 */
export function setupPwa() {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault() // show it from our own button instead of the browser's banner
    offer = event as InstallPromptEvent
    changed()
  })
  window.addEventListener('appinstalled', () => {
    offer = null
    changed()
  })
  if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        /* installability is an extra: the app works without it */
      })
    })
  }
}

/** `canInstall` is true only while the browser is offering to install the app. */
export function useInstallPrompt() {
  const [, rerender] = useState(0)
  useEffect(() => {
    const listener = () => rerender((n) => n + 1)
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }, [])
  const install = async () => {
    if (!offer) return
    const current = offer
    offer = null // an offer can be used once
    changed()
    await current.prompt()
    await current.userChoice
  }
  return { canInstall: offer !== null, install }
}
