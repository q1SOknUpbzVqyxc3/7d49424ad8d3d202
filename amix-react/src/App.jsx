import { useEffect, useState } from 'react'
import { Seo } from './components/Seo'
import { notFoundRoute, routes } from './config/routes'
import { siteConfig } from './config/site'
import { useLocale } from './hooks/useLocale'
import { getRouteLocale, readPersistedLocale, resolveSiteLocale } from './utils/locale'
import { localizeLegacyContent } from './utils/localizeLegacyContent'
import './styles/main.css'
import './styles/documents.css'

const pageModules = import.meta.glob('./pages/*.jsx')
const contentModules = import.meta.glob('./content/pages/*.json')

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
  const [content, setContent] = useState(null)

  useEffect(() => {
    if (route === '/') {
      const selected = resolveSiteLocale({ persistedLocale: readPersistedLocale(siteConfig.localeStorageKey) })
      window.location.replace(`/${selected}/`)
      return
    }
    let active = true
    Promise.all([
      pageModules[`./pages/${definition.component}`](),
      definition.content ? contentModules[`./content/pages/${definition.content}`]() : Promise.resolve({ default: null })
    ]).then(([pageModule, contentModule]) => {
      if (active) {
        setPage(() => pageModule.default)
        setContent(contentModule.default)
      }
    })
    return () => { active = false }
  }, [definition.component, definition.content, route])

  useEffect(() => {
    if (!Page || definition.component !== 'HomePage.jsx') return
    void import('./legacy/site.js').then(() => localizeLegacyContent(definition.locale))
  }, [Page, definition.component, definition.locale])

  if (route === '/' || !Page || (definition.content && !content)) return null

  return (
    <>
      <Seo locale={definition.locale} contentLocale={definition.contentLocale} seo={definition.seo} />
      <Page locale={locale} page={content} selectLocale={selectLocale} />
    </>
  )
}
