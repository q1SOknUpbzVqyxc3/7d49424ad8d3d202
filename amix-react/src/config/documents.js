const files = (slug) => Object.fromEntries(
  ['be', 'de', 'en', 'es', 'fr', 'kk', 'pl', 'ru', 'uk'].map((locale) => [
    locale,
    `/documents/${slug}/${locale}.pdf`
  ])
)

export const documents = [
  { id: 'privacy-policy', label: 'Политика конфиденциальности', files: files('privacy-policy') },
  { id: 'cookie-policy', label: 'Политика cookie', files: files('cookie-policy') },
  { id: 'risk-notice', label: 'Уведомление о рисках', files: files('risk-notice') },
  { id: 'terms-of-use', label: 'Условия использования', files: files('terms-of-use') }
]
