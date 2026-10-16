import { defineConfig } from 'vite'
import { appConfig } from '../../scripts/vite-app.mjs'

export default defineConfig(appConfig({ dir: import.meta.dirname, port: 8093 }))
