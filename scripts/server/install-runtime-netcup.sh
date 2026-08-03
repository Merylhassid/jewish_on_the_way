#!/usr/bin/env bash
set -Eeuo pipefail

DEPLOY_USER="jotw"
APP_ROOT="/srv/jewish-on-the-way/backend"
NODE_MAJOR="24"

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y ca-certificates curl nginx xz-utils

node_archive="$(curl -fsSL "https://nodejs.org/dist/latest-v${NODE_MAJOR}.x/SHASUMS256.txt" | awk '/linux-x64\.tar\.xz$/ {print $2; exit}')"
node_checksum="$(curl -fsSL "https://nodejs.org/dist/latest-v${NODE_MAJOR}.x/SHASUMS256.txt" | awk '/linux-x64\.tar\.xz$/ {print $1; exit}')"
test -n "$node_archive"
test -n "$node_checksum"

node_dir="${node_archive%.tar.xz}"
if [ ! -d "/opt/$node_dir" ]; then
  curl -fsSLo "/tmp/$node_archive" "https://nodejs.org/dist/latest-v${NODE_MAJOR}.x/$node_archive"
  printf '%s  %s\n' "$node_checksum" "/tmp/$node_archive" | sha256sum --check --status
  tar -xJf "/tmp/$node_archive" -C /opt
  rm -f "/tmp/$node_archive"
fi
ln -sfn "/opt/$node_dir" /opt/node
for binary in node npm npx corepack; do
  ln -sfn "/opt/node/bin/$binary" "/usr/local/bin/$binary"
done

npm install --global pm2@latest
ln -sfn /opt/node/bin/pm2 /usr/local/bin/pm2
ln -sfn /opt/node/bin/pm2-runtime /usr/local/bin/pm2-runtime

install -d -m 755 -o "$DEPLOY_USER" -g "$DEPLOY_USER" \
  "$APP_ROOT/current" \
  "$APP_ROOT/shared" \
  "$APP_ROOT/logs"

cat > /etc/nginx/conf.d/websocket-map.conf <<'EOF'
map $http_upgrade $connection_upgrade {
    default upgrade;
    ''      close;
}
EOF

cat > /etc/nginx/sites-available/api.jewishontheway.com <<'EOF'
server {
    listen 80;
    listen [::]:80;
    server_name api.jewishontheway.com;

    server_tokens off;
    client_max_body_size 12m;

    access_log /var/log/nginx/jotw-api-access.log;
    error_log  /var/log/nginx/jotw-api-error.log warn;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        proxy_connect_timeout 10s;
        proxy_read_timeout 75s;
        proxy_send_timeout 75s;
    }
}
EOF

ln -sfn /etc/nginx/sites-available/api.jewishontheway.com /etc/nginx/sites-enabled/api.jewishontheway.com
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl enable --now nginx
systemctl reload nginx

env PATH="/usr/local/bin:/usr/bin:/bin" pm2 startup systemd -u "$DEPLOY_USER" --hp "/home/$DEPLOY_USER" >/tmp/pm2-startup.log
systemctl daemon-reload

printf '%s\n' 'RUNTIME_INSTALL_COMPLETE'
node --version
npm --version
pm2 --version
nginx -v
nginx -t
systemctl is-enabled nginx
systemctl is-active nginx
find "$APP_ROOT" -maxdepth 1 -printf '%M %u:%g %p\n' | sort
