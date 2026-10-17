/**
 * Vite configuration shared by the three apps' browser builds (react-native-web).
 * The browser build is for previews, end-to-end tests and the web versions of the apps (docs/WEB_APPS.md); it
 * talks to the local API unless DENTOR_API_URL says otherwise. Phones get the native Android/iOS builds.
 */
import react from '@vitejs/plugin-react'
import path from 'node:path'

// A file named x.web.ts replaces x.ts in the browser, as x.ios.ts / x.android.ts do on devices.
const EXTENSIONS = ['.web.tsx', '.web.ts', '.web.jsx', '.web.js', '.tsx', '.ts', '.jsx', '.js', '.json']

export function appConfig({ dir, port }) {
  return ({ mode }) => ({
    root: dir,
    plugins: [react()],
    resolve: {
      alias: [
        { find: /^react-native$/, replacement: 'react-native-web' },
        { find: /^@\//, replacement: `${path.join(dir, 'src')}/` },
      ],
      extensions: EXTENSIONS,
      dedupe: ['react', 'react-dom', 'react-native-web'],
    },
    define: {
      __DEV__: JSON.stringify(mode !== 'production'),
      __API_URL__: JSON.stringify(process.env.DENTOR_API_URL || 'http://localhost:8000'),
      global: 'globalThis',
    },
    optimizeDeps: { rolldownOptions: { resolve: { extensions: EXTENSIONS } } },
    server: { port, strictPort: true },
    preview: { port, strictPort: true },
    build: { outDir: 'dist-web', emptyOutDir: true, chunkSizeWarningLimit: 2500 },
  })
}
