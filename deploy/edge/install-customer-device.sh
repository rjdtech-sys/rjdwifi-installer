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
  libssl-dev libudev-dev net-tools pkg-config ppp pppoe psmisc python3 \
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
if [ -n "${EDGE_TOKEN}" ]; then
  sed -i "s|^RJD_EDGE_API_TOKEN=.*|RJD_EDGE_API_TOKEN=${EDGE_TOKEN}|" .env
fi

install_setup_ap_service

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
echo "[RJD Edge] Factory setup WiFi, when a USB WiFi adapter supports AP mode: SSID ${RJD_SETUP_AP_SSID:-RJD-Setup}, URL http://${RJD_SETUP_AP_IP:-10.0.0.1}/setup"
echo "[RJD Edge] Diagnostics: sudo /opt/rjd-edge-installer/diagnose-clean-armbian.sh"
