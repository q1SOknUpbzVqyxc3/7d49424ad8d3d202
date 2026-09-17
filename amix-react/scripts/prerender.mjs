import { readFile, mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { notFoundRoute, routes } from '../src/config/routes.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dist = path.join(root, 'dist')
const source = await readFile(path.join(dist, 'index.html'), 'utf8')
const definitions = [...Object.values(routes), notFoundRoute('en')]
const escape = (value) => String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')

for (const page of definitions) {
  const tags = [
    ...page.seo.meta.map((item) => `<meta ${Object.entries(item).map(([key, value]) => `${key}="${escape(value)}"`).join(' ')}>`),
    ...page.seo.links.map((item) => `<link ${Object.entries(item).map(([key, value]) => `${key}="${escape(value)}"`).join(' ')}>`),
    ...page.seo.structuredData.map((value) => `<script type="application/ld+json">${value.replaceAll('</script>', '<\\/script>')}</script>`)
  ].join('')
  const html = source
    .replace('<html lang="en">', `<html lang="${escape(page.contentLocale)}">`)
    .replace(/<title>[^<]*<\/title>/, `<title>${escape(page.seo.title)}</title>`)
    .replace('</head>', `${tags}</head>`)
  const output = page.component === 'NotFoundPage.jsx'
    ? path.join(dist, '404.html')
    : path.join(dist, page.route.slice(1), 'index.html')
  await mkdir(path.dirname(output), { recursive: true })
  await writeFile(output, html)
}
