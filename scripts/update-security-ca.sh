#!/bin/sh
# Keep OpenSSL clients and build tools on the refreshed, distrusted CA store.
set -eu
apt-get update
# Install the generated Node runtime dependency before the final CA cleanup.
# deploy.aptPackages stays empty so no later package layer can restore CA links.
apt-get install -y --no-install-recommends ca-certificates libatomic1
sed -i -e 's|^mozilla/emSign_ECC_Root_CA_-_G3.crt|!&|' -e 's|^mozilla/Comodo_AAA_Services_root.crt|!&|' /etc/ca-certificates.conf
update-ca-certificates --fresh
# Fail the image build if either distrusted root remains in the legacy store.
for certificate in emSign_ECC_Root_CA_-_G3 Comodo_AAA_Services_root; do
  # Retained lower-image files must stay harmless if old hash aliases reappear.
  printf '%s\n' '# Distrusted security root; marker prevents lower-image certificate data from restoring trust.' > "/usr/share/ca-certificates/mozilla/$certificate.crt"
  test ! -e "/etc/ssl/certs/$certificate.pem"
done
ca_directory=/usr/local/share/security-ca/certs
rm -rf "$ca_directory"
mkdir -p "$ca_directory"
awk -v ca_directory="$ca_directory" '/-----BEGIN CERTIFICATE-----/ { n++; f=sprintf("%s/root-%03d.pem", ca_directory, n) } f != "" { print > f } /-----END CERTIFICATE-----/ { close(f); f="" }' /etc/ssl/certs/ca-certificates.crt
openssl rehash "$ca_directory"
