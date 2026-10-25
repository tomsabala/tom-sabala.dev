#!/usr/bin/env bash
# Egress rules for app instance containers, in the DOCKER-USER chain Docker leaves alone.
#
# Instances need the public internet (FamilyCFO scrapes banks, Resume-Matcher calls LLM
# providers chosen by the visitor, TREK syncs to WebDAV). They need nothing on a private
# range: not the broker, not each other, not the host, not cloud metadata. Resume-Matcher
# deliberately lets any anonymous visitor set an arbitrary `api_base`, which is exactly the
# primitive these rules take away.
#
# Order matters. Established flows return first, so broker->instance proxying keeps working;
# then broker-originated NEW traffic returns; then everything else from the instance subnet
# to a private destination is dropped.
set -euo pipefail

SUBNET=172.31.240.0/24     # must match docker-compose.yml networks.instances.ipam
BROKER=172.31.240.2        # must match the broker's ipv4_address
TAG=apps-instances-egress

[ "$(id -u)" = 0 ] || { echo "firewall: run as root" >&2; exit 1; }

iptables -L DOCKER-USER -n >/dev/null 2>&1 || {
  echo "firewall: no DOCKER-USER chain — is Docker running?" >&2
  exit 1
}

# Drop this script's previous rules so a re-run converges instead of stacking another copy.
# By line number, not by rule spec: `iptables -S` renders a comment quoted on the legacy
# backend and bare on nft (1.8.7), so feeding its output back to `-D` matches on one backend
# and fails — fatally, under `set -e` — on the other.
while num=$(iptables -L DOCKER-USER -n --line-numbers | awk -v tag="$TAG" '$0 ~ tag { print $1; exit }')
      [ -n "$num" ]; do
  iptables -D DOCKER-USER "$num"
done

# Inserted at the head in reverse, so the final order is as listed here.
rules=(
  "-s $SUBNET -d 127.0.0.0/8 -j DROP"
  "-s $SUBNET -d 169.254.0.0/16 -j DROP"
  "-s $SUBNET -d 192.168.0.0/16 -j DROP"
  "-s $SUBNET -d 172.16.0.0/12 -j DROP"
  "-s $SUBNET -d 10.0.0.0/8 -j DROP"
  "-s $BROKER -j RETURN"
  "-m conntrack --ctstate RELATED,ESTABLISHED -j RETURN"
)
for rule in "${rules[@]}"; do
  # shellcheck disable=SC2086
  iptables -I DOCKER-USER 1 $rule -m comment --comment "$TAG"
done

echo "firewall: $TAG applied for $SUBNET (broker $BROKER)"
iptables -S DOCKER-USER | grep -- "$TAG" || true
