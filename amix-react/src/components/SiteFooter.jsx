import parse from 'html-react-parser'
import { DocumentLinks } from './DocumentLinks'

export function SiteFooter({ html, pageLocale }) {
  return (
    <footer className="footer">
      {parse(html)}
      <div className="wrap footer__documents">
        <DocumentLinks pageLocale={pageLocale} />
      </div>
    </footer>
  )
}
