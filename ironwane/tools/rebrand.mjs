#!/usr/bin/env node
/* ==========================================================================
   Rename the team.

   The site is 125 hand-written pages with the brand baked into every one of
   them: titles, og tags, canonical and hreflang links, JSON-LD, the wordmark,
   two email addresses, a Telegram handle, SVG gradient ids and localStorage
   keys. This script turns changing all of that into one command.

   Usage:
     node tools/rebrand.mjs --name "New Name" --domain newdomain.com \
       --telegram newhandle --prefix nn [--short "New"] [--tagline "..."] \
       [--email-general hi] [--email-careers jobs] [--dry]

   Reads the current values from brand.json, so it always knows what it is
   replacing. Writes brand.json back at the end, so the next rename starts
   from the truth.
   ========================================================================== */

import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, extname, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/* ------------------------------------------------------------------ Files */
/* An explicit allowlist, not a walk of the repository root. The specs in
   .scratch/ and the notes in docs/ quote the old name on purpose, as the
   record of why things are the way they are -- rewriting them would erase
   exactly the history that makes them worth keeping. */

const ROOT_FILES = ["index.html", "404.html", "robots.txt", "sitemap.xml", "_headers"];
const TREES = [
  { dir: "assets", exts: [".css", ".js", ".webmanifest"] },
  { dir: "ru", exts: [".html", ".xml"] },
  { dir: "en", exts: [".html", ".xml"] },
  { dir: "uk", exts: [".html", ".xml"] },
  { dir: "es", exts: [".html", ".xml"] },
  { dir: "cs", exts: [".html", ".xml"] }
];

function collect() {
  const out = [];
  for (const name of ROOT_FILES) {
    const p = join(ROOT, name);
    try { if (statSync(p).isFile()) out.push(p); } catch { /* absent is fine */ }
  }
  for (const { dir, exts } of TREES) {
    let entries;
    try { entries = readdirSync(join(ROOT, dir), { recursive: true }); }
    catch { continue; }
    for (const rel of entries) {
      const p = join(ROOT, dir, rel);
      if (!exts.includes(extname(p))) continue;
      try { if (statSync(p).isFile()) out.push(p); } catch { /* skip */ }
    }
  }
  return out;
}

/* ------------------------------------------------------------------- Args */

function parseArgs(argv) {
  const out = { dry: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry") { out.dry = true; continue; }
    if (!a.startsWith("--")) die(`Unexpected argument: ${a}`);
    const key = a.slice(2);
    const value = argv[++i];
    if (value === undefined || value.startsWith("--")) die(`${a} needs a value`);
    out[key] = value;
  }
  return out;
}

function die(msg) {
  console.error("rebrand: " + msg);
  process.exit(1);
}

/* --------------------------------------------------------------- Validate */
/* Every one of these lands in 125 files at once, so they are checked before
   anything is written rather than discovered afterwards in a diff. */

function validate(a) {
  if (!a.name || !a.name.trim()) die("--name is required and cannot be blank");
  if (!/^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/i.test(a.domain || "")) {
    die("--domain must be a bare hostname, e.g. example.com (no protocol, no path)");
  }
  if (!/^[A-Za-z0-9_]{5,32}$/.test(a.telegram || "")) {
    die("--telegram must be a Telegram username: 5-32 chars, letters, digits, underscore");
  }
  /* The prefix becomes an SVG element id and a localStorage key, so it has to
     be a plain identifier -- a leading digit or a hyphen produces markup that
     silently fails to match its own url(#...) reference. */
  if (!/^[a-z][a-z0-9]*$/i.test(a.prefix || "")) {
    die("--prefix must start with a letter and contain only letters and digits");
  }
  for (const [flag, val] of [["--email-general", a["email-general"]], ["--email-careers", a["email-careers"]]]) {
    if (val !== undefined && !/^[a-z0-9._%+-]+$/i.test(val)) {
      die(`${flag} must be the local part of an address, without @ or domain`);
    }
  }
}

/* ----------------------------------------------------------------- Patterns */
/* One combined expression, alternatives sorted longest first, applied in a
   single pass. Sequential passes are wrong here, and not subtly:

     "syndicatebuiltads" is a prefix of "syndicatebuiltads.com", so replacing
     the handle first rewrites 876 links to a domain that does not exist.

     "Syndicate" is a prefix of "Syndicate Built Ads", so replacing the short
     name first shreds every title on the site.

   A single pass over a longest-first alternation cannot make either mistake:
   the regex engine consumes each match whole and never revisits it.

   Note what is deliberately NOT a pattern: the bare prefix "sba". It occurs
   inside the word "progressbar" (assets/js/main.js), and a bare-prefix rule
   would quietly corrupt it. Only the specific tokens are listed. */

function buildMap(old, next) {
  const pairs = [];
  const add = (from, to) => { if (from && from !== to) pairs.push([from, to]); };

  const oldGeneral = `${old.emails.general}@${old.domain}`;
  const oldCareers = `${old.emails.careers}@${old.domain}`;
  add(oldGeneral, `${next.emails.general}@${next.domain}`);
  add(oldCareers, `${next.emails.careers}@${next.domain}`);

  add(old.domain, next.domain);
  add(old.telegram, next.telegram);

  add(old.name, next.name);
  add(old.shortName, next.shortName);

  if (next.tagline !== old.tagline) add(old.tagline, next.tagline);

  add(`${old.prefix}Marka`, `${next.prefix}Marka`);
  add(`${old.prefix}Markf`, `${next.prefix}Markf`);
  add(`${old.prefix}-motion`, `${next.prefix}-motion`);
  add(`${old.prefix}-lang`, `${next.prefix}-lang`);
  add(`[${old.prefix}]`, `[${next.prefix}]`);

  pairs.sort((x, y) => y[0].length - x[0].length);
  return new Map(pairs);
}

const escapeRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/* ------------------------------------------------------------------- Main */

const args = parseArgs(process.argv.slice(2));
const brandPath = join(ROOT, "brand.json");

let old;
try { old = JSON.parse(readFileSync(brandPath, "utf8")); }
catch (e) { die(`cannot read brand.json: ${e.message}`); }

validate(args);

const next = {
  name: args.name,
  shortName: args.short || args.name.trim().split(/\s+/)[0],
  tagline: args.tagline !== undefined ? args.tagline : old.tagline,
  domain: args.domain,
  emails: {
    general: args["email-general"] || old.emails.general,
    careers: args["email-careers"] || old.emails.careers
  },
  telegram: args.telegram,
  prefix: args.prefix
};

/* A clean tree is the safety net. This rewrites 125 files in one go, and the
   only practical review is `git diff` -- which is useless if unrelated edits
   are already sitting in it, and `git checkout .` stops being a safe undo. */
if (!args.dry) {
  let status = "";
  try { status = execFileSync("git", ["status", "--porcelain"], { cwd: ROOT, encoding: "utf8" }); }
  catch { die("not a git repository, or git is unavailable"); }
  if (status.trim()) {
    die("working tree is not clean. Commit or stash first, or use --dry to preview.");
  }
}

const map = buildMap(old, next);
if (map.size === 0) die("nothing to change: the new brand matches the current one");

const re = new RegExp([...map.keys()].map(escapeRe).join("|"), "g");

const counts = new Map([...map.keys()].map(k => [k, 0]));
const files = collect();
let touched = 0;

for (const file of files) {
  const before = readFileSync(file, "utf8");
  /* A function replacer, not a string one: a replacement containing $& or $1
     would otherwise be interpreted instead of inserted. */
  const after = before.replace(re, m => { counts.set(m, counts.get(m) + 1); return map.get(m); });
  if (after === before) continue;
  touched++;
  if (!args.dry) writeFileSync(file, after);
}

if (!args.dry) {
  writeFileSync(brandPath, JSON.stringify(next, null, 2) + "\n");
}

/* ----------------------------------------------------------------- Report */

const width = Math.max(...[...map.keys()].map(k => k.length));
console.log(args.dry ? "\nDRY RUN -- nothing written\n" : "\nRebranded\n");
for (const [from, to] of map) {
  console.log(`  ${from.padEnd(width)}  ->  ${to}   (${counts.get(from)})`);
}
const total = [...counts.values()].reduce((a, b) => a + b, 0);
console.log(`\n  ${total} replacements in ${touched} of ${files.length} files`);
console.log(args.dry ? "" : "  brand.json updated. Review with: git diff --stat\n");
