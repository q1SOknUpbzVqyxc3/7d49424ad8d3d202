import { useEffect, useState } from 'react'
import { Seo } from './components/Seo'
import { notFoundRoute, routes } from './config/routes'
import { siteConfig } from './config/site'
import { useLocale } from './hooks/useLocale'
import { getRouteLocale, readPersistedLocale, resolveSiteLocale } from './utils/locale'
import './styles/main.css'
import './styles/documents.css'

const pageModules = import.meta.glob('./pages/*.jsx')

function currentRoute() {
  const path = window.location.pathname
  if (path === '/404.html') return '/404'
  if (path === '/') return '/'
  return path.endsWith('/') ? path : `${path}/`
}

export default function App() {
  const route = currentRoute()
  const routeLocale = getRouteLocale(route)
  const definition = routes[route] ?? notFoundRoute(routeLocale || 'en')
  const { locale, selectLocale } = useLocale(definition.route)
  const [Page, setPage] = useState(null)

  useEffect(() => {
    if (route === '/') {
      const selected = resolveSiteLocale({ persistedLocale: readPersistedLocale(siteConfig.localeStorageKey) })
      window.location.replace(`/${selected}/`)
      return
    }
    let active = true
    pageModules[`./pages/${definition.component}`]().then((module) => {
      if (active) setPage(() => module.default)
    })
    return () => { active = false }
  }, [definition.component, route])

  useEffect(() => {
    if (!Page || definition.component !== 'HomePage.jsx') return
    void import('./legacy/site.js')
  }, [Page, definition.component])

  if (route === '/' || !Page) return null

  return (
    <>
      <Seo locale={definition.locale} contentLocale={definition.contentLocale} seo={definition.seo} />
      <Page locale={locale} selectLocale={selectLocale} />
    </>
  )
}
