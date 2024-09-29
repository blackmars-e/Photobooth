#!/bin/bash

# Dynamisch das Wi-Fi-Interface erkennen
IFACE=$(nmcli device status | grep wifi | awk '{print $1}')

# Überprüfen, ob ein Wi-Fi-Interface gefunden wurde
if [ -z "$IFACE" ]; then
  echo "Kein Wi-Fi-Interface erkannt. Beende das Skript."
  exit 1
fi

SSID="Photobox"
WEB_SERVER_IP="192.168.50.1"  # IP des lokalen Webservers

# 0. Trennen Sie das aktuelle Wi-Fi-Netzwerk
echo "Trenne das aktuelle Wi-Fi-Netzwerk auf $IFACE..."
sudo nmcli dev disconnect $IFACE

# 1. Konfigurieren des Netzwerk-Interfaces
sudo ip link set dev $IFACE down
sudo ip addr flush dev $IFACE
sudo ip addr add $WEB_SERVER_IP/24 dev $IFACE
sudo ip link set dev $IFACE up

# 2. Hostapd-Dienst entmaskieren und aktivieren
sudo systemctl unmask hostapd
sudo systemctl enable hostapd

# 3. Hostapd-Konfiguration (offener Zugangspunkt)
sudo bash -c 'cat > /etc/hostapd/hostapd.conf' << EOF
interface=$IFACE
ssid=$SSID
hw_mode=g
channel=7
auth_algs=1
wpa=0
EOF

sudo bash -c 'cat > /etc/default/hostapd' << EOF
DAEMON_CONF="/etc/hostapd/hostapd.conf"
EOF

# 4. DNSmasq-Konfiguration
sudo bash -c 'cat > /etc/dnsmasq.conf' << EOF
interface=$IFACE
dhcp-range=192.168.50.10,192.168.50.100,255.255.255.0
address=/photobox.de/$WEB_SERVER_IP
EOF

# 5. Dienste stoppen und starten
sudo systemctl stop hostapd dnsmasq
sudo systemctl start hostapd dnsmasq

# 6. IPTables-Regeln für NAT (Optional)
sudo iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE
sudo iptables -A FORWARD -i $IFACE -o eth0 -j ACCEPT
sudo iptables -A FORWARD -i eth0 -o $IFACE -m state --state RELATED,ESTABLISHED -j ACCEPT

# 7. Aktivieren des IP-Forwarding
sudo sysctl -w net.ipv4.ip_forward=1

# 8. Speichern der IPTables-Konfiguration
sudo netfilter-persistent save

echo "WiFi Access Point $SSID wurde erfolgreich gestartet."

