const files = (slug) => Object.fromEntries(
  ['be', 'de', 'en', 'es', 'fr', 'kk', 'pl', 'ru', 'uk'].map((locale) => [
    locale,
    `/documents/${slug}/${locale}.pdf`
  ])
)

const labels = {
  en: ['Privacy Policy', 'Cookie Policy', 'Terms and Conditions'],
  ru: ['Политика конфиденциальности', 'Политика cookie', 'Условия использования'],
  uk: ['Політика конфіденційності', 'Політика cookie', 'Умови використання'],
  es: ['Política de privacidad', 'Política de cookies', 'Términos y condiciones'],
  cs: ['Zásady ochrany osobních údajů', 'Zásady cookies', 'Obchodní podmínky']
}

export const documents = [
  { id: 'privacy-policy', labels: Object.fromEntries(Object.entries(labels).map(([locale, value]) => [locale, value[0]])), files: files('privacy-policy') },
  { id: 'cookie-policy', labels: Object.fromEntries(Object.entries(labels).map(([locale, value]) => [locale, value[1]])), files: files('cookie-policy') },
  { id: 'terms-and-conditions', labels: Object.fromEntries(Object.entries(labels).map(([locale, value]) => [locale, value[2]])), files: files('terms-and-conditions') }
]
