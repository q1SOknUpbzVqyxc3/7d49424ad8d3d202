import assert from 'node:assert/strict'
import test from 'node:test'
import { detectSupportedLocale, getLocalizedDocumentUrl } from './locale.js'

const supported = ['en', 'ru', 'uk']
const document = { files: { en: '/en.pdf', ru: '/ru.pdf', uk: '/uk.pdf' } }

test('detects English regional locales', () => {
  assert.equal(detectSupportedLocale(supported, ['en-US']), 'en')
  assert.equal(detectSupportedLocale(supported, ['en-GB']), 'en')
})

test('detects Russian and Ukrainian aliases', () => {
  assert.equal(detectSupportedLocale(supported, ['ru-RU']), 'ru')
  assert.equal(detectSupportedLocale(supported, ['ua-UA']), 'uk')
})

test('falls back to English', () => {
  assert.equal(detectSupportedLocale(supported, ['ja-JP']), 'en')
  assert.equal(detectSupportedLocale(supported, []), 'en')
  assert.equal(getLocalizedDocumentUrl(document, ['xx']), '/en.pdf')
})
