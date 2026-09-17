export const DEFAULT_LOCALE = 'en'
export const SITE_LOCALES = ['en', 'ru', 'uk', 'es', 'cs']

export function normalizeLocale(value) {
  if (typeof value !== 'string' || value.trim() === '') return ''
  const locale = value.trim().toLowerCase().split(/[-_]/)[0]
  return locale === 'ua' ? 'uk' : locale
}

export function detectSupportedLocale(supportedLocales = SITE_LOCALES, languages) {
  const candidates = Array.isArray(languages)
    ? languages
    : [...(globalThis.navigator?.languages ?? []), globalThis.navigator?.language]
  for (const candidate of candidates) {
    const locale = normalizeLocale(candidate)
    if (supportedLocales.includes(locale)) return locale
  }
  return supportedLocales.includes(DEFAULT_LOCALE) ? DEFAULT_LOCALE : supportedLocales[0] ?? DEFAULT_LOCALE
}

export function readPersistedLocale(storageKey, storage = globalThis.localStorage) {
  try {
    return normalizeLocale(storage?.getItem(storageKey))
  } catch {
    return ''
  }
}

export function persistLocale(locale, storageKey, storage = globalThis.localStorage) {
  const normalized = normalizeLocale(locale)
  if (!SITE_LOCALES.includes(normalized)) return false
  try {
    storage?.setItem(storageKey, normalized)
    return true
  } catch {
    return false
  }
}

export function resolveSiteLocale({ supportedLocales = SITE_LOCALES, persistedLocale = '', languages } = {}) {
  const saved = normalizeLocale(persistedLocale)
  if (supportedLocales.includes(saved)) return saved
  return detectSupportedLocale(supportedLocales, languages)
}

export function getRouteLocale(pathname, supportedLocales = SITE_LOCALES) {
  const candidate = normalizeLocale(String(pathname ?? '').split('/').filter(Boolean)[0])
  return supportedLocales.includes(candidate) ? candidate : ''
}

export function localizeRoute(pathname, locale, supportedLocales = SITE_LOCALES) {
  const target = supportedLocales.includes(normalizeLocale(locale)) ? normalizeLocale(locale) : DEFAULT_LOCALE
  const parts = String(pathname || '/').split('/').filter(Boolean)
  if (parts.length && supportedLocales.includes(normalizeLocale(parts[0]))) parts[0] = target
  else parts.unshift(target)
  return `/${parts.join('/')}${parts.length ? '/' : ''}`
}

export function resolveDocumentLocale(document, { siteLocale = '', persistedLocale = '', languages } = {}) {
  const available = Object.keys(document.files)
  for (const candidate of [siteLocale, persistedLocale]) {
    const locale = normalizeLocale(candidate)
    if (locale) return available.includes(locale) ? locale : DEFAULT_LOCALE
  }
  return detectSupportedLocale(available, languages)
}

export function getLocalizedDocumentUrl(document, options = {}) {
  const locale = resolveDocumentLocale(document, options)
  return document.files[locale] ?? document.files[DEFAULT_LOCALE]
}
