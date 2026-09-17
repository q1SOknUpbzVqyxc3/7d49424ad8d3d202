import { readFile, mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dist = path.join(root, 'dist')
const source = await readFile(path.join(dist, 'index.html'), 'utf8')
const index = JSON.parse(await readFile(path.join(root, 'src/content/route-index.json'), 'utf8'))

const escape = (value) => String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')

for (const [route, filename] of Object.entries(index)) {
  const page = JSON.parse(await readFile(path.join(root, 'src/content/pages', filename), 'utf8'))
  const tags = [
    ...page.seo.meta.map((item) => `<meta ${Object.entries(item).map(([key, value]) => `${key}="${escape(value)}"`).join(' ')}>`),
    ...page.seo.links.map((item) => `<link ${Object.entries(item).map(([key, value]) => `${key}="${escape(value)}"`).join(' ')}>`),
    ...page.seo.structuredData.map((value) => `<script type="application/ld+json">${value.replaceAll('</script>', '<\\/script>')}</script>`)
  ].join('')
  const html = source
    .replace('<html lang="en">', `<html lang="${escape(page.locale)}">`)
    .replace(/<title>[^<]*<\/title>/, `<title>${escape(page.seo.title)}</title>`)
    .replace('</head>', `${tags}</head>`)
  const output = route === '/404' ? path.join(dist, '404.html') : path.join(dist, route.slice(1), 'index.html')
  await mkdir(path.dirname(output), { recursive: true })
  await writeFile(output, html)
}
