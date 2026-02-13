# SSL for grooveray.com (Bitnami)

## Why bncert fails with "TLS-ALPN-01" / "Error getting validation data"

- **bncert** uses Bitnami’s **lego** and often picks the **TLS-ALPN-01** challenge.
- TLS-ALPN-01 needs **port 443** for a special TLS handshake. Apache is already using 443, so lego can’t complete the challenge.
- If you **stop Apache** and run lego with `--tls`, Let’s Encrypt may still get **"Error getting validation data"** when the domain is behind a **proxy** (e.g. Cloudflare). Validation only works when **traffic to your domain hits this server directly** (no proxy on 80/443).

## What to do

1. **Make the domain point straight at this server (no proxy)**  
   - In Cloudflare: set the record for `grooveray.com` to **DNS only** (grey cloud).  
   - Ensure port 80 (and 443 if you use TLS-ALPN) reaches this machine.

2. **Option A – Use lego with HTTP-01 (recommended)**  
   - On the server: `sudo bash /path/to/ssl-with-lego.sh`  
   - This uses **HTTP-01** only (no TLS-ALPN-01), so Apache can stay on 443.  
   - Requires `http://grooveray.com` to reach this server (see step 1).

3. **Option B – Use certbot (existing script)**  
   - On the server: `sudo bash fix-ssl-grooveray.sh`  
   - Same requirement: HTTP to your domain must hit this server.

4. **Option C – Use bncert interactively**  
   - After step 1, you can run `sudo /opt/bitnami/bncert-tool` and answer the prompts.  
   - If it still uses TLS-ALPN-01 and fails, use Option A instead.

After the cert is issued you can turn the proxy back on (e.g. orange cloud in Cloudflare) if you want.
