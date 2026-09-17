import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const index = JSON.parse(readFileSync(path.join(root, 'src/content/route-index.json'), 'utf8'))
const missing = new Set()

assert.equal(Object.keys(index).length, 161)

for (const [route, filename] of Object.entries(index)) {
  const page = JSON.parse(readFileSync(path.join(root, 'src/content/pages', filename), 'utf8'))
  assert.equal(page.route, route)
  assert.ok(page.locale)
  assert.ok(page.seo.title)
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
}

assert.deepEqual([...missing], [])
console.log(`content validation passed: ${Object.keys(index).length} routes`)
