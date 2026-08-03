#!/usr/bin/env bash
set -Eeuo pipefail

DEPLOY_USER="jotw"

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y sudo ufw fail2ban unattended-upgrades

if ! id -u "$DEPLOY_USER" >/dev/null 2>&1; then
  useradd --create-home --shell /bin/bash "$DEPLOY_USER"
fi
usermod -aG sudo "$DEPLOY_USER"

install -d -m 700 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "/home/$DEPLOY_USER/.ssh"
install -m 600 -o "$DEPLOY_USER" -g "$DEPLOY_USER" /root/.ssh/authorized_keys "/home/$DEPLOY_USER/.ssh/authorized_keys"

cat > "/etc/sudoers.d/$DEPLOY_USER" <<EOF
$DEPLOY_USER ALL=(ALL:ALL) NOPASSWD:ALL
EOF
chmod 440 "/etc/sudoers.d/$DEPLOY_USER"
visudo -cf "/etc/sudoers.d/$DEPLOY_USER"

if ! swapon --show=NAME --noheadings | grep -qx '/swapfile'; then
  if [ ! -f /swapfile ]; then
    fallocate -l 2G /swapfile
    chmod 600 /swapfile
    mkswap /swapfile
  fi
  swapon /swapfile
fi
grep -qE '^/swapfile\s' /etc/fstab || printf '/swapfile none swap sw 0 0\n' >> /etc/fstab

cat > /etc/sysctl.d/99-jotw.conf <<'EOF'
vm.swappiness=10
vm.vfs_cache_pressure=50
EOF
sysctl --system >/dev/null

cat > /etc/ssh/sshd_config.d/99-jotw-hardening.conf <<'EOF'
PubkeyAuthentication yes
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitEmptyPasswords no
PermitRootLogin prohibit-password
X11Forwarding no
MaxAuthTries 3
EOF
sshd -t

ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

cat > /etc/fail2ban/jail.d/sshd.local <<'EOF'
[sshd]
enabled = true
backend = systemd
maxretry = 5
findtime = 10m
bantime = 1h
EOF
systemctl enable --now fail2ban
systemctl restart fail2ban

cat > /etc/apt/apt.conf.d/20auto-upgrades <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
EOF
systemctl reload ssh

printf '%s\n' 'BOOTSTRAP_COMPLETE'
id "$DEPLOY_USER"
free -h
swapon --show
ufw status verbose
fail2ban-client status sshd
sshd -T | grep -E '^(passwordauthentication|kbdinteractiveauthentication|permitrootlogin|pubkeyauthentication) '
