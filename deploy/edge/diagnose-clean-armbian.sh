#!/bin/bash

set -euo pipefail

echo "=== RJD Clean Armbian Diagnostics ==="
date -Is

echo
echo "=== OS ==="
cat /etc/os-release 2>/dev/null || true
uname -a

echo
echo "=== Routes ==="
ip route || true

echo
echo "=== Interfaces ==="
ip -brief link || true
ip -brief addr || true

echo
echo "=== WiFi Devices / AP Mode ==="
if command -v iw >/dev/null 2>&1; then
  iw dev || true
  for iface in $(iw dev 2>/dev/null | awk '$1 == "Interface" { print $2 }'); do
    echo "--- ${iface}"
    iw dev "${iface}" info || true
    wiphy="$(iw dev "${iface}" info 2>/dev/null | awk '$1 == "wiphy" { print $2; exit }')"
    if [ -n "${wiphy}" ]; then
      if iw phy "phy${wiphy}" info 2>/dev/null | awk '
        /Supported interface modes:/ { in_modes=1; next }
        in_modes && /^\t \* AP$/ { found=1 }
        in_modes && /^[^\t]/ { in_modes=0 }
        END { exit found ? 0 : 1 }
      '; then
        echo "AP mode: yes"
      else
        echo "AP mode: no"
      fi
    fi
  done
else
  echo "iw is not installed"
fi

echo
echo "=== RJD Services ==="
systemctl status rjd-setup-ap.service --no-pager || true
systemctl status rjd-edge-firstboot.service --no-pager || true
pm2 status || true

echo
echo "=== DHCP / hostapd listeners ==="
pgrep -a hostapd || true
pgrep -a dnsmasq || true
ss -lunp 2>/dev/null | grep -E ':(67|53)\b' || true

echo
echo "=== RJD Logs ==="
tail -n 200 /var/log/rjd-setup-ap.log 2>/dev/null || true
tail -n 200 /var/log/rjd-edge-firstboot.log 2>/dev/null || true

echo
echo "=== Recent journal ==="
journalctl -u rjd-setup-ap.service -n 120 --no-pager 2>/dev/null || true
journalctl -u hostapd -n 60 --no-pager 2>/dev/null || true
journalctl -u dnsmasq -n 60 --no-pager 2>/dev/null || true
