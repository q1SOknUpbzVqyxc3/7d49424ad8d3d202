# AMIX TEAM React

Production React, Vite, and FastAPI implementation of the AMIX TEAM landing page. The original layout, Russian content, responsive rules, and animations are preserved.

## Requirements

- Node.js 20+
- npm 10+
- Python 3.10+

## Commands

```bash
npm ci
npm run dev
npm run build
npm run preview
npm run check
```

The production output is written to `dist/`. The build prerenders metadata for `/en/`, `/ru/`, `/uk/`, `/es/`, `/cs/`, and `404.html`. Russian is currently the only official site-content language, so the other locale routes use that content fallback, are `noindex`, and canonicalize to `/ru/`.

## Backend

```bash
cd backend
python -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --host 127.0.0.1 --port 8000
python -m unittest discover -s tests -v
```

The existing AMIX interface remains Telegram-first and does not display a new form. The compatible backend is prepared for future or external form submissions at `POST /api/lead`; `GET /health` reports service health. Configure it through `backend/.env.example`. Archived leads default to `/var/lib/amix/leads.jsonl`.

## Structure

- `src/components` contains shared UI components.
- `src/config` contains site, route, and legal-document configuration.
- `src/hooks` contains persisted locale behavior.
- `src/pages` contains code-split home and 404 pages.
- `src/services` contains the API endpoint configuration.
- `src/content` contains the preserved landing content.
- `src/styles` contains the production CSS.
- `src/utils` contains locale selection.
- `public/documents` contains four legal document types in nine languages.

## Documents and locale fallback

The root route resolves the persisted `amix-lang` choice first, then `navigator.languages`, then `navigator.language`, with English as fallback. A manual switch preserves the equivalent route. Footer PDFs use the current site locale first, then the persisted locale, browser locales, and finally English. Ukrainian files use the browser-standard code `uk`.

## Environment

`VITE_API_BASE_URL` is optional and defaults to same-origin `/api`. Backend Telegram credentials and archive settings belong in the process environment and must not be committed.

## Production routing and validation

Serve `dist/` as static files, preserve generated route directories and `404.html`, and proxy `/api` to FastAPI. `npm run check` validates locale behavior, legal files, public assets, internal file references, sitemap content, lint, and the production build. RSS is not applicable because AMIX has no publication section.
