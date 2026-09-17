import { LanguageSwitcher } from '../components/LanguageSwitcher'
import { LeadForm } from '../components/LeadForm'
import { SiteFooter } from '../components/SiteFooter'
import { StaticMarkup } from '../components/StaticMarkup'

export default function HomePage({ locale, page, selectLocale }) {
  return (
    <>
      <StaticMarkup html={page.chrome} />
      <StaticMarkup html={page.header} />
      <LanguageSwitcher locale={locale} onSelect={selectLocale} />
      <main id="top">
        {page.sections.map((section, index) => <StaticMarkup html={section} key={index} />)}
        <LeadForm locale={locale} />
      </main>
      <SiteFooter html={page.footer} pageLocale={locale} />
    </>
  )
}
