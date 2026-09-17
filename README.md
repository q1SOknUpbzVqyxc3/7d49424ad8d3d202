# AMIX TEAM and Ironwane Media

This repository contains two production projects built to the same React and Vite standard:

- `amix-react` - the AMIX TEAM landing page.
- `ironwane-react` - the multilingual Ironwane Media site and its FastAPI lead endpoint.

Each project has its own installation, build, document, and deployment instructions in its local README.

## Git workflow

- `stock` preserves the unmodified source sites and document folders.
- `dev` contains reviewed development commits.
- `main` contains the validated release.

## Requirements

- Node.js 20 or newer
- npm 10 or newer
- Python 3.10 or newer for the Ironwane backend

## Build both frontends

```bash
npm ci --prefix amix-react
npm run build --prefix amix-react
npm ci --prefix ironwane-react
npm run build --prefix ironwane-react
```
