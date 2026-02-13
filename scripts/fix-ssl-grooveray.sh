#!/bin/bash
# Fix SSL for grooveray.funkpad.com on Bitnami Apache
# Run on server: sudo bash fix-ssl-grooveray.sh
# Optional: set LEC_EMAIL=your@email.com before running (for Let's Encrypt)

set -e
DOMAIN="grooveray.funkpad.com"
WEBROOT="/opt/bitnami/apache/htdocs"
EMAIL="${LEC_EMAIL:-admin@funkpad.com}"
APACHE_CONF="/opt/bitnami/apache2/conf/bitnami/bitnami-ssl.conf"
CERTS_DIR="/opt/bitnami/apache2/conf/bitnami/certs"

echo "=== Fixing SSL for $DOMAIN ==="

# 1. Install certbot if missing (wait for apt lock)
for i in 1 2 3 4 5 6 7 8 9 10; do
  if sudo apt-get install -y certbot 2>/dev/null; then break; fi
  echo "Waiting for apt lock (attempt $i)..."; sleep 30
done

# 2. Obtain certificate (webroot - no need to stop Apache)
sudo certbot certonly --webroot -w "$WEBROOT" -d "$DOMAIN" \
  --non-interactive --agree-tos -m "$EMAIL" --force-renewal

# 3. Copy certs to Bitnami location (certbot uses /etc/letsencrypt/live/DOMAIN/)
sudo cp /etc/letsencrypt/live/"$DOMAIN"/fullchain.pem "$CERTS_DIR/tls.crt"
sudo cp /etc/letsencrypt/live/"$DOMAIN"/privkey.pem "$CERTS_DIR/tls.key"
sudo chown root:root "$CERTS_DIR/tls.crt" "$CERTS_DIR/tls.key"
sudo chmod 644 "$CERTS_DIR/tls.crt"
sudo chmod 600 "$CERTS_DIR/tls.key"

# 4. Restart Apache
sudo /opt/bitnami/ctlscript.sh restart apache

echo "=== Done. Test https://$DOMAIN ==="
