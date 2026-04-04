#!/bin/bash
set -euo pipefail

# Only run in remote (web) environments
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"

echo "Installing npm dependencies..."
npm install

# Configure git credentials for push via credential store
if [ -n "${GIT_PAT:-}" ]; then
  git config credential.helper store
  echo "https://sunvita:${GIT_PAT}@github.com" > ~/.git-credentials
  echo "Git credentials configured."
fi

echo "Session setup complete."
