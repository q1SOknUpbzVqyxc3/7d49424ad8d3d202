# Ironwane Media React

Production React and Vite migration of the multilingual Ironwane Media site, with the former PHP and Cloudflare lead handler replaced by FastAPI.

## Requirements

- Node.js 20+
- npm 10+
- Python 3.10+

## Frontend

```bash
npm ci
npm run dev
npm run build
npm run preview
npm run check
```

The build creates route-specific HTML metadata and 161 code-split page routes in `dist/`. Development requests to `/api` are proxied to `http://127.0.0.1:8000`.

## Backend

```bash
cd backend
python -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Configure the backend from `backend/.env.example` through process environment variables. Lead archives default to `/var/lib/ironvane/leads.jsonl` and must be writable by the service account. If Telegram is unavailable but archival succeeds, the API accepts the lead with HTTP 202 instead of losing it. Run backend tests with `python -m unittest discover -s tests -v` from `backend/`.

## Structure

- `src/components` contains shared shell, SEO, and document components.
- `src/config` contains runtime and document configuration.
- `src/hooks` contains persisted locale behavior.
- `src/pages` contains the shared route page.
- `src/services` contains the API endpoint configuration.
- `src/content/pages` contains route-level multilingual content chunks.
- `src/styles` contains the preserved visual system.
- `src/utils` contains locale selection.
- `public/assets` contains favicons and Open Graph images.
- `public/documents` contains three legal document types in nine languages.
- `backend/app` contains the FastAPI endpoint, schemas, services, and configuration.

## Documents and locale fallback

The root route resolves the persisted `ivm-lang` choice first, then browser locales, with English as fallback. Manual language links preserve the equivalent current route and persist the choice. Footer PDFs use the current site locale first, then the persisted locale, browser locales, and finally English. Ukrainian documents use `uk`.

## Production routing

Serve `dist/` as static files and proxy `/api/lead` to FastAPI. Route HTML files are generated during `npm run build`, so direct requests such as `/en/about/` do not require an SPA fallback.

`npm run check` validates all 161 routes, localized and internal links, hreflang targets, sitemap coverage, required public assets, legal files, lint, and the production build.
