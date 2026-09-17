const files = (slug) => Object.fromEntries(
  ['be', 'de', 'en', 'es', 'fr', 'kk', 'pl', 'ru', 'uk'].map((locale) => [
    locale,
    `/documents/${slug}/${locale}.pdf`
  ])
)

const labels = {
  en: ['Privacy Policy', 'Cookie Policy', 'Risk Notice', 'Terms of Use'],
  ru: ['Политика конфиденциальности', 'Политика cookie', 'Уведомление о рисках', 'Условия использования'],
  uk: ['Політика конфіденційності', 'Політика cookie', 'Повідомлення про ризики', 'Умови використання'],
  es: ['Política de privacidad', 'Política de cookies', 'Aviso de riesgos', 'Términos de uso'],
  cs: ['Zásady ochrany osobních údajů', 'Zásady cookies', 'Upozornění na rizika', 'Podmínky použití']
}

export const documents = [
  { id: 'privacy-policy', labels: Object.fromEntries(Object.entries(labels).map(([locale, value]) => [locale, value[0]])), files: files('privacy-policy') },
  { id: 'cookie-policy', labels: Object.fromEntries(Object.entries(labels).map(([locale, value]) => [locale, value[1]])), files: files('cookie-policy') },
  { id: 'risk-notice', labels: Object.fromEntries(Object.entries(labels).map(([locale, value]) => [locale, value[2]])), files: files('risk-notice') },
  { id: 'terms-of-use', labels: Object.fromEntries(Object.entries(labels).map(([locale, value]) => [locale, value[3]])), files: files('terms-of-use') }
]
