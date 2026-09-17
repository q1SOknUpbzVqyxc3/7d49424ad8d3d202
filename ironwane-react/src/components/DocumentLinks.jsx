import { documents } from '../config/documents'
import { siteConfig } from '../config/site'
import { getLocalizedDocumentUrl, readPersistedLocale } from '../utils/locale'

export function DocumentLinks({ pageLocale }) {
  const persistedLocale = readPersistedLocale(siteConfig.localeStorageKey)
  return (
    <nav className="footer__docs" aria-label="Legal documents">
      {documents.map((document) => (
        <a className="footer__link" key={document.id} href={getLocalizedDocumentUrl(document, { siteLocale: pageLocale, persistedLocale })} target="_blank" rel="noopener noreferrer">
          {document.labels[pageLocale] ?? document.labels.en}
        </a>
      ))}
    </nav>
  )
}
