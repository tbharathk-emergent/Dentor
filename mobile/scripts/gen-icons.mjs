#!/usr/bin/env node
/**
 * Renders each app's launcher icons from the Dentor tooth mark into the native projects.
 *
 *   node scripts/gen-icons.mjs
 *
 * Writes, per app:
 *   ios/<Name>/Images.xcassets/AppIcon.appiconset/   one 1024px icon (Xcode makes the sizes)
 *   android/app/src/main/res/mipmap-*                legacy, round and adaptive launcher icons
 *
 * The results are committed; run this again only when the mark or an app's colours change.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

// Same tooth as the reception web app's favicon, drawn in a 32×32 box.
const TOOTH = 'M16 6c-3.6 0-6.5 2.6-6.5 6.2 0 2.4.9 4.1 1.7 6 .7 1.6 1.2 4.4 1.6 6.2.2.9 1.4 1 1.8.1l1-4.2c.1-.5.7-.5.8 0l1 4.2c.3.9 1.6.8 1.8-.1.4-1.8.9-4.6 1.6-6.2.8-1.9 1.7-3.6 1.7-6C22.5 8.6 19.6 6 16 6z'

// One mark, three tiles, so the apps can be told apart on a home screen.
const APPS = [
  { dir: 'patient', ios: 'DentorPatient', background: '#0f766e', mark: '#ffffff' },
  { dir: 'consultant', ios: 'DentorConsultant', background: '#ffffff', mark: '#0f766e' },
  { dir: 'owner', ios: 'DentorOwner', background: '#0f172a', mark: '#5eead4' },
]

const DENSITIES = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 }

/** `scale` is the mark's size relative to the tile; `shape` clips the tile. */
function svg({ size, background, mark, scale, shape }) {
  const offset = (32 - 32 * scale) / 2
  const tile =
    shape === 'none' ? '' :
    shape === 'circle' ? `<circle cx="16" cy="16" r="16" fill="${background}"/>` :
    `<rect width="32" height="32" rx="${shape === 'rounded' ? 6 : 0}" fill="${background}"/>`
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32">${tile}<g transform="translate(${offset} ${offset}) scale(${scale})"><path d="${TOOTH}" fill="${mark}"/></g></svg>`
}

const browser = await chromium.launch()
async function render(file, options) {
  const { size } = options
  const page = await (await browser.newContext({ viewport: { width: size, height: size }, deviceScaleFactor: 1 })).newPage()
  await page.setContent(`<html><body style="margin:0;background:transparent">${svg(options)}</body></html>`)
  mkdirSync(dirname(file), { recursive: true })
  // iOS rejects icons with transparency, so the full-bleed square is rendered opaque.
  await page.screenshot({ path: file, omitBackground: options.shape !== 'square', clip: { x: 0, y: 0, width: size, height: size } })
  await page.close()
}

for (const app of APPS) {
  const base = join(root, 'apps', app.dir)
  const colours = { background: app.background, mark: app.mark }

  const iconset = join(base, 'ios', app.ios, 'Images.xcassets', 'AppIcon.appiconset')
  await render(join(iconset, 'icon-1024.png'), { ...colours, size: 1024, scale: 0.86, shape: 'square' })
  writeFileSync(join(iconset, 'Contents.json'), JSON.stringify({
    images: [{ filename: 'icon-1024.png', idiom: 'universal', platform: 'ios', size: '1024x1024' }],
    info: { author: 'xcode', version: 1 },
  }, null, 2) + '\n')

  const res = join(base, 'android', 'app', 'src', 'main', 'res')
  for (const [density, factor] of Object.entries(DENSITIES)) {
    const dir = join(res, `mipmap-${density}`)
    await render(join(dir, 'ic_launcher.png'), { ...colours, size: 48 * factor, scale: 0.86, shape: 'rounded' })
    await render(join(dir, 'ic_launcher_round.png'), { ...colours, size: 48 * factor, scale: 0.78, shape: 'circle' })
    // Adaptive icon layers are 108dp with the mark inside the central 66dp safe zone.
    await render(join(dir, 'ic_launcher_foreground.png'), { ...colours, size: 108 * factor, scale: 0.58, shape: 'none' })
    await render(join(dir, 'ic_launcher_monochrome.png'), { ...colours, mark: '#000000', size: 108 * factor, scale: 0.58, shape: 'none' })
  }
  const adaptive = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
    <monochrome android:drawable="@mipmap/ic_launcher_monochrome"/>
</adaptive-icon>
`
  mkdirSync(join(res, 'mipmap-anydpi-v26'), { recursive: true })
  writeFileSync(join(res, 'mipmap-anydpi-v26', 'ic_launcher.xml'), adaptive)
  writeFileSync(join(res, 'mipmap-anydpi-v26', 'ic_launcher_round.xml'), adaptive)
  writeFileSync(join(res, 'values', 'ic_launcher_background.xml'), `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">${app.background}</color>
</resources>
`)
  console.log(`icons: ${app.dir}`)
}
await browser.close()
