#!/bin/bash

# Dynamically detect the Wi-Fi interface
IFACE=$(nmcli device status | grep wifi | awk '{print $1}')

# Check if a Wi-Fi interface was found
if [ -z "$IFACE" ]; then
  echo "No Wi-Fi interface detected. Exiting the script."
  exit 1
fi

# Stop hostapd and dnsmasq services (AP mode services)
echo "Stopping hostapd and dnsmasq services..."
sudo systemctl stop hostapd dnsmasq

# Disable the services from starting at boot
sudo systemctl disable hostapd dnsmasq

# Ensure NetworkManager is managing the Wi-Fi interface
echo "Ensuring $IFACE is managed by NetworkManager..."
# Remove unmanaged-devices from NetworkManager config if it exists
if grep -q "unmanaged-devices" /etc/NetworkManager/NetworkManager.conf; then
  sudo sed -i '/unmanaged-devices/d' /etc/NetworkManager/NetworkManager.conf
fi

# Tell NetworkManager to explicitly manage the Wi-Fi interface
sudo nmcli dev set $IFACE managed yes

# Restart NetworkManager to apply changes
echo "Restarting NetworkManager..."
sudo systemctl restart NetworkManager

# Flush the current IP configuration of the interface
echo "Flushing IP configuration on $IFACE..."
sudo ip addr flush dev $IFACE

# Disable IP forwarding
echo "Disabling IP forwarding..."
sudo sysctl -w net.ipv4.ip_forward=0

# Clear iptables NAT and forwarding rules (optional, based on your previous AP setup)
echo "Clearing iptables NAT and forwarding rules..."
sudo iptables -t nat -D POSTROUTING -o eth0 -j MASQUERADE
sudo iptables -D FORWARD -i $IFACE -o eth0 -j ACCEPT
sudo iptables -D FORWARD -i eth0 -o $IFACE -m state --state RELATED,ESTABLISHED -j ACCEPT

# Check if the Wi-Fi device is hard-blocked by rfkill
echo "Checking if Wi-Fi is blocked by rfkill..."
if rfkill list wifi | grep -q "Soft blocked: yes"; then
  echo "Wi-Fi is soft blocked. Unblocking Wi-Fi..."
  sudo rfkill unblock wifi
fi

if rfkill list wifi | grep -q "Hard blocked: yes"; then
  echo "Wi-Fi is hard blocked. Please check your hardware switch."
  exit 1
fi

# Optionally, reconnect to a Wi-Fi network
SSID="YourSSID"
PASSWORD="YourPassword"
echo "Connecting to Wi-Fi network $SSID..."
nmcli dev wifi connect "$SSID" password "$PASSWORD"

echo "Wi-Fi client mode has been activated."
