# AMIX TEAM React

Production React and Vite migration of the AMIX TEAM landing page. The original layout, content, responsive rules, and animations are preserved.

## Requirements

- Node.js 20+
- npm 10+

## Commands

```bash
npm ci
npm run dev
npm run build
npm run preview
npm run check
```

The production output is written to `dist/`.

## Structure

- `src/components` contains shared UI components.
- `src/config` contains the legal-document catalog.
- `src/content` contains the preserved landing content.
- `src/styles` contains the production CSS.
- `src/utils` contains locale selection.
- `public/documents` contains four legal document types in nine languages.

## Documents and locale fallback

Footer links inspect `navigator.languages` and `navigator.language`. A supported language opens the corresponding PDF. Unknown, empty, or unavailable locales open the English PDF. Ukrainian source documents use the standard browser language code `uk`.

## Environment

Copy `.env.example` to `.env` only when the deployment URL differs. No secrets are used by this project.
