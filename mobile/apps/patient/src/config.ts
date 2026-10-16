import env from '../env.json'

declare const __API_URL__: string | undefined

/**
 * Where the Dentor API lives. Phones use env.json: `devApiUrl` in debug builds, `apiUrl` in
 * release builds. The browser build is given its address by Vite (see scripts/vite-app.mjs).
 */
export const API_URL: string = typeof __API_URL__ === 'string' && __API_URL__ ? __API_URL__ : __DEV__ ? env.devApiUrl : env.apiUrl
