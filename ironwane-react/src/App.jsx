import { useEffect, useState } from 'react'
import routeIndex from './content/route-index.json'
import { Seo } from './components/Seo'
import { SiteFooter } from './components/SiteFooter'
import { StaticMarkup } from './components/StaticMarkup'
import { getLeadEndpoint } from './config/runtime'
import { detectSupportedLocale } from './utils/locale'
import './styles/main.css'
import './styles/documents.css'

const pageModules = import.meta.glob('./content/pages/*.json')
const siteLocales = ['en', 'ru', 'uk', 'es', 'cs']

function currentRoute() {
  const path = window.location.pathname
  if (path === '/404.html') return '/404'
  if (path === '/') return '/'
  return path.endsWith('/') ? path : `${path}/`
}

export default function App() {
  const [page, setPage] = useState(null)
  const route = currentRoute()

  useEffect(() => {
    if (route === '/') {
      window.location.replace(`/${detectSupportedLocale(siteLocales)}/`)
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
    <>
      <Seo locale={page.locale} seo={page.seo} />
      <StaticMarkup html={page.pre} />
      <StaticMarkup html={page.header} />
      <StaticMarkup html={page.between} />
      <main id="main"><StaticMarkup html={page.main} /></main>
      <SiteFooter html={page.footer} pageLocale={page.locale} />
      <StaticMarkup html={page.post} />
    </>
  )
}
