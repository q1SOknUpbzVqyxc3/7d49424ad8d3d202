import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { documents } from '../src/config/documents.js'
import { routes } from '../src/config/routes.js'
import { SITE_LOCALES } from '../src/utils/locale.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const publicRoot = path.join(root, 'public')
const missing = new Set()
const routePaths = Object.keys(routes)
const expectedRoutes = SITE_LOCALES.map((locale) => `/${locale}/`)

function markupFor(page) {
  return [page.chrome, page.header, ...page.sections, page.footer].join('')
}

function tagSignature(markup) {
  return [...markup.matchAll(/<\/?([a-z0-9-]+)/gi)]
    .map((match) => `${match[0].startsWith('</') ? '/' : ''}${match[1].toLowerCase()}`)
    .join(' ')
}

function validatePublicReferences(markup) {
  const ids = new Set([...markup.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]))
  ids.add('contact')
  ids.add('top')
  for (const match of markup.matchAll(/\b(?:href|src)="([^"]+)"/g)) {
    const url = match[1]
    if (url.startsWith('#')) {
      assert.ok(ids.has(url.slice(1)), `missing anchor target: ${url}`)
      continue
    }
    if (!url.startsWith('/') || url.startsWith('/api/')) continue
    const pathname = url.split(/[?#]/)[0]
    if (pathname && /\.[a-z0-9]+$/i.test(pathname) && !existsSync(path.join(publicRoot, pathname))) missing.add(pathname)
  }
}

assert.deepEqual(routePaths.sort(), expectedRoutes.sort())

const pages = Object.fromEntries(SITE_LOCALES.map((locale) => {
  const definition = routes[`/${locale}/`]
  assert.equal(definition.locale, locale)
  assert.equal(definition.contentLocale, locale)
  assert.equal(definition.seo.meta.find((item) => item.name === 'robots')?.content, 'index, follow')
  assert.equal(definition.seo.links.find((item) => item.rel === 'canonical')?.href, `https://amix-team.digital/${locale}/`)
  assert.equal(definition.seo.links.filter((item) => item.hreflang).length, SITE_LOCALES.length + 1)
  const file = path.join(root, 'src/content/pages', definition.content)
  assert.ok(existsSync(file), `missing localized content: ${definition.content}`)
  return [locale, JSON.parse(readFileSync(file, 'utf8'))]
}))

const referenceBlocks = [pages.ru.chrome, pages.ru.header, ...pages.ru.sections, pages.ru.footer]
for (const [locale, page] of Object.entries(pages)) {
  assert.equal(page.sections.length, 11, `${locale}: expected 11 sections`)
  const blocks = [page.chrome, page.header, ...page.sections, page.footer]
  assert.deepEqual(blocks.map(tagSignature), referenceBlocks.map(tagSignature), `${locale}: HTML structure differs from Russian source`)
  const markup = markupFor(page)
  assert.match(markup, /<h1\b/, `${locale}: missing h1`)
  assert.match(markup, /href="#contact"/, `${locale}: contact form is not linked from navigation`)
  if (['en', 'es', 'cs'].includes(locale)) assert.doesNotMatch(markup, /[А-Яа-яЁё]/, `${locale}: untranslated Cyrillic text`)
  if (locale === 'uk') assert.doesNotMatch(markup, /[ыэёъЫЭЁЪ]/, 'uk: Russian-only letters found')
  validatePublicReferences(markup)
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
for (const route of expectedRoutes) assert.match(sitemap, new RegExp(`https://amix-team\\.digital${route}`))
assert.deepEqual([...missing], [])
process.stdout.write(`content validation passed: ${routePaths.length} localized routes, ${documents.length} documents\n`)
