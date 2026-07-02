# RJD WiFi Installer Repository

This repository contains the customer edge runtime used by Orange Pi and
Raspberry Pi first-boot installers.

It intentionally excludes local `.env` files, SQLite databases, build outputs,
node_modules, Android artifacts, factory image tooling, and the RJD Cloud API
service.

Clean Armbian install:

```bash
cd /tmp
git clone --depth 1 https://github.com/rjdtech-sys/rjdwifi-installer.git
cd rjdwifi-installer
sudo RJD_EDGE_API_TOKEN=... bash deploy/edge/bootstrap-clean-armbian.sh
```

Direct install from an already-cloned repository:

```bash
sudo RJD_EDGE_API_TOKEN=... bash deploy/edge/install-customer-device.sh
```

Repair an already-installed device that shows `Invalid edge token` in the setup
wizard:

```bash
sudo sed -i 's|^RJD_EDGE_API_TOKEN=.*|RJD_EDGE_API_TOKEN=...|' /opt/rjd-pisowifi/.env
sudo sqlite3 /opt/rjd-pisowifi/pisowifi.sqlite "INSERT OR REPLACE INTO config (key, value) VALUES ('boardType', 'orange_pi');"
pm2 restart rjd-pisowifi --update-env
```

Hardware image first boot clones this repository into `/opt/rjd-pisowifi`, runs
a lockfile-preserving native Node install, builds the frontend, copies
`deploy/edge/.env.edge.example` to `.env`, starts `server.js` with PM2, installs
WAN DHCP recovery, and enables the temporary setup AP service when a supported
USB WiFi adapter is present.

Diagnostics after a clean install:

```bash
sudo /opt/rjd-edge-installer/diagnose-clean-armbian.sh
```
