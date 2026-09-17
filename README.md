# AMIX TEAM and Ironwane Media

This repository contains two production projects built to the same React and Vite standard:

- `amix-react` - the localized AMIX TEAM landing, SEO/prerender infrastructure, and FastAPI lead endpoint.
- `ironwane-react` - the multilingual Ironwane Media site, SEO/prerender infrastructure, and FastAPI lead endpoint.

Each project has its own installation, build, document, and deployment instructions in its local README.

## Git workflow

- `stock` preserves the unmodified source sites and document folders.
- `dev` contains reviewed development commits.
- `main` contains the validated release.

## Requirements

- Node.js 20 or newer
- npm 10 or newer
- Python 3.10 or newer for both FastAPI backends

## Build both frontends

```bash
npm ci --prefix amix-react
npm run build --prefix amix-react
npm ci --prefix ironwane-react
npm run build --prefix ironwane-react
```

Both projects use the same locale priority, legal-document fallback, backend layout, `/api/lead` contract, `/health` endpoint, Vite proxy, security-header format, and validation command. AMIX retains its original Russian content and visual design; untranslated locale routes use the Russian content fallback without claiming translated SEO coverage.
