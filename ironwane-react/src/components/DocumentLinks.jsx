import { documents } from '../config/documents'
import { getLocalizedDocumentUrl } from '../utils/locale'

export function DocumentLinks({ pageLocale }) {
  return (
    <nav className="footer__docs" aria-label="Legal documents">
      {documents.map((document) => (
        <a className="footer__link" key={document.id} href={getLocalizedDocumentUrl(document)} target="_blank" rel="noopener noreferrer">
          {document.labels[pageLocale] ?? document.labels.en}
        </a>
      ))}
    </nav>
  )
}
