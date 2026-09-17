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

Configure the backend from `backend/.env.example` through process environment variables. `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` are required. Lead archives default to `/var/lib/ironvane/leads.jsonl` and must be writable by the service account.

## Structure

- `src/components` contains shared shell, SEO, and document components.
- `src/config` contains runtime and document configuration.
- `src/content/pages` contains route-level multilingual content chunks.
- `src/styles` contains the preserved visual system.
- `src/utils` contains locale selection.
- `public/assets` contains favicons and Open Graph images.
- `public/documents` contains three legal document types in nine languages.
- `backend/app` contains the FastAPI endpoint, schemas, services, and configuration.

## Documents and locale fallback

Footer document links inspect `navigator.languages` and `navigator.language` independently from the displayed site language. Supported locales open the matching PDF. Unknown, empty, or unavailable locales open English. Ukrainian documents use `uk`.

## Production routing

Serve `dist/` as static files and proxy `/api/lead` to FastAPI. Route HTML files are generated during `npm run build`, so direct requests such as `/en/about/` do not require an SPA fallback.
