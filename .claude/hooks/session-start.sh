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
  # Write credentials for both github.com and the Anthropic egress proxy URL
  {
    echo "https://sunvita:${GIT_PAT}@github.com"
    echo "http://local_proxy:${GIT_PAT}@127.0.0.1:34327"
  } > ~/.git-credentials
  echo "Git credentials configured."
fi

echo "Session setup complete."
