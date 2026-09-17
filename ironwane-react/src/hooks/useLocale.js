import { useEffect } from 'react'
import { siteConfig } from '../config/site'
import { getRouteLocale, localizeRoute, persistLocale, SITE_LOCALES } from '../utils/locale'

export function useLocale(pathname = globalThis.location?.pathname ?? '/', refreshToken = '') {
  const locale = getRouteLocale(pathname) || 'en'

  useEffect(() => {
    const listeners = []
    document.querySelectorAll('[data-lang]').forEach((link) => {
      const handler = () => persistLocale(link.dataset.lang, siteConfig.localeStorageKey)
      link.addEventListener('click', handler)
      listeners.push([link, handler])
    })
    return () => listeners.forEach(([link, handler]) => link.removeEventListener('click', handler))
  }, [pathname, refreshToken])

  const selectLocale = (nextLocale) => {
    if (!SITE_LOCALES.includes(nextLocale)) return
    persistLocale(nextLocale, siteConfig.localeStorageKey)
    globalThis.location.assign(localizeRoute(pathname, nextLocale))
  }

  return { locale, selectLocale }
}
