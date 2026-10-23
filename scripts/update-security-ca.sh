#!/bin/sh
# Keep OpenSSL clients and build tools on the refreshed, distrusted CA store.
set -eu
apt-get update
apt-get install -y --no-install-recommends ca-certificates
sed -i -e 's|^mozilla/emSign_ECC_Root_CA_-_G3.crt|!&|' -e 's|^mozilla/Comodo_AAA_Services_root.crt|!&|' /etc/ca-certificates.conf
update-ca-certificates --fresh
ca_directory=/usr/local/share/security-ca/certs
mkdir -p "$ca_directory"
awk -v ca_directory="$ca_directory" '/-----BEGIN CERTIFICATE-----/ { n++; f=sprintf("%s/root-%03d.pem", ca_directory, n) } f != "" { print > f } /-----END CERTIFICATE-----/ { close(f); f="" }' /etc/ssl/certs/ca-certificates.crt
openssl rehash "$ca_directory"
