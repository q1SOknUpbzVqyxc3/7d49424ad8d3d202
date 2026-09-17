import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import test from 'node:test'
import { documents } from '../config/documents.js'
import {
  detectSupportedLocale,
  getLocalizedDocumentUrl,
  localizeRoute,
  normalizeLocale,
  readPersistedLocale,
  resolveDocumentLocale,
  resolveSiteLocale,
  SITE_LOCALES
} from './locale.js'

const document = { files: { en: '/en.pdf', ru: '/ru.pdf', uk: '/uk.pdf', es: '/es.pdf', cs: '/cs.pdf' } }
const matrix = [
  ['en', 'en'], ['en-US', 'en'], ['en-GB', 'en'],
  ['ru', 'ru'], ['ru-RU', 'ru'], ['uk', 'uk'], ['uk-UA', 'uk'],
  ['es', 'es'], ['es-ES', 'es'], ['es-MX', 'es'], ['cs', 'cs'], ['cs-CZ', 'cs'],
  ['de-DE', 'en'], ['fr-FR', 'en'], ['pl-PL', 'en'], ['zh-CN', 'en'], ['ja-JP', 'en'],
  ['unknown', 'en'], ['', 'en'], [null, 'en']
]

test('normalizes and resolves the browser locale matrix', () => {
  for (const [input, expected] of matrix) assert.equal(detectSupportedLocale(SITE_LOCALES, [input]), expected, String(input))
  assert.equal(normalizeLocale('ua-UA'), 'uk')
  assert.equal(detectSupportedLocale(SITE_LOCALES, ['de-DE', 'ru-RU', 'en-US']), 'ru')
})

test('persisted locale has priority over browser locale', () => {
  assert.equal(resolveSiteLocale({ persistedLocale: 'en', languages: ['ru-RU'] }), 'en')
  const storage = { getItem: () => 'es-MX' }
  assert.equal(readPersistedLocale('site-lang', storage), 'es')
})

test('site locale has priority for documents and English is the fallback', () => {
  assert.equal(resolveDocumentLocale(document, { siteLocale: 'en', persistedLocale: 'ru', languages: ['uk-UA'] }), 'en')
  assert.equal(resolveDocumentLocale(document, { persistedLocale: 'ru', languages: ['uk-UA'] }), 'ru')
  assert.equal(resolveDocumentLocale(document, { languages: ['de-DE', 'es-MX'] }), 'es')
  assert.equal(resolveDocumentLocale(document, { siteLocale: 'de', languages: ['ru-RU'] }), 'en')
  assert.equal(getLocalizedDocumentUrl(document, { languages: ['xx'] }), '/en.pdf')
  assert.equal(getLocalizedDocumentUrl({ files: { en: '/en.pdf' } }, { siteLocale: 'ru' }), '/en.pdf')
})

test('localizes the equivalent route', () => {
  assert.equal(localizeRoute('/ru/privacy/', 'en'), '/en/privacy/')
  assert.equal(localizeRoute('/', 'cs'), '/cs/')
})

test('all configured document files and English fallbacks exist', () => {
  for (const item of documents) {
    assert.ok(item.files.en, item.id)
    for (const [locale, file] of Object.entries(item.files)) {
      assert.equal(existsSync(`public${file}`), true, file)
      assert.equal(getLocalizedDocumentUrl(item, { siteLocale: locale }), file)
    }
    assert.equal(getLocalizedDocumentUrl(item, { siteLocale: 'cs' }), item.files.en)
  }
})
