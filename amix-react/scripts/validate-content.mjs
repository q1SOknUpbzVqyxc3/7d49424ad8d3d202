import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { documents } from '../src/config/documents.js'
import { routes } from '../src/config/routes.js'
import { SITE_LOCALES } from '../src/utils/locale.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const publicRoot = path.join(root, 'public')
const page = JSON.parse(readFileSync(path.join(root, 'src/content/page.json'), 'utf8'))
const markup = [page.chrome, page.header, ...page.sections, page.footer].join('')
const missing = new Set()

assert.deepEqual(Object.keys(routes).sort(), SITE_LOCALES.map((locale) => `/${locale}/`).sort())
assert.match(markup, /<h1\b/)

for (const match of markup.matchAll(/\b(?:href|src)="([^"]+)"/g)) {
  const url = match[1]
  if (!url.startsWith('/') || url.startsWith('/api/')) continue
  const pathname = url.split(/[?#]/)[0]
  if (pathname && /\.[a-z0-9]+$/i.test(pathname) && !existsSync(path.join(publicRoot, pathname))) missing.add(pathname)
}

for (const document of documents) {
  assert.ok(document.files.en, `${document.id} requires an English fallback`)
  for (const [locale, file] of Object.entries(document.files)) {
    assert.ok(locale)
    const absolute = path.join(publicRoot, file)
    if (!existsSync(absolute)) missing.add(file)
    else assert.equal(readFileSync(absolute).subarray(0, 5).toString(), '%PDF-', file)
  }
}

for (const required of ['/favicon.svg', '/assets/og.svg', '/assets/site.webmanifest', '/robots.txt', '/sitemap.xml', '/_headers']) {
  if (!existsSync(path.join(publicRoot, required))) missing.add(required)
}

const sitemap = readFileSync(path.join(publicRoot, 'sitemap.xml'), 'utf8')
assert.match(sitemap, /https:\/\/amix-team\.digital\/ru\//)
assert.deepEqual([...missing], [])
process.stdout.write(`content validation passed: ${Object.keys(routes).length} locale routes, ${documents.length} documents\n`)
