# RJD WiFi Installer Repository

This repository contains the customer edge runtime used by Orange Pi and
Raspberry Pi first-boot installers.

It intentionally excludes local `.env` files, SQLite databases, build outputs,
node_modules, Android artifacts, factory image tooling, and the RJD Cloud API
service.

Hardware image first boot clones this repository into `/opt/rjd-pisowifi`, runs
`npm install`, builds the frontend, copies `deploy/edge/.env.edge.example` to
`.env`, and starts `server.js` with PM2.
