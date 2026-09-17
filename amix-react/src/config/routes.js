import { siteConfig } from './site.js'
import { SITE_LOCALES } from '../utils/locale.js'

const seoContent = {
  en: {
    title: 'AMIX TEAM — trading team, bot and session reviews',
    description: 'AMIX TEAM is a crypto and currency trading team with risk-managed signals, bot notifications and daily session reviews.'
  },
  ru: {
    title: 'AMIX TEAM — торговая команда, бот и разборы сессий',
    description: 'AMIX TEAM — торговая команда по крипте и валютам. Сигналы с риск-менеджментом, бот с уведомлениями и ежедневные разборы торговых сессий.'
  },
  uk: {
    title: 'AMIX TEAM — торгова команда, бот і розбори сесій',
    description: 'AMIX TEAM — команда з торгівлі криптовалютами й валютами: сигнали з ризик-менеджментом, сповіщення бота та щоденні розбори сесій.'
  },
  es: {
    title: 'AMIX TEAM — equipo de trading, bot y análisis de sesiones',
    description: 'AMIX TEAM es un equipo de trading de criptomonedas y divisas con señales gestionadas por riesgo, alertas y análisis diarios.'
  },
  cs: {
    title: 'AMIX TEAM — obchodní tým, bot a rozbory seancí',
    description: 'AMIX TEAM je tým pro obchodování kryptoměn a měn se signály řízenými podle rizika, upozorněními a denními rozbory seancí.'
  }
}

function seoForLocale(locale) {
  const route = `/${locale}/`
  const content = seoContent[locale]
  return {
    title: content.title,
    meta: [
      { name: 'description', content: content.description },
      { name: 'robots', content: 'index, follow' },
      { property: 'og:type', content: 'website' },
      { property: 'og:site_name', content: siteConfig.name },
      { property: 'og:title', content: content.title },
      { property: 'og:description', content: content.description },
      { property: 'og:url', content: `${siteConfig.origin}${route}` },
      { property: 'og:image', content: `${siteConfig.origin}/assets/og.svg` },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: content.title },
      { name: 'twitter:description', content: content.description },
      { name: 'twitter:image', content: `${siteConfig.origin}/assets/og.svg` }
    ],
    links: [
      { rel: 'canonical', href: `${siteConfig.origin}${route}` },
      ...SITE_LOCALES.map((item) => ({ rel: 'alternate', href: `${siteConfig.origin}/${item}/`, hreflang: item })),
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
  { route: `/${locale}/`, locale, contentLocale: locale, content: `${locale}.json`, component: 'HomePage.jsx', seo: seoForLocale(locale) }
]))

export function notFoundRoute(locale = 'en') {
  const route = `/${locale}/404/`
  const descriptions = {
    en: 'The requested page could not be found.',
    ru: 'Запрошенная страница не найдена.',
    uk: 'Запитану сторінку не знайдено.',
    es: 'No se ha encontrado la página solicitada.',
    cs: 'Požadovaná stránka nebyla nalezena.'
  }
  return {
    route,
    locale,
    contentLocale: locale,
    content: `${locale}.json`,
    component: 'NotFoundPage.jsx',
    seo: {
      title: `404 — ${siteConfig.name}`,
      meta: [
        { name: 'description', content: descriptions[locale] ?? descriptions.en },
        { name: 'robots', content: 'noindex, follow' }
      ],
      links: [{ rel: 'canonical', href: `${siteConfig.origin}${route}` }],
      structuredData: []
    }
  }
}
