#!/usr/bin/env node
/**
 * Builds an app's route table from its screen files.
 *
 *   node scripts/gen-routes.mjs apps/patient          writes apps/patient/src/routes.gen.ts
 *   node scripts/gen-routes.mjs apps/patient --check  exits 1 if that file is out of date
 *
 * Every .tsx file under <app>/src/app is a screen (its default export), except files and
 * folders whose name starts with "_" or "+". The folder path is the URL path:
 *
 *   (name)   a group: left out of the path. The first group is the session state the screen
 *            belongs to ("root" when there is none).
 *   (tabs)   marks the screens shown in the bottom tab bar.
 *   index    the folder's own path.
 *   [id]     a parameter, read in the screen with useLocalSearchParams().
 *
 * The result is committed, so native builds never depend on this script having run.
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join, relative, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'

const isGroup = (segment) => /^\(.+\)$/.test(segment)

/** "(app)/(tabs)/index.tsx" → { path: "", group: "app", tab: true } */
export function describeRoute(file) {
  const segments = file.replace(/\.tsx?$/, '').split('/')
  const groups = segments.filter(isGroup).map((s) => s.slice(1, -1))
  const parts = segments.filter((s) => !isGroup(s))
  if (parts[parts.length - 1] === 'index') parts.pop()
  return {
    path: parts.join('/'),
    group: groups.find((g) => g !== 'tabs') ?? 'root',
    tab: groups.includes('tabs'),
  }
}

function listScreens(dir, base = dir) {
  const found = []
  for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.name.startsWith('_') || entry.name.startsWith('+') || entry.name.startsWith('.')) continue
    const full = join(dir, entry.name)
    if (entry.isDirectory()) found.push(...listScreens(full, base))
    else if (/\.tsx$/.test(entry.name)) found.push(relative(base, full).split(sep).join('/'))
  }
  return found
}

export function generate(appDir) {
  const screensDir = join(appDir, 'src', 'app')
  if (!existsSync(screensDir)) throw new Error(`No screens folder at ${screensDir}`)
  const files = listScreens(screensDir)
  const problems = []
  const seen = new Map()
  const routes = files.map((file, i) => {
    const route = describeRoute(file)
    if (!/export\s+default\s|export\s*\{[^}]*\bas\s+default\b/.test(readFileSync(join(screensDir, file), 'utf8'))) {
      problems.push(`src/app/${file} has no default export`)
    }
    const key = `${route.group}:${route.path}`
    if (seen.has(key)) problems.push(`src/app/${file} and src/app/${seen.get(key)} both resolve to "/${route.path}" in group "${route.group}"`)
    seen.set(key, file)
    return { ...route, file, id: `Screen${i}` }
  })
  if (problems.length) throw new Error(problems.join('\n'))

  const lines = [
    '// Generated from the files in src/app by scripts/gen-routes.mjs. Do not edit by hand:',
    '// run `npm run routes` after adding, moving or removing a screen.',
    "import type { RouteDef } from '@dentor/shared'",
    ...routes.map((r) => `import ${r.id} from './app/${r.file.replace(/\.tsx$/, '')}'`),
    '',
    'export const routes: RouteDef[] = [',
    ...routes.map((r) => `  { path: '${r.path}', group: '${r.group}', tab: ${r.tab}, component: ${r.id} },`),
    ']',
    '',
  ]
  return { text: lines.join('\n'), count: routes.length }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2)
  const check = args.includes('--check')
  const appDir = resolve(args.find((a) => !a.startsWith('--')) ?? '.')
  try {
    const { text, count } = generate(appDir)
    const out = join(appDir, 'src', 'routes.gen.ts')
    const current = existsSync(out) ? readFileSync(out, 'utf8') : ''
    if (check) {
      if (current !== text) {
        console.error(`${relative(process.cwd(), out)} is out of date. Run "npm run routes".`)
        process.exit(1)
      }
    } else if (current !== text) {
      writeFileSync(out, text)
      console.log(`routes: wrote ${count} screens to ${relative(process.cwd(), out)}`)
    }
  } catch (error) {
    console.error(`routes: ${error.message}`)
    process.exit(1)
  }
}
