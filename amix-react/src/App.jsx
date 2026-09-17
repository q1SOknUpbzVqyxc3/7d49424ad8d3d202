import { useEffect } from 'react'
import page from './content/page.json'
import { SiteFooter } from './components/SiteFooter'
import { StaticMarkup } from './components/StaticMarkup'
import './styles/main.css'
import './styles/documents.css'

export default function App() {
  useEffect(() => {
    void import('./legacy/site.js')
  }, [])

  return (
    <>
      <StaticMarkup html={page.chrome} />
      <StaticMarkup html={page.header} />
      <main id="top">
        {page.sections.map((section, index) => <StaticMarkup html={section} key={index} />)}
      </main>
      <SiteFooter html={page.footer} />
    </>
  )
}
