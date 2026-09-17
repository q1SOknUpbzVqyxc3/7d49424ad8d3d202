import { Seo } from '../components/Seo'
import { SiteFooter } from '../components/SiteFooter'
import { StaticMarkup } from '../components/StaticMarkup'

export function RoutePage({ page, locale }) {
  return (
    <>
      <Seo locale={page.locale} seo={page.seo} />
      <StaticMarkup html={page.pre} />
      <StaticMarkup html={page.header} />
      <StaticMarkup html={page.between} />
      <main id="main"><StaticMarkup html={page.main} /></main>
      <SiteFooter html={page.footer} pageLocale={locale} />
      <StaticMarkup html={page.post} />
    </>
  )
}
