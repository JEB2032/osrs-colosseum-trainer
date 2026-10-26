#!/usr/bin/env bash
# Publish the trainer to GitHub Pages: pushes the source to <user>/<repo> (main) and the built
# site to the gh-pages branch. Run from Git Bash after `gh auth login`.
# Usage: ./deploy.sh [repo-name]
set -euo pipefail

REPO_NAME="${1:-osrs-colosseum-trainer}"
ROOT="$(cd "$(dirname "$0")" && pwd)"
GH="${GH:-gh}"
export PATH="/c/Users/james/tools/node-v20.18.1-win-x64:$PATH"
export npm_config_script_shell="C:\\Program Files\\Git\\bin\\bash.exe"

OWNER="$("$GH" api user --jq .login)"
echo "Publishing to $OWNER/$REPO_NAME"

cd "$ROOT"
if ! "$GH" repo view "$OWNER/$REPO_NAME" >/dev/null 2>&1; then
  "$GH" repo create "$REPO_NAME" --public --source . --remote origin \
    --description "OSRS Fortis Colosseum wave 10/11 double-south trainer (3D, fixed mode, death replay)"
fi
git push -u origin main

# Build the static site.
cd "$ROOT/colosseum-trainer"
rm -rf dist
COMMIT_REF="$(git -C "$ROOT" rev-parse --short HEAD)" BUILD_DATE="$(date +%F)" DEPLOY_URL=./ npx webpack
touch dist/.nojekyll

# Push dist/ as the gh-pages branch.
cd dist
rm -rf .git
git init -q -b gh-pages
git add -A
git -c user.name="$(git -C "$ROOT" config user.name)" -c user.email="$(git -C "$ROOT" config user.email)" \
  commit -q -m "Deploy $(git -C "$ROOT" rev-parse --short HEAD)"
git push -f "https://github.com/$OWNER/$REPO_NAME.git" gh-pages
rm -rf .git

# Turn on Pages for the gh-pages branch (no-op if already on).
"$GH" api -X POST "repos/$OWNER/$REPO_NAME/pages" -f "source[branch]=gh-pages" -f "source[path]=/" >/dev/null 2>&1 || true
echo "Site: https://$OWNER.github.io/$REPO_NAME/"
