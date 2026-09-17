import { documents } from '../config/documents'
import { getLocalizedDocumentUrl } from '../utils/locale'

export function DocumentLinks() {
  return (
    <nav className="footer__docs" aria-label="Юридические документы">
      {documents.map((document) => (
        <a key={document.id} href={getLocalizedDocumentUrl(document)} target="_blank" rel="noopener noreferrer">
          {document.label}
        </a>
      ))}
    </nav>
  )
}
