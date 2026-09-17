# arbi

Static multilingual marketing site. Plain HTML, CSS and JavaScript — no build
step, no package manager, no framework. Files are served as they sit on disk.

Layout: one directory per locale (`ru/`, `en/`, `es/`, `cs/`, `uk/`), each
mirroring the same page structure (`about/`, `careers/`, `contact/`,
`insights/`, `legal/`, `results/`, `services/`). Shared CSS, JS, images and
Open Graph cards live in `assets/`. `sitemap.xml`, `robots.txt` and `_headers`
sit at the root.

A change to one locale usually needs the same change in the other four.

## Agent skills

### Issue tracker

Issues and specs live as markdown files under `.scratch/<feature-slug>/` in
this repo — there is no remote issue tracker. See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical triage roles, each label string equal to its name:
`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`.
See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` and `docs/adr/` at the repo root, both created
lazily by `/domain-modeling` when terms or decisions actually get resolved.
See `docs/agents/domain.md`.
