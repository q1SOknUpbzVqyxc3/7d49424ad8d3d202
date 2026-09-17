import page from '../content/page.json'
import { LanguageSwitcher } from '../components/LanguageSwitcher'
import { SiteFooter } from '../components/SiteFooter'
import { StaticMarkup } from '../components/StaticMarkup'

const messages = {
  en: ['Page not found', 'Return home'],
  ru: ['Страница не найдена', 'Вернуться на главную'],
  uk: ['Сторінку не знайдено', 'Повернутися на головну'],
  es: ['Página no encontrada', 'Volver al inicio'],
  cs: ['Stránka nebyla nalezena', 'Zpět na hlavní stránku']
}

export default function NotFoundPage({ locale, selectLocale }) {
  const [heading, action] = messages[locale] ?? messages.en
  const header = `<header class="nav" id="nav"><div class="wrap nav__in"><a class="nav__logo" href="/${locale}/"><span class="chrome" data-text="AMIX">AMIX</span></a></div></header>`
  return (
    <>
      <StaticMarkup html={page.chrome} />
      <StaticMarkup html={header} />
      <LanguageSwitcher locale={locale} onSelect={selectLocale} />
      <main id="top" className="not-found">
        <div className="wrap not-found__inner">
          <div className="eyebrow eyebrow--center">404</div>
          <h1 className="h2">{heading}</h1>
          <a className="btn btn--primary" href={`/${locale}/`}>{action}</a>
        </div>
      </main>
      <SiteFooter html={page.footer} pageLocale={locale} />
    </>
  )
}
