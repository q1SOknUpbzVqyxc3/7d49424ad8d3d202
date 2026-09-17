#!/usr/bin/env bash
# ==========================================================================
#  Put the site on the server.
#
#  The site is files. Deploying it is copying those files and nothing else --
#  there is no build step, no package manager and no framework, and this script
#  is deliberately as dumb as the site is.
#
#  Usage:
#    tools/deploy.sh              # copy the site up and verify it answers
#    tools/deploy.sh --dry        # list what would be sent, send nothing
#
#  Reads the exclusion list from .assetsignore, the same file Cloudflare used,
#  so there is one answer to "what must never be public" rather than two that
#  can drift. Adding a new internal file means editing that file only.
# ==========================================================================
set -euo pipefail

HOST="${IRONVANE_HOST:-144.31.221.179}"          # where to copy the files
SITE="${IRONVANE_SITE:-ironvane-media.com}"      # the name the site answers to
USER="${IRONVANE_USER:-root}"
KEY="${IRONVANE_KEY:-$HOME/.ssh/ironvane_ed25519}"
DEST="/var/www/ironvane-media"

# Verify through the real hostname, with resolution pinned to the box we just
# copied to. Two reasons it is not simply http://$HOST: nginx answers 404 to a
# Host it does not serve, so probing the bare IP tests nothing and reports
# failure on a healthy site; and pinning means the check cannot be fooled by a
# stale local DNS cache, or silently pass against some other machine the name
# happens to point at.
PIN="--resolve $SITE:443:$HOST --resolve $SITE:80:$HOST"

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO"

DRY=0
[ "${1:-}" = "--dry" ] && DRY=1

[ -f "$KEY" ] || { echo "deploy: no SSH key at $KEY" >&2; exit 1; }
[ -f .assetsignore ] || { echo "deploy: .assetsignore is missing -- refusing to guess what is internal" >&2; exit 1; }

# Every non-comment, non-blank line of .assetsignore becomes a tar exclusion.
# Patterns ending in /** are redundant once the directory itself is excluded.
EXCLUDES=()
while IFS= read -r line; do
  line="${line%%#*}"
  line="$(echo "$line" | tr -d '[:space:]')"
  [ -z "$line" ] && continue
  case "$line" in */\*\*) continue ;; esac
  EXCLUDES+=( "--exclude=./$line" )
done < .assetsignore

# .assetsignore already names .git and .gitignore; add them only if a future
# edit to that file drops them, and never twice.
for extra in .git .gitignore; do
  printf '%s\n' "${EXCLUDES[@]}" | grep -qxF -- "--exclude=./$extra" || EXCLUDES+=( "--exclude=./$extra" )
done

if [ "$DRY" = 1 ]; then
  echo "Would exclude:"
  printf '  %s\n' "${EXCLUDES[@]#--exclude=./}"
  echo
  echo "Would send $(tar -czf - "${EXCLUDES[@]}" . 2>/dev/null | wc -c) bytes compressed"
  exit 0
fi

echo "Sending the site to $USER@$HOST:$DEST"

# Unpacked into a sibling directory and swapped in, so a transfer that dies
# half way cannot leave visitors looking at half a site. The swap is two
# renames; the window where neither exists is microseconds.
tar -czf - "${EXCLUDES[@]}" . 2>/dev/null | \
ssh -i "$KEY" -o BatchMode=yes -o IdentitiesOnly=yes "$USER@$HOST" \
  "set -e
   rm -rf ${DEST}.new
   mkdir -p ${DEST}.new
   tar -xzf - -C ${DEST}.new
   chown -R www-data:www-data ${DEST}.new
   find ${DEST}.new -type d -exec chmod 755 {} +
   find ${DEST}.new -type f -exec chmod 644 {} +
   rm -rf ${DEST}.old
   [ -d ${DEST} ] && mv ${DEST} ${DEST}.old
   mv ${DEST}.new ${DEST}
   rm -rf ${DEST}.old
   echo \"  \$(find ${DEST} -type f | wc -l) files, \$(du -sh ${DEST} | cut -f1)\""

echo
echo "Verifying https://$SITE"

failed=0
check() {  # path, expected status
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 $PIN "https://$SITE$1" || echo "---")
  if [ "$code" = "$2" ]; then
    printf '  %-16s %s\n' "$1" "$code"
  else
    printf '  %-16s %s  EXPECTED %s\n' "$1" "$code" "$2"
    failed=$((failed + 1))
  fi
}

for path in / /ru/ /en/ /es/ /cs/ /uk/ /sitemap.xml; do check "$path" 200; done

# A miss must be a 404, not the language redirect: "single page application"
# handling would answer every typo with the homepage.
check /no-such-page/ 404

echo
if [ "$failed" -gt 0 ]; then
  echo "FAILED: $failed of 8 checks. The files are on the server; something else is wrong." >&2
  echo "Look at nginx and the certificate before deploying again -- see docs/server.md." >&2
  exit 1
fi

echo "All 8 checks passed. A deploy does not touch nginx, PHP or the certificate -- only the files."
