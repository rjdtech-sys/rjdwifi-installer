#!/bin/bash

set -euo pipefail

REPO_URL="${RJD_REPO_URL:-https://github.com/rjdtech-sys/rjdwifi-installer.git}"
BOOTSTRAP_DIR="${RJD_BOOTSTRAP_DIR:-/tmp/rjdwifi-installer-bootstrap}"
LOG_FILE="${RJD_BOOTSTRAP_LOG:-/var/log/rjd-clean-armbian-bootstrap.log}"

exec > >(tee -a "${LOG_FILE}") 2>&1

if [ "${EUID}" -ne 0 ]; then
  echo "Run as root: sudo RJD_EDGE_API_TOKEN=... bash deploy/edge/bootstrap-clean-armbian.sh"
  exit 1
fi

echo "[RJD Bootstrap] Installing from ${REPO_URL}"
echo "[RJD Bootstrap] Clean Armbian install needs Ethernet internet on first run."
echo "[RJD Bootstrap] Log: ${LOG_FILE}"

apt-get update
apt-get install -y ca-certificates curl git

rm -rf "${BOOTSTRAP_DIR}"
git clone --depth 1 "${REPO_URL}" "${BOOTSTRAP_DIR}"

if ! bash "${BOOTSTRAP_DIR}/deploy/edge/install-customer-device.sh"; then
  echo "[RJD Bootstrap] Install failed."
  echo "[RJD Bootstrap] Run diagnostics after fixing the visible error:"
  echo "  sudo bash ${BOOTSTRAP_DIR}/deploy/edge/diagnose-clean-armbian.sh"
  exit 1
fi

echo "[RJD Bootstrap] Install complete."
echo "[RJD Bootstrap] Diagnostics:"
echo "  sudo /opt/rjd-edge-installer/diagnose-clean-armbian.sh"
