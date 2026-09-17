import { useEffect, useState } from 'react'
import routeIndex from './content/route-index.json'
import { getLeadEndpoint } from './services/apiClient'
import { siteConfig } from './config/site'
import { useLocale } from './hooks/useLocale'
import { RoutePage } from './pages/RoutePage'
import { getRouteLocale, readPersistedLocale, resolveSiteLocale, SITE_LOCALES } from './utils/locale'
import './styles/main.css'
import './styles/documents.css'

const pageModules = import.meta.glob('./content/pages/*.json')
function currentRoute() {
  const path = window.location.pathname
  if (path === '/404.html') return '/404'
  if (path === '/') return '/'
  return path.endsWith('/') ? path : `${path}/`
}

export default function App() {
  const [page, setPage] = useState(null)
  const route = currentRoute()
  const routeLocale = getRouteLocale(route)
  useLocale(route, page?.route ?? '')

  useEffect(() => {
    if (route === '/') {
      const locale = resolveSiteLocale({
        supportedLocales: SITE_LOCALES,
        persistedLocale: readPersistedLocale(siteConfig.localeStorageKey)
      })
      window.location.replace(`/${locale}/`)
      return
    }
    const filename = routeIndex[route] ?? routeIndex['/404']
    pageModules[`./content/pages/${filename}`]().then((module) => setPage(module.default))
  }, [route])

  useEffect(() => {
    if (!page) return
    const endpoint = getLeadEndpoint()
    document.querySelectorAll('[data-endpoint]').forEach((form) => {
      form.dataset.endpoint = endpoint
      form.action = endpoint
    })
    const load = async () => {
      if (/^\/[a-z]{2}\/$/.test(page.route)) {
        await import('./legacy/land.js')
        await import('./legacy/world.js')
      }
      await import('./legacy/main.js')
    }
    void load()
  }, [page])

  if (!page) return null

  return (
    <RoutePage page={page} locale={routeLocale || page.locale} />
  )
}
