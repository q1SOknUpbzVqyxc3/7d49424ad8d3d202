import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { documents } from '../src/config/documents.js'
import { SITE_LOCALES } from '../src/utils/locale.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const index = JSON.parse(readFileSync(path.join(root, 'src/content/route-index.json'), 'utf8'))
const missing = new Set()
const siteOrigin = 'https://ironvane-media.com'

assert.equal(Object.keys(index).length, 161)
assert.deepEqual(
  [...new Set(Object.values(index).filter((filename) => filename !== 'not-found.json').map((filename) => filename.split('__')[0].replace('.json', '')))].sort(),
  [...SITE_LOCALES].sort()
)

for (const [route, filename] of Object.entries(index)) {
  const page = JSON.parse(readFileSync(path.join(root, 'src/content/pages', filename), 'utf8'))
  assert.equal(page.route, route)
  assert.ok(page.locale)
  assert.ok(page.seo.title)
  assert.ok(page.seo.meta.some((item) => item.name === 'description'))
  assert.ok(page.seo.links.some((item) => item.rel === 'canonical'))
  assert.match(page.main, /<h1\b/)
  const html = [page.pre, page.header, page.between, page.main, page.footer, page.post].join('')
  for (const match of html.matchAll(/\b(?:href|src|action|data-endpoint)="([^"]+)"/g)) {
    const url = match[1]
    if (!url.startsWith('/') || url.startsWith('/api/')) continue
    const pathname = url.split(/[?#]/)[0]
    if (pathname === '/') continue
    if (/\.[a-z0-9]+$/i.test(pathname)) {
      if (!existsSync(path.join(root, 'public', pathname))) missing.add(pathname)
      continue
    }
    const normalized = pathname.endsWith('/') ? pathname : `${pathname}/`
    if (!index[normalized]) missing.add(normalized)
  }
  for (const link of page.seo.links.filter((item) => item.hreflang && item.hreflang !== 'x-default')) {
    const pathname = new URL(link.href, siteOrigin).pathname
    if (!index[pathname]) missing.add(pathname)
  }
}

for (const document of documents) {
  assert.ok(document.files.en, `${document.id} requires an English fallback`)
  for (const file of Object.values(document.files)) {
    const absolute = path.join(root, 'public', file)
    if (!existsSync(absolute)) missing.add(file)
    else assert.equal(readFileSync(absolute).subarray(0, 5).toString(), '%PDF-', file)
  }
}

for (const required of ['/assets/site.webmanifest', '/assets/img/favicon.svg', '/assets/img/og.png', '/robots.txt', '/sitemap.xml', '/_headers']) {
  if (!existsSync(path.join(root, 'public', required))) missing.add(required)
}

const sitemap = readFileSync(path.join(root, 'public/sitemap.xml'), 'utf8')
const sitemapRoutes = new Set([...sitemap.matchAll(/<loc>https:\/\/ironvane-media\.com([^<]+)<\/loc>/g)].map((match) => match[1]))
for (const route of Object.keys(index).filter((item) => item !== '/404')) {
  if (!sitemapRoutes.has(route)) missing.add(`sitemap:${route}`)
}

assert.deepEqual([...missing], [])
process.stdout.write(`content validation passed: ${Object.keys(index).length} routes, ${documents.length} documents\n`)
