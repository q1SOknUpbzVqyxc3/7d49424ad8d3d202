import { useEffect } from 'react'

export function Seo({ locale, contentLocale = locale, seo }) {
  useEffect(() => {
    document.documentElement.lang = contentLocale
    document.title = seo.title
    const nodes = []
    for (const definition of seo.meta) {
      const node = document.createElement('meta')
      for (const [key, value] of Object.entries(definition)) node.setAttribute(key, value)
      node.dataset.reactSeo = 'true'
      document.head.append(node)
      nodes.push(node)
    }
    for (const definition of seo.links) {
      const node = document.createElement('link')
      for (const [key, value] of Object.entries(definition)) node.setAttribute(key, value)
      node.dataset.reactSeo = 'true'
      document.head.append(node)
      nodes.push(node)
    }
    for (const value of seo.structuredData) {
      const node = document.createElement('script')
      node.type = 'application/ld+json'
      node.textContent = value
      node.dataset.reactSeo = 'true'
      document.head.append(node)
      nodes.push(node)
    }
    return () => nodes.forEach((node) => node.remove())
  }, [contentLocale, locale, seo])

  return null
}
