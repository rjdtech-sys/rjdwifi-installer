#!/bin/bash

set -euo pipefail

APP_DIR="${RJD_INSTALL_DIR:-/opt/rjd-pisowifi}"
REPO_URL="${RJD_REPO_URL:-https://github.com/rjdtech-sys/rjdwifi-installer.git}"
LICENSE_API_URL="${RJD_LICENSE_API_URL:-https://api.rjdtech.shop}"
EDGE_TOKEN="${RJD_EDGE_API_TOKEN:-}"
SETUP_AP_SCRIPT="/opt/rjd-edge-installer/setup-wifi-ap.sh"
DIAG_SCRIPT="/opt/rjd-edge-installer/diagnose-clean-armbian.sh"

if [ "${EUID}" -ne 0 ]; then
  echo "Run as root: sudo RJD_EDGE_API_TOKEN=... bash deploy/edge/install-customer-device.sh"
  exit 1
fi

if [ -z "${EDGE_TOKEN}" ] || [ "${EDGE_TOKEN}" = "replace-with-token-issued-by-rjd-cloud" ]; then
  echo "[RJD Edge] RJD_EDGE_API_TOKEN is required for cloud setup/licensing."
  echo "[RJD Edge] Run with the token used by https://api.rjdtech.shop:"
  echo "  sudo RJD_EDGE_API_TOKEN=... bash deploy/edge/install-customer-device.sh"
  exit 1
fi

detect_board() {
  if grep -qi "raspberry pi" /proc/device-tree/model 2>/dev/null; then
    echo "raspberry_pi"
  elif grep -qi "orange pi" /proc/device-tree/model /proc/cpuinfo 2>/dev/null || [ -f /etc/armbian-release ]; then
    echo "orange_pi"
  elif [ "$(uname -m)" = "x86_64" ]; then
    echo "x64_pc"
  else
    echo "generic"
  fi
}

BOARD="$(detect_board)"
echo "[RJD Edge] Installing customer device for ${BOARD}"

echo "[RJD Edge] Cleaning apt cache and package lists"
apt-get clean
rm -rf /var/lib/apt/lists/*

apt-get update
apt-get install -y \
  bridge-utils build-essential ca-certificates conntrack curl dnsmasq ffmpeg git hostapd \
  iproute2 iptables iputils-ping isc-dhcp-client iw libcap2-bin libffi-dev libsqlite3-dev \
  libssl-dev libudev-dev net-tools openssh-server pkg-config ppp pppoe psmisc python3 \
  python-is-python3 python3-dev python3-pip python3-setuptools python3-venv rfkill sqlite3 vlan wireless-regdb

if [ "${BOARD}" = "x64_pc" ]; then
  apt-get install -y setserial || true
  usermod -a -G dialout root || true
fi

echo "[RJD Edge] Ensuring esptool is available"
if apt-get install -y esptool; then
  true
elif apt-get install -y python3-esptool; then
  true
else
  ESPTOOL_VENV="/opt/rjd-esptool-venv"
  python3 -m venv "${ESPTOOL_VENV}"
  "${ESPTOOL_VENV}/bin/python" -m pip install --no-input esptool
  ln -sf "${ESPTOOL_VENV}/bin/esptool" /usr/local/bin/esptool
fi

if ! command -v node >/dev/null 2>&1; then
  DEB_ARCH="$(dpkg --print-architecture 2>/dev/null || true)"
  if [ "${DEB_ARCH}" = "amd64" ] || [ "${DEB_ARCH}" = "arm64" ]; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
  else
    echo "[RJD Edge] Using distro Node.js for architecture ${DEB_ARCH:-unknown}"
    apt-get install -y nodejs npm
  fi
else
  DEB_ARCH="$(dpkg --print-architecture 2>/dev/null || true)"
  echo "[RJD Edge] Node.js $(node -v) already installed"
fi

if [ "${DEB_ARCH:-}" = "amd64" ] || [ "${DEB_ARCH:-}" = "arm64" ]; then
  npm install -g npm@latest node-gyp pm2
else
  npm install -g node-gyp@10 pm2
fi

if ! python3 -c "import distutils.version" >/dev/null 2>&1; then
  apt-get install -y python3-distutils || true
fi

if ! python3 -c "import distutils.version" >/dev/null 2>&1; then
  PY_VENV="/opt/rjd-python-venv"
  python3 -m venv "${PY_VENV}"
  "${PY_VENV}/bin/python" -m pip install --no-input --upgrade pip setuptools
  export PYTHON="${PY_VENV}/bin/python"
  npm config set python "${PYTHON}" >/dev/null 2>&1 || true
  echo "[RJD Edge] Using venv Python for node-gyp: ${PYTHON}"
else
  npm config set python "$(command -v python3)" >/dev/null 2>&1 || true
fi

install_setup_ap_service() {
  if [ ! -f "${SETUP_AP_SCRIPT}" ] && [ -f "${APP_DIR}/deploy/edge/setup-wifi-ap.sh" ]; then
    install -d /opt/rjd-edge-installer
    install -m 0755 "${APP_DIR}/deploy/edge/setup-wifi-ap.sh" "${SETUP_AP_SCRIPT}"
  fi
  if [ -f "${APP_DIR}/deploy/edge/diagnose-clean-armbian.sh" ]; then
    install -d /opt/rjd-edge-installer
    install -m 0755 "${APP_DIR}/deploy/edge/diagnose-clean-armbian.sh" "${DIAG_SCRIPT}"
  fi

  if [ ! -f "${SETUP_AP_SCRIPT}" ]; then
    echo "[RJD Edge] Setup AP script not found; skipping factory setup WiFi"
    return 0
  fi

  install -d /etc/systemd/system
  cat > /etc/systemd/system/rjd-setup-ap.service <<'UNIT'
[Unit]
Description=RJD factory setup WiFi access point
After=network.target
Wants=network.target

[Service]
Type=forking
ExecStart=/opt/rjd-edge-installer/setup-wifi-ap.sh
ExecStop=/bin/sh -c 'killall hostapd 2>/dev/null || true; if [ -f /run/rjd-setup-dnsmasq.pid ]; then kill "$(cat /run/rjd-setup-dnsmasq.pid)" 2>/dev/null || true; rm -f /run/rjd-setup-dnsmasq.pid; fi'
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
UNIT

  systemctl daemon-reload
  systemctl enable rjd-setup-ap.service >/dev/null 2>&1 || true
  systemctl restart rjd-setup-ap.service >/dev/null 2>&1 || true
}

install_remote_ssh() {
  echo "[RJD Edge] Ensuring SSH remote access service is enabled on port 22"
  install -d /run/sshd

  if [ -f /etc/ssh/sshd_config ]; then
    if grep -qE '^[#[:space:]]*Port[[:space:]]+' /etc/ssh/sshd_config; then
      sed -i 's/^[#[:space:]]*Port[[:space:]].*/Port 22/' /etc/ssh/sshd_config
    else
      printf '\nPort 22\n' >> /etc/ssh/sshd_config
    fi

    if grep -qE '^[#[:space:]]*ListenAddress[[:space:]]+' /etc/ssh/sshd_config; then
      sed -i 's/^[#[:space:]]*ListenAddress[[:space:]].*/ListenAddress 0.0.0.0/' /etc/ssh/sshd_config
    else
      printf 'ListenAddress 0.0.0.0\n' >> /etc/ssh/sshd_config
    fi
  fi

  if command -v ufw >/dev/null 2>&1 && ufw status 2>/dev/null | grep -qi active; then
    ufw allow 22/tcp >/dev/null 2>&1 || true
  fi

  systemctl daemon-reload
  systemctl enable ssh >/dev/null 2>&1 || systemctl enable sshd >/dev/null 2>&1 || true
  systemctl restart ssh >/dev/null 2>&1 || systemctl restart sshd >/dev/null 2>&1 || true
}

if [ ! -d "${APP_DIR}/.git" ]; then
  git clone "${REPO_URL}" "${APP_DIR}"
fi

cd "${APP_DIR}"
rm -rf node_modules dist
if [ -f package-lock.json ]; then
  npm ci --unsafe-perm --no-audit --no-fund --build-from-source
else
  npm install --unsafe-perm --no-audit --no-fund --build-from-source
fi
npm run build

if [ ! -f .env ]; then
  cp deploy/edge/.env.edge.example .env
fi

sed -i "s|^RJD_LICENSE_API_URL=.*|RJD_LICENSE_API_URL=${LICENSE_API_URL}|" .env
sed -i "s|^RJD_BOARD_TYPE=.*|RJD_BOARD_TYPE=${BOARD}|" .env
sed -i "s|^RJD_EDGE_API_TOKEN=.*|RJD_EDGE_API_TOKEN=${EDGE_TOKEN}|" .env

sqlite3 pisowifi.sqlite \
  "CREATE TABLE IF NOT EXISTS config (key TEXT PRIMARY KEY, value TEXT); INSERT OR REPLACE INTO config (key, value) VALUES ('boardType', '${BOARD}');"

if [ "${BOARD}" = "orange_pi" ]; then
  sqlite3 pisowifi.sqlite \
    "INSERT OR IGNORE INTO config (key, value) VALUES ('boardModel', 'orange_pi_one'); INSERT OR IGNORE INTO config (key, value) VALUES ('coinPin', '3');"
fi

install_setup_ap_service
install_remote_ssh

pm2 delete rjd-pisowifi 2>/dev/null || true
pm2 start server.js --name rjd-pisowifi
pm2 save
pm2 startup systemd -u root --hp /root >/tmp/rjd-pm2-startup.txt 2>/dev/null || true

setcap 'cap_net_bind_service,cap_net_admin,cap_net_raw+ep' "$(readlink -f "$(command -v node)")" || true

if [ -f "${APP_DIR}/scripts/rjd-wan-dhcp-wait.sh" ] && [ -f "${APP_DIR}/scripts/rjd-wan-dhcp-wait.service" ]; then
  chmod +x "${APP_DIR}/scripts/rjd-wan-dhcp-wait.sh"
  install -m 0644 "${APP_DIR}/scripts/rjd-wan-dhcp-wait.service" /etc/systemd/system/rjd-wan-dhcp-wait.service
  systemctl daemon-reload
  systemctl enable rjd-wan-dhcp-wait.service >/dev/null 2>&1 || true
fi

echo "[RJD Edge] Complete. Local setup gate: http://$(hostname -I | awk '{print $1}')/setup"
echo "[RJD Edge] SSH enabled on port 22 for LAN/reachable routed networks. Use VPN/tunnel or router port-forwarding for off-network access."
echo "[RJD Edge] Factory setup WiFi, when a USB WiFi adapter supports AP mode: SSID ${RJD_SETUP_AP_SSID:-RJD-Setup}, URL http://${RJD_SETUP_AP_IP:-10.0.0.1}/setup"
echo "[RJD Edge] Diagnostics: sudo /opt/rjd-edge-installer/diagnose-clean-armbian.sh"
