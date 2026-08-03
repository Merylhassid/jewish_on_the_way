#!/usr/bin/env bash
set -Eeuo pipefail

CF_V4_URL="https://www.cloudflare.com/ips-v4"
CF_V6_URL="https://www.cloudflare.com/ips-v6"

tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT

curl -fsS "$CF_V4_URL" -o "$tmp_dir/ips-v4"
curl -fsS "$CF_V6_URL" -o "$tmp_dir/ips-v6"
sed -i '/^[[:space:]]*$/d' "$tmp_dir/ips-v4" "$tmp_dir/ips-v6"

v4_count="$(wc -l < "$tmp_dir/ips-v4")"
v6_count="$(wc -l < "$tmp_dir/ips-v6")"

if [ "$v4_count" -lt 10 ] || [ "$v6_count" -lt 3 ]; then
  printf 'Refusing to continue: unexpected Cloudflare range counts (v4=%s, v6=%s).\n' \
    "$v4_count" "$v6_count" >&2
  exit 1
fi

if grep -Evq '^[0-9.]+/[0-9]+$' "$tmp_dir/ips-v4"; then
  printf '%s\n' 'Refusing to continue: invalid IPv4 CIDR in Cloudflare list.' >&2
  exit 1
fi

if grep -Evq '^[0-9A-Fa-f:]+/[0-9]+$' "$tmp_dir/ips-v6"; then
  printf '%s\n' 'Refusing to continue: invalid IPv6 CIDR in Cloudflare list.' >&2
  exit 1
fi

# Add the restrictive rules before removing the broad web rules so there is
# never a window in which Cloudflare is locked out of the origin.
while IFS= read -r cidr; do
  sudo ufw allow proto tcp from "$cidr" to any port 80 comment 'Cloudflare HTTP'
  sudo ufw allow proto tcp from "$cidr" to any port 443 comment 'Cloudflare HTTPS'
done < "$tmp_dir/ips-v4"

while IFS= read -r cidr; do
  sudo ufw allow proto tcp from "$cidr" to any port 80 comment 'Cloudflare HTTP v6'
  sudo ufw allow proto tcp from "$cidr" to any port 443 comment 'Cloudflare HTTPS v6'
done < "$tmp_dir/ips-v6"

# These remove only the original unrestricted rules created as
# `ufw allow 80/tcp` and `ufw allow 443/tcp`.
sudo ufw --force delete allow 80/tcp || true
sudo ufw --force delete allow 443/tcp || true

{
  printf '%s\n' '# Managed by scripts/server/restrict-web-to-cloudflare.sh'
  while IFS= read -r cidr; do
    printf 'set_real_ip_from %s;\n' "$cidr"
  done < "$tmp_dir/ips-v4"
  while IFS= read -r cidr; do
    printf 'set_real_ip_from %s;\n' "$cidr"
  done < "$tmp_dir/ips-v6"
  printf '%s\n' 'real_ip_header CF-Connecting-IP;'
  printf '%s\n' 'real_ip_recursive on;'
} > "$tmp_dir/cloudflare-real-ip.conf"

sudo install -m 644 "$tmp_dir/cloudflare-real-ip.conf" \
  /etc/nginx/conf.d/cloudflare-real-ip.conf
sudo nginx -t
sudo systemctl reload nginx

printf 'CLOUDFLARE_ORIGIN_RESTRICTION_COMPLETE v4=%s v6=%s\n' \
  "$v4_count" "$v6_count"
sudo ufw status
