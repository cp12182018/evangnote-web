#!/bin/bash
# EvangNote Web — GitHub Setup Script
# Run this once from Terminal to push your web app to a new GitHub repo.
# Usage: bash setup-github.sh

set -e

REPO_NAME="evangnote-web"
GITHUB_USER=""   # ← fill in your GitHub username if you want to skip the prompt

# ── 1. Get GitHub username ──────────────────────────────────
if [ -z "$GITHUB_USER" ]; then
  read -p "Your GitHub username: " GITHUB_USER
fi

# ── 2. Clean up any stale git state and init fresh ─────────
cd "$(dirname "$0")"

if [ -d ".git" ]; then
  echo "Removing existing .git folder..."
  rm -rf .git
fi

git init
git branch -M main
git config user.email "chupin.study@gmail.com"
git config user.name "Pin Chu"
git add .
git commit -m "Initial commit: EvangNote web CRM app"

echo ""
echo "──────────────────────────────────────────────────"
echo "  Git repo initialized. Now create the GitHub repo."
echo "──────────────────────────────────────────────────"
echo ""
echo "  1. Go to: https://github.com/new"
echo "  2. Repository name: $REPO_NAME"
echo "  3. Keep it Public (or Private — your choice)"
echo "  4. Do NOT check 'Initialize this repository' (we'll push from here)"
echo "  5. Click 'Create repository'"
echo ""
read -p "Press Enter once you've created the repo on GitHub..."

# ── 3. Push to GitHub ───────────────────────────────────────
REMOTE="https://github.com/$GITHUB_USER/$REPO_NAME.git"

git remote add origin "$REMOTE"
git push -u origin main

echo ""
echo "✅ Done! Your repo is live at:"
echo "   https://github.com/$GITHUB_USER/$REPO_NAME"
echo ""
echo "To deploy on Netlify:"
echo "  1. Go to app.netlify.com → 'Add new site' → 'Import from Git'"
echo "  2. Connect GitHub and select '$REPO_NAME'"
echo "  3. Build command: npm run build"
echo "  4. Publish directory: dist"
echo "  5. Deploy — netlify.toml already handles the SPA redirect."
echo ""
