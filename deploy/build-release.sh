#!/usr/bin/env bash
set -euo pipefail
# A Next.js build clears .next, including the running standalone directory.
active_release=$(readlink -f /opt/agent-studio/current 2>/dev/null || true)
if [ "$(pwd -P)" = "$active_release" ]; then
  echo "Refusing to rebuild the active release. Build in a new release directory." >&2
  exit 1
fi
export PATH=/opt/agent-studio/runtime/node/bin:$PATH
export NEXT_TELEMETRY_DISABLED=1
export NODE_OPTIONS=--max-old-space-size=768
export DATABASE_URL=file:/var/lib/agent-studio/agent-studio.db
pnpm=(node /opt/agent-studio/runtime/pnpm/node_modules/pnpm/bin/pnpm.cjs)
"${pnpm[@]}" install --frozen-lockfile
"${pnpm[@]}" db:generate
"${pnpm[@]}" build
mkdir -p .next/standalone/.next .next/standalone/public
cp -a .next/static .next/standalone/.next/
if [ -d public ]; then cp -a public/. .next/standalone/public/; fi
