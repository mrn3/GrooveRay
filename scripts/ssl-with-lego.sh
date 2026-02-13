#!/bin/bash
# Obtain Let's Encrypt cert using Bitnami's lego (avoids bncert TLS-ALPN-01 failure).
# Use this when bncert fails with "TLS-ALPN-01" or "Error getting validation data".
#
# Prerequisite: http://grooveray.funkpad.com must reach THIS server (no proxy).
#   - If using Cloudflare: set DNS to "DNS only" (grey cloud) for grooveray.funkpad.com.
#
# Run on server: sudo bash ssl-with-lego.sh

set -e
DOMAIN="grooveray.funkpad.com"
EMAIL="${LEC_EMAIL:-mattrobertnewman@gmail.com}"
LEGO_PATH="/opt/bitnami/letsencrypt"
WEBROOT="/opt/bitnami/apache/htdocs"
CERTS_DIR="/opt/bitnami/apache2/conf/bitnami/certs"

echo "=== SSL with lego (HTTP-01) for $DOMAIN ==="
echo "Ensure $DOMAIN points to this server and is not behind a proxy."
if [[ -z "${SKIP_SSL_CONFIRM:-}" ]]; then
  read -p "Continue? [y/N] " -n 1 -r; echo
  if [[ ! $REPLY =~ ^[yY]$ ]]; then exit 0; fi
fi

sudo mkdir -p "$WEBROOT/.well-known/acme-challenge"
sudo chown -R bitnami:root "$WEBROOT/.well-known"

# Use HTTP-01 only (no TLS-ALPN-01) so Apache can stay on 443
sudo "$LEGO_PATH/lego" \
  --path "$LEGO_PATH" \
  --email "$EMAIL" \
  --domains "$DOMAIN" \
  --accept-tos \
  --http \
  --http.webroot "$WEBROOT" \
  run

# Lego writes to $LEGO_PATH/certificates/$DOMAIN.crt and .key
sudo cp "$LEGO_PATH/certificates/$DOMAIN.crt" "$CERTS_DIR/tls.crt"
sudo cp "$LEGO_PATH/certificates/$DOMAIN.key" "$CERTS_DIR/tls.key"
sudo chown root:root "$CERTS_DIR/tls.crt" "$CERTS_DIR/tls.key"
sudo chmod 644 "$CERTS_DIR/tls.crt"
sudo chmod 600 "$CERTS_DIR/tls.key"

sudo /opt/bitnami/ctlscript.sh restart apache
echo "=== Done. Test https://$DOMAIN ==="
