#!/usr/bin/env bash
set -euo pipefail
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
