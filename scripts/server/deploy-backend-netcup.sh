#!/usr/bin/env bash
set -Eeuo pipefail

APP_ROOT="/srv/jewish-on-the-way/backend"
ARCHIVE="/tmp/jotw-backend-release.tar.gz"
INCOMING_ENV="/tmp/jotw-backend.env"
RELEASE_ID="$(date -u +%Y%m%d%H%M%S)"
RELEASE_DIR="$APP_ROOT/releases/$RELEASE_ID"

test -s "$ARCHIVE"
test -s "$INCOMING_ENV"

sudo install -d -m 755 -o jotw -g jotw "$APP_ROOT/releases"
install -d -m 755 "$RELEASE_DIR"
tar -xzf "$ARCHIVE" -C "$RELEASE_DIR"

umask 077
sed -i 's/\r$//' "$INCOMING_ENV"
mv "$INCOMING_ENV" "$APP_ROOT/shared/.env"
chmod 600 "$APP_ROOT/shared/.env"

set_env() {
  local key="$1"
  local value="$2"
  local file="$APP_ROOT/shared/.env"
  if grep -q "^${key}=" "$file"; then
    sed -i "s|^${key}=.*|${key}=${value}|" "$file"
  else
    printf '%s=%s\n' "$key" "$value" >> "$file"
  fi
}

set_env PORT 3001
set_env HOST 127.0.0.1
set_env NODE_ENV production
set_env APP_URL https://api.jewishontheway.com
set_env PUBLIC_WEB_URL https://jewishontheway.com
set_env CORS_ORIGINS https://jewishontheway.com,https://www.jewishontheway.com,http://localhost:8081

if ! grep -q '^AUDIT_FINGERPRINT_SECRET=.' "$APP_ROOT/shared/.env"; then
  set_env AUDIT_FINGERPRINT_SECRET "$(openssl rand -hex 32)"
fi

ln -sfn "$APP_ROOT/shared/.env" "$RELEASE_DIR/.env"

cd "$RELEASE_DIR"
npm ci --omit=dev --no-audit --no-fund

if [ -d "$APP_ROOT/current" ] && [ ! -L "$APP_ROOT/current" ]; then
  sudo rmdir "$APP_ROOT/current"
fi
sudo ln -sfn "$RELEASE_DIR" "$APP_ROOT/current"

cd "$APP_ROOT/current"
pm2 startOrReload ecosystem.config.cjs --update-env
pm2 save
# Hand ownership of the PM2 daemon to systemd. Starting PM2 from this SSH
# session first is useful for saving the process list, but systemd must spawn
# its own daemon so that the PID file belongs to the service lifecycle.
pm2 kill
sudo systemctl reset-failed pm2-jotw
sudo systemctl start pm2-jotw

healthy=0
for _ in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:3001/health >/tmp/jotw-health.json; then
    healthy=1
    break
  fi
  sleep 2
done

if [ "$healthy" -ne 1 ]; then
  pm2 status
  pm2 logs jewish-on-the-way-api --lines 60 --nostream
  exit 1
fi

rm -f "$ARCHIVE" /tmp/jotw-health.json

printf '%s\n' 'BACKEND_DEPLOY_COMPLETE'
printf 'RELEASE_ID=%s\n' "$RELEASE_ID"
pm2 status
ss -lnt | grep '127.0.0.1:3001'
curl -fsS http://127.0.0.1:3001/health
