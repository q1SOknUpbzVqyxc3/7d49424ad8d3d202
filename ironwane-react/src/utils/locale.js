export const DEFAULT_LOCALE = 'en'

export function normalizeLocale(value) {
  if (typeof value !== 'string' || value.trim() === '') return ''
  const locale = value.trim().toLowerCase().split(/[-_]/)[0]
  return locale === 'ua' ? 'uk' : locale
}

export function detectSupportedLocale(supportedLocales, languages) {
  const candidates = Array.isArray(languages)
    ? languages
    : [...(globalThis.navigator?.languages ?? []), globalThis.navigator?.language]
  for (const candidate of candidates) {
    const locale = normalizeLocale(candidate)
    if (supportedLocales.includes(locale)) return locale
  }
  return DEFAULT_LOCALE
}

export function getLocalizedDocumentUrl(document, languages) {
  const locales = Object.keys(document.files)
  const locale = detectSupportedLocale(locales, languages)
  return document.files[locale] ?? document.files[DEFAULT_LOCALE]
}
