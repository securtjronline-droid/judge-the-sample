#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"

if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
  printf '%s\n' 'Install Node.js 24 LTS (including npm), reopen your Bash terminal, and try again.' >&2
  exit 1
fi
node --input-type=module -e "
const [major, minor] = process.versions.node.split('.').map(Number);
if (!((major === 20 && minor >= 19) || (major === 22 && minor >= 12) || major >= 23)) {
  console.error('This Vite project needs Node.js 20.19+, 22.12+, or newer. Node.js 24 LTS is recommended.');
  process.exit(1);
}"

NORTHSTAR_LOCK_HASH="$(node --input-type=module -e "import{readFileSync}from'node:fs';import{createHash}from'node:crypto';console.log(createHash('sha256').update(readFileSync('package-lock.json')).digest('hex'))")"
if [ ! -x node_modules/.bin/vite ] || [ ! -f node_modules/.northstar-lock ] || [ "$(cat node_modules/.northstar-lock)" != "$NORTHSTAR_LOCK_HASH" ]; then
  printf '%s\n' 'Installing the exact dependencies from package-lock.json with npm ci...'
  npm ci --no-fund
  printf '%s\n' "$NORTHSTAR_LOCK_HASH" > node_modules/.northstar-lock
fi

NORTHSTAR_PORT="${PORT:-5173}"
if ! [[ "$NORTHSTAR_PORT" =~ ^[0-9]+$ ]] || (( 10#$NORTHSTAR_PORT < 1 || 10#$NORTHSTAR_PORT > 65535 )); then
  printf '%s\n' 'PORT must be a whole number from 1 to 65535.' >&2
  exit 1
fi
printf '\nOpen http://127.0.0.1:%s in your browser. Stop the app with Ctrl+C.\n\n' "$NORTHSTAR_PORT"
exec npm run dev -- --host 127.0.0.1 --port "$NORTHSTAR_PORT" --strictPort
