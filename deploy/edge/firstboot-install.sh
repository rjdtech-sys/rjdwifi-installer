#!/bin/bash

set -euo pipefail

LOG_FILE="/var/log/rjd-edge-firstboot.log"
ENV_FILES=("/etc/rjd-edge.env" "/boot/rjd-edge.env" "/boot/firmware/rjd-edge.env")
INSTALLER="/opt/rjd-edge-installer/install-customer-device.sh"

exec > >(tee -a "${LOG_FILE}") 2>&1

echo "[RJD Firstboot] Starting edge installer at $(date -Is)"

for env_file in "${ENV_FILES[@]}"; do
  if [ -f "${env_file}" ]; then
    echo "[RJD Firstboot] Loading ${env_file}"
    set -a
    # shellcheck disable=SC1090
    . "${env_file}"
    set +a
  fi
done

if [ ! -f "${INSTALLER}" ]; then
  echo "[RJD Firstboot] Missing installer: ${INSTALLER}"
  exit 1
fi

chmod +x "${INSTALLER}"
bash "${INSTALLER}"

systemctl disable rjd-edge-firstboot.service >/dev/null 2>&1 || true
rm -f /etc/systemd/system/multi-user.target.wants/rjd-edge-firstboot.service

echo "[RJD Firstboot] Completed at $(date -Is)"
