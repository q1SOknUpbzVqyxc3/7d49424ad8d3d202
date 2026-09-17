import { documents } from '../config/documents'
import { siteConfig } from '../config/site'
import { getLocalizedDocumentUrl } from '../utils/locale'
import { readPersistedLocale } from '../utils/locale'

export function DocumentLinks({ pageLocale }) {
  const persistedLocale = readPersistedLocale(siteConfig.localeStorageKey)
  return (
    <nav className="footer__docs" aria-label="Юридические документы">
      {documents.map((document) => (
        <a key={document.id} href={getLocalizedDocumentUrl(document, { siteLocale: pageLocale, persistedLocale })} target="_blank" rel="noopener noreferrer">
          {document.labels[pageLocale] ?? document.labels.en}
        </a>
      ))}
    </nav>
  )
}
