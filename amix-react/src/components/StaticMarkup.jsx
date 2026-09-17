import parse from 'html-react-parser'

export function StaticMarkup({ html }) {
  return parse(html)
}
