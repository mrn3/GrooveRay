# GrooveRay on Bitnami nginx

Use these configs with **Bitnami's nginx** (paths under `/opt/bitnami/nginx/`).

## 1. Copy the server blocks

On the server where Bitnami nginx is installed:

```bash
# From your GrooveRay repo (adjust path if needed)
sudo cp bitnami-nginx/grooveray-server-block.conf   /opt/bitnami/nginx/conf/server_blocks/
sudo cp bitnami-nginx/grooveray-https-server-block.conf /opt/bitnami/nginx/conf/server_blocks/
```

## 2. Optional: custom domain and SSL

- Edit both files and set `server_name` to your domain instead of `_` (e.g. `server_name yourdomain.com www.yourdomain.com;`).
- For HTTPS, Bitnami’s default certs are under `bitnami/certs/`. To use **Let’s Encrypt**, point `ssl_certificate` and `ssl_certificate_key` in the HTTPS file to your cert paths (e.g. `/etc/letsencrypt/live/yourdomain.com/fullchain.pem` and `.../privkey.pem`).

## 3. Restart nginx

```bash
sudo /opt/bitnami/ctlscript.sh restart nginx
```

## 4. CORS (if using a domain)

In `ecosystem.config.cjs`, set `CORS_ORIGIN` to your public URL (e.g. `https://yourdomain.com`), then:

```bash
pm2 restart grooveray
```

## Notes

- The app (PM2) must be listening on **port 3000**.
- If another Bitnami app is already the default server, remove `default_server` from one of the blocks or use different `server_name`s so both can coexist.
