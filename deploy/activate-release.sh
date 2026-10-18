#!/usr/bin/env bash
set -euo pipefail
# Run as root only after a successful build. Never stops Docker or Dufs.
release=$(realpath "${1:?Pass the absolute built release directory}")
case "$release" in /opt/agent-studio/releases/*) ;; *) echo "Unexpected release path" >&2; exit 1;; esac
test -f "$release/.next/standalone/server.js"
test -f /etc/agent-studio.env
previous=$(readlink -f /opt/agent-studio/current || true)
install -d -m 700 /var/backups/agent-studio
if [ -f /var/lib/agent-studio/agent-studio.db ]; then
  sqlite3 /var/lib/agent-studio/agent-studio.db ".backup '/var/backups/agent-studio/pre-$(date +%Y%m%d%H%M%S).db'"
fi
cd "$release"
runuser -u agentstudio -- env DATABASE_URL=file:/var/lib/agent-studio/agent-studio.db \
  /opt/agent-studio/runtime/node/bin/node node_modules/prisma/build/index.js migrate deploy
ln -sfn "$release" /opt/agent-studio/current
install -m 644 deploy/agent-studio.service /etc/systemd/system/agent-studio.service
install -m 644 deploy/agent-studio-proxy.service /etc/systemd/system/agent-studio-proxy.service
nginx -t -c /opt/agent-studio/current/deploy/nginx.conf
systemctl daemon-reload
systemctl enable agent-studio agent-studio-proxy
systemctl restart agent-studio
healthy=0
for attempt in {1..20}; do
  if curl -fsS http://127.0.0.1:3000/api/health; then healthy=1; break; fi
  sleep 1
done
if [ "$healthy" != 1 ]; then
  if [ -n "$previous" ] && [ -d "$previous" ]; then
    ln -sfn "$previous" /opt/agent-studio/current
    systemctl restart agent-studio
  fi
  echo "Health check failed; previous release restored when available" >&2
  exit 1
fi
if systemctl is-active --quiet agent-studio-proxy; then
  systemctl reload agent-studio-proxy
else
  systemctl start agent-studio-proxy
fi
for attempt in {1..10}; do
  if curl -fsS -H 'Host: atoms.ai-diy.me' http://127.0.0.1/api/health; then exit 0; fi
  sleep 1
done
echo "Proxy health check failed" >&2
exit 1
