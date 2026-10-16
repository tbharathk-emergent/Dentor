/** Session storage in the browser build: localStorage (there is no keychain on the web). */

export async function loadItem(key: string): Promise<string | null> {
  try {
    return globalThis.localStorage?.getItem(key) ?? null
  } catch {
    return null
  }
}

export async function saveItem(key: string, value: string): Promise<void> {
  try {
    globalThis.localStorage?.setItem(key, value)
  } catch {
    /* private mode: stay signed in for this tab only */
  }
}

export async function removeItem(key: string): Promise<void> {
  try {
    globalThis.localStorage?.removeItem(key)
  } catch {
    /* nothing to remove */
  }
}
