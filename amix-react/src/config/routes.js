import { siteConfig } from './site.js'
import { SITE_LOCALES } from '../utils/locale.js'

const description = 'AMIX TEAM — торговая команда по крипте и валютам. Сигналы с риск-менеджментом, бот с уведомлениями и ежедневные разборы торговых сессий.'
const title = 'AMIX TEAM — торговая команда, бот и разборы сессий'

function seoForLocale(locale) {
  const route = `/${locale}/`
  const canonical = `${siteConfig.origin}/ru/`
  return {
    title,
    meta: [
      { name: 'description', content: description },
      { name: 'robots', content: locale === 'ru' ? 'index, follow' : 'noindex, follow' },
      { property: 'og:type', content: 'website' },
      { property: 'og:site_name', content: siteConfig.name },
      { property: 'og:title', content: title },
      { property: 'og:description', content: description },
      { property: 'og:url', content: `${siteConfig.origin}${route}` },
      { property: 'og:image', content: `${siteConfig.origin}/assets/og.svg` },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: title },
      { name: 'twitter:description', content: description },
      { name: 'twitter:image', content: `${siteConfig.origin}/assets/og.svg` }
    ],
    links: [
      { rel: 'canonical', href: canonical },
      { rel: 'alternate', href: `${siteConfig.origin}/ru/`, hreflang: 'ru' },
      { rel: 'alternate', href: `${siteConfig.origin}/en/`, hreflang: 'x-default' }
    ],
    structuredData: [JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: siteConfig.name,
      url: siteConfig.origin,
      sameAs: ['https://t.me/amixteam']
    })]
  }
}

export const routes = Object.fromEntries(SITE_LOCALES.map((locale) => [
  `/${locale}/`,
  { route: `/${locale}/`, locale, contentLocale: 'ru', component: 'HomePage.jsx', seo: seoForLocale(locale) }
]))

export function notFoundRoute(locale = 'en') {
  const route = `/${locale}/404/`
  return {
    route,
    locale,
    contentLocale: locale,
    component: 'NotFoundPage.jsx',
    seo: {
      title: `404 — ${siteConfig.name}`,
      meta: [
        { name: 'description', content: 'Запрошенная страница не найдена.' },
        { name: 'robots', content: 'noindex, follow' }
      ],
      links: [{ rel: 'canonical', href: `${siteConfig.origin}${route}` }],
      structuredData: []
    }
  }
}
