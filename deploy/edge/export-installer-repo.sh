#!/bin/bash

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DEST_DIR="${1:-/root/rjdwifi-installer}"
REMOTE_URL="${RJD_INSTALLER_REMOTE_URL:-https://github.com/rjdtech-sys/rjdwifi-installer.git}"

if [ ! -d "${DEST_DIR}/.git" ]; then
  git clone "${REMOTE_URL}" "${DEST_DIR}"
fi

DEST_REAL="$(cd "${DEST_DIR}" && pwd)"
case "${DEST_REAL}" in
  /root/rjdwifi-installer|/tmp/rjdwifi-installer*) ;;
  *)
    echo "Refusing to clean unexpected destination: ${DEST_REAL}"
    echo "Use /root/rjdwifi-installer or /tmp/rjdwifi-installer*."
    exit 1
    ;;
esac

echo "[RJD Export] Cleaning ${DEST_REAL}"
find "${DEST_REAL}" -mindepth 1 \
  ! -path "${DEST_REAL}/.git" \
  ! -path "${DEST_REAL}/.git/*" \
  -exec rm -rf {} +

INCLUDE_PATHS=(
  ".env.example"
  ".gitignore"
  "App.tsx"
  "README.md"
  "components"
  "deploy/edge"
  "docs"
  "error.html"
  "firmware/NodeMCU_ESP8266"
  "firmware/nodemcu"
  "index.html"
  "index-optimized.html"
  "index.tsx"
  "install.sh"
  "latest_release.json"
  "lib"
  "metadata.json"
  "package-lock.json"
  "package.json"
  "public"
  "scripts"
  "server-portal-integration.js"
  "server.js"
  "tsconfig.json"
  "types.ts"
  "update_release.json"
  "vite.config.ts"
)

LIST_FILE="$(mktemp /tmp/rjd-installer-export.XXXXXX)"
cleanup() {
  rm -f "${LIST_FILE}"
}
trap cleanup EXIT

for path in "${INCLUDE_PATHS[@]}"; do
  if [ -e "${PROJECT_ROOT}/${path}" ]; then
    printf '%s\n' "${path}" >> "${LIST_FILE}"
  fi
done

echo "[RJD Export] Copying sanitized edge runtime"
tar -C "${PROJECT_ROOT}" \
  --exclude='.env' \
  --exclude='*.sqlite' \
  --exclude='*.sqlite-*' \
  --exclude='node_modules' \
  --exclude='dist' \
  --exclude='build' \
  --exclude='.gradle' \
  --exclude='*.apk' \
  --exclude='*.bin' \
  --exclude='*.elf' \
  --exclude='*.map' \
  --exclude='deploy/cloud' \
  --exclude='deploy/images' \
  -cf - -T "${LIST_FILE}" | tar -C "${DEST_REAL}" -xf -

node - "${DEST_REAL}/package.json" <<'NODE'
const fs = require('fs');
const packagePath = process.argv[2];
const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
for (const scriptName of ['cloud:start', 'cloud:dev', 'image:orange-pi-one']) {
  delete pkg.scripts?.[scriptName];
}
fs.writeFileSync(packagePath, `${JSON.stringify(pkg, null, 2)}\n`);
NODE

cat > "${DEST_REAL}/INSTALLER_REPO.md" <<'DOC'
# RJD WiFi Installer Repository

This repository contains the customer edge runtime used by Orange Pi and
Raspberry Pi first-boot installers.

It intentionally excludes local `.env` files, SQLite databases, build outputs,
node_modules, Android artifacts, factory image tooling, and the RJD Cloud API
service.

Hardware image first boot clones this repository into `/opt/rjd-pisowifi`, runs
`npm install`, builds the frontend, copies `deploy/edge/.env.edge.example` to
`.env`, and starts `server.js` with PM2.
DOC

git -C "${DEST_REAL}" status --short

cat <<MSG
[RJD Export] Done.

Review the staged installer repo:
  ${DEST_REAL}

Then publish it when ready:
  cd ${DEST_REAL}
  git add .
  git commit -m "Add customer edge installer runtime"
  git push origin main
MSG
