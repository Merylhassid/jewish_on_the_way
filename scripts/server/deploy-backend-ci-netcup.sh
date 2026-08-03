#!/usr/bin/env bash
set -Eeuo pipefail

APP_ROOT="/srv/jewish-on-the-way/backend"
ARCHIVE="/tmp/jotw-backend-ci-release.tar.gz"
RELEASE_ID="$(date -u +%Y%m%d%H%M%S)"
RELEASE_DIR="$APP_ROOT/releases/$RELEASE_ID"
PREVIOUS_RELEASE="$(readlink -f "$APP_ROOT/current" 2>/dev/null || true)"

test -s "$ARCHIVE"
test -s "$APP_ROOT/shared/.env"

install -d -m 755 "$RELEASE_DIR"
tar -xzf "$ARCHIVE" -C "$RELEASE_DIR"
ln -sfn "$APP_ROOT/shared/.env" "$RELEASE_DIR/.env"

cd "$RELEASE_DIR"
npm ci --omit=dev --no-audit --no-fund

sudo ln -sfn "$RELEASE_DIR" "$APP_ROOT/current"
cd "$APP_ROOT/current"
pm2 startOrReload ecosystem.config.cjs --update-env

healthy=0
for _ in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:3001/health >/dev/null; then
    healthy=1
    break
  fi
  sleep 2
done

if [ "$healthy" -ne 1 ]; then
  printf '%s\n' 'New release failed its health check; rolling back.' >&2
  if [ -n "$PREVIOUS_RELEASE" ] && [ -d "$PREVIOUS_RELEASE" ]; then
    sudo ln -sfn "$PREVIOUS_RELEASE" "$APP_ROOT/current"
    cd "$APP_ROOT/current"
    pm2 startOrReload ecosystem.config.cjs --update-env
    pm2 save
  fi
  exit 1
fi

pm2 save
rm -f "$ARCHIVE"

printf 'CI_DEPLOY_COMPLETE RELEASE_ID=%s\n' "$RELEASE_ID"
curl -fsS http://127.0.0.1:3001/health
