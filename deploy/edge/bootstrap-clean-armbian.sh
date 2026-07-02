#!/bin/bash

set -euo pipefail

REPO_URL="${RJD_REPO_URL:-https://github.com/rjdtech-sys/rjdwifi-installer.git}"
BOOTSTRAP_DIR="${RJD_BOOTSTRAP_DIR:-/tmp/rjdwifi-installer-bootstrap}"

if [ "${EUID}" -ne 0 ]; then
  echo "Run as root: sudo -E bash deploy/edge/bootstrap-clean-armbian.sh"
  exit 1
fi

echo "[RJD Bootstrap] Installing from ${REPO_URL}"
echo "[RJD Bootstrap] Clean Armbian install needs Ethernet internet on first run."

apt-get update
apt-get install -y ca-certificates curl git

rm -rf "${BOOTSTRAP_DIR}"
git clone --depth 1 "${REPO_URL}" "${BOOTSTRAP_DIR}"

bash "${BOOTSTRAP_DIR}/deploy/edge/install-customer-device.sh"
