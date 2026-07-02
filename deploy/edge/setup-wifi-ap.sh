#!/bin/bash

set -euo pipefail

ENV_FILES=("/etc/rjd-edge.env" "/boot/rjd-edge.env" "/boot/firmware/rjd-edge.env" "/opt/rjd-pisowifi/.env")
LOG_FILE="${RJD_SETUP_AP_LOG:-/var/log/rjd-setup-ap.log}"

exec > >(tee -a "${LOG_FILE}") 2>&1

for env_file in "${ENV_FILES[@]}"; do
  if [ -f "${env_file}" ]; then
    set -a
    # shellcheck disable=SC1090
    . "${env_file}"
    set +a
  fi
done

SETUP_IP="${RJD_SETUP_AP_IP:-10.0.0.1}"
SETUP_CIDR="${RJD_SETUP_AP_CIDR:-24}"
SETUP_DHCP_RANGE="${RJD_SETUP_AP_DHCP_RANGE:-10.0.0.50,10.0.0.250,12h}"
SETUP_SSID="${RJD_SETUP_AP_SSID:-RJD-Setup}"
SETUP_PASSWORD="${RJD_SETUP_AP_PASSWORD:-}"
WIFI_IFACE="${RJD_SETUP_WIFI_IFACE:-}"
HOSTAPD_CONF="/etc/hostapd/rjd-setup-ap.conf"
DNSMASQ_CONF="/etc/dnsmasq.d/rjd-setup-ap.conf"
DNSMASQ_PID="/run/rjd-setup-dnsmasq.pid"

echo "[RJD Setup AP] Starting at $(date -Is)"

if [ "${EUID}" -ne 0 ]; then
  echo "[RJD Setup AP] Must run as root"
  exit 1
fi

if ! command -v hostapd >/dev/null 2>&1 || ! command -v dnsmasq >/dev/null 2>&1; then
  echo "[RJD Setup AP] hostapd/dnsmasq not installed yet; skipping"
  exit 0
fi

detect_wifi_iface() {
  if [ -n "${WIFI_IFACE}" ] && ip link show "${WIFI_IFACE}" >/dev/null 2>&1; then
    echo "${WIFI_IFACE}"
    return 0
  fi

  if command -v iw >/dev/null 2>&1; then
    iw dev 2>/dev/null | awk '$1 == "Interface" { print $2; exit }'
    return 0
  fi

  ip -o link show | awk -F': ' '$2 ~ /^(wlan|wlx|ra|ap)/ { print $2; exit }'
}

WIFI_IFACE="$(detect_wifi_iface || true)"
if [ -z "${WIFI_IFACE}" ]; then
  echo "[RJD Setup AP] No WiFi interface found. Orange Pi One needs a USB WiFi adapter for setup AP mode."
  exit 0
fi

DEFAULT_WAN="$(ip route show default 2>/dev/null | awk '{ print $5; exit }')"
if [ -n "${DEFAULT_WAN}" ] && [ "${WIFI_IFACE}" = "${DEFAULT_WAN}" ]; then
  echo "[RJD Setup AP] Refusing to convert active WAN interface ${WIFI_IFACE} into setup AP"
  exit 0
fi

if [ -n "${SETUP_PASSWORD}" ] && [ "${#SETUP_PASSWORD}" -lt 8 ]; then
  echo "[RJD Setup AP] RJD_SETUP_AP_PASSWORD must be empty or at least 8 characters"
  exit 1
fi

mkdir -p /etc/hostapd /etc/dnsmasq.d /run

systemctl stop hostapd >/dev/null 2>&1 || true
killall hostapd >/dev/null 2>&1 || true
if [ -f "${DNSMASQ_PID}" ]; then
  kill "$(cat "${DNSMASQ_PID}")" >/dev/null 2>&1 || true
  rm -f "${DNSMASQ_PID}"
fi

systemctl stop wpa_supplicant@${WIFI_IFACE}.service >/dev/null 2>&1 || true
nmcli device set "${WIFI_IFACE}" managed no >/dev/null 2>&1 || true
rfkill unblock wifi >/dev/null 2>&1 || true

ip link set "${WIFI_IFACE}" up
ip addr flush dev "${WIFI_IFACE}" || true
ip addr add "${SETUP_IP}/${SETUP_CIDR}" dev "${WIFI_IFACE}"

cat > "${HOSTAPD_CONF}" <<CONF
interface=${WIFI_IFACE}
driver=nl80211
ssid=${SETUP_SSID}
hw_mode=g
channel=${RJD_SETUP_AP_CHANNEL:-6}
wmm_enabled=0
macaddr_acl=0
auth_algs=1
ignore_broadcast_ssid=0
CONF

if [ -n "${SETUP_PASSWORD}" ]; then
  cat >> "${HOSTAPD_CONF}" <<CONF
wpa=2
wpa_passphrase=${SETUP_PASSWORD}
wpa_key_mgmt=WPA-PSK
rsn_pairwise=CCMP
CONF
fi

cat > "${DNSMASQ_CONF}" <<CONF
interface=${WIFI_IFACE}
bind-dynamic
dhcp-range=${SETUP_DHCP_RANGE}
dhcp-option=3,${SETUP_IP}
dhcp-option=6,${SETUP_IP}
dhcp-authoritative
address=/#/${SETUP_IP}
log-dhcp
CONF

dnsmasq --conf-file="${DNSMASQ_CONF}" --pid-file="${DNSMASQ_PID}"
hostapd -B "${HOSTAPD_CONF}"

echo "[RJD Setup AP] SSID '${SETUP_SSID}' is up on ${WIFI_IFACE}"
echo "[RJD Setup AP] Setup URL: http://${SETUP_IP}/setup"
