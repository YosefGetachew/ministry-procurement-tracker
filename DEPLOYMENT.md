# PTS Git and Ministry Server Deployment

This guide deploys PTS in the same general pattern as FTMS: Git is the source of truth, PostgreSQL and the application run on the Ministry server, Nginx publishes one HTTPS domain, and only ports 80/443 are public.

## 1. Production architecture

```text
Users
  │ HTTPS: pts.moa.gov.et
  ▼
Host Nginx + Ministry SSL certificate
  │ 127.0.0.1:8081
  ▼
Frontend Nginx container ── /api/* ──► Node/Express container
                                           │
                                           ▼
                                    PostgreSQL container
```

PostgreSQL and the API have no public host port. The frontend container is bound only to server loopback. Host Nginx is the only public entry point.

## 2. Prepare and push the Git repository

The repository already has this remote:

```text
https://github.com/YosefGetachew/ministry-procurement-tracker.git
```

From PowerShell on the development computer:

```powershell
cd D:\OneDrive\projects\ministry-procurement-tracker
git status
npm --prefix frontend run test:calendar
npm --prefix frontend run build
node --check backend/server.js
docker compose --env-file .env.production.example -f docker-compose.production.yml config
```

Review the exact files that will be committed:

```powershell
git diff --stat
git diff
git status --short
```

Commit the feature branch and push it:

```powershell
git add .
git commit -m "Add production deployment and dual-calendar support"
git push -u origin claude/minister-dashboard-u9x3s8
```

Recommended: open a pull request on GitHub from `claude/minister-dashboard-u9x3s8` to `main`, review it, and merge it. Then synchronize the local main branch:

```powershell
git switch main
git pull --ff-only origin main
```

If the Ministry does not use pull requests, merge locally without rewriting history:

```powershell
git switch main
git pull --ff-only origin main
git merge --no-ff claude/minister-dashboard-u9x3s8
git push origin main
```

Never commit `.env.production`, passwords, database backups, SMTP credentials, or SSL private keys.

## 3. Ministry server prerequisites

Use a supported Linux server with:

- a static internal/public IP as required by Ministry IT;
- DNS record `pts.moa.gov.et` pointing to the server;
- Docker Engine with the Compose plugin;
- host Nginx;
- an approved Ministry SSL certificate, or Certbot if Ministry policy permits it;
- outbound SMTP access to the Ministry mail relay;
- inbound firewall access only for SSH administration, HTTP, and HTTPS.

Install Docker Engine and the Compose plugin from the official documentation rather than an unofficial package: [Docker Engine on Ubuntu](https://docs.docker.com/engine/install/ubuntu/) and [Docker Compose plugin](https://docs.docker.com/compose/install/linux/). Certbot behavior and renewal options are documented in the [official Certbot user guide](https://eff-certbot.readthedocs.io/en/stable/using.html).

Confirm the tools:

```bash
docker --version
docker compose version
nginx -v
git --version
```

## 4. Clone the approved main branch

Run as the deployment account, not as the application database user:

```bash
sudo mkdir -p /opt/moa
sudo chown "$USER":"$USER" /opt/moa
cd /opt/moa
git clone --branch main https://github.com/YosefGetachew/ministry-procurement-tracker.git
cd ministry-procurement-tracker
```

For a private GitHub repository, use the Ministry-approved deploy key or a read-only fine-grained token. Do not put a personal access token in the clone URL or shell history.

## 5. Create production secrets

```bash
cp .env.production.example .env.production
openssl rand -hex 48
openssl rand -base64 36
nano .env.production
chmod 600 .env.production
```

Set at minimum:

```dotenv
APP_URL=https://pts.moa.gov.et
APP_HTTP_PORT=8081
POSTGRES_DB=moa_procurement
POSTGRES_USER=moa_procurement_app
POSTGRES_PASSWORD=<the generated database password>
JWT_SECRET=<the 96-character hex value>
```

Also set the Ministry SMTP host, account, and password when automatic committee invitation email is required. `APP_URL` must exactly match the public HTTPS origin and must not end with `/`.

Validate the resolved Compose configuration. This detects missing variables before containers are changed:

```bash
docker compose --env-file .env.production -f docker-compose.production.yml config --quiet
```

## 6. First deployment

```bash
docker compose --env-file .env.production -f docker-compose.production.yml up -d --build
docker compose --env-file .env.production -f docker-compose.production.yml ps
docker compose --env-file .env.production -f docker-compose.production.yml logs --tail=100 backend
```

On an empty PostgreSQL volume, `backend/schema.sql` runs once automatically. It is not rerun when containers restart. Do not manually run `schema.sql` against a populated production database because it intentionally drops and recreates tables.

Check the application from the server:

```bash
curl --fail http://127.0.0.1:8081/healthz
curl --fail http://127.0.0.1:8081/api/health
```

The API response must report `"status":"ok"` and `"database":"connected"`.

## 7. Create the first administrator

Production does not run `seed.sql`; demo passwords are therefore not installed. Create the first administrator explicitly:

```bash
read -rsp "Temporary administrator password: " ADMIN_PASSWORD && echo
export ADMIN_PASSWORD
docker compose --env-file .env.production -f docker-compose.production.yml exec \
  -e ADMIN_NAME="PTS System Administrator" \
  -e ADMIN_EMAIL="admin@moa.gov.et" \
  -e ADMIN_PASSWORD \
  backend npm run bootstrap-admin
unset ADMIN_PASSWORD
```

The account is forced to change the temporary password at first login. Use a unique temporary password of at least 12 characters and transmit it through an approved secure channel.

## 8. Publish through host Nginx

Copy the bootstrap virtual host and enable it:

```bash
sudo cp deploy/nginx/pts-http.conf /etc/nginx/sites-available/pts
sudo ln -s /etc/nginx/sites-available/pts /etc/nginx/sites-enabled/pts
sudo nginx -t
sudo systemctl reload nginx
```

Verify DNS and HTTP before requesting the certificate:

```bash
curl -I http://pts.moa.gov.et/healthz
```

If Ministry policy permits Let's Encrypt/Certbot:

```bash
sudo certbot --nginx -d pts.moa.gov.et
sudo certbot renew --dry-run
```

If Ministry IT supplies a certificate, configure its certificate and private-key paths in the host Nginx TLS server block instead. The private key must remain readable only by the approved system account. Redirect HTTP to HTTPS after certificate activation.

Final checks:

```bash
curl --fail https://pts.moa.gov.et/healthz
curl --fail https://pts.moa.gov.et/api/health
```

Then sign in with the bootstrap administrator, change the password, configure sectors/funding sources/leadership, and create normal user accounts.

## 9. Back up PostgreSQL

Create a backup directory outside Git:

```bash
mkdir -p backups
chmod 700 backups
docker compose --env-file .env.production -f docker-compose.production.yml exec -T postgres \
  sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' \
  > "backups/pts-$(date +%F-%H%M).backup"
```

Copy encrypted backups to a separate Ministry-approved backup server. Schedule this command nightly and test restoration regularly; an untested backup is not a recovery plan.

Restore only during an approved outage because this replaces current data:

```bash
docker compose --env-file .env.production -f docker-compose.production.yml stop backend
cat backups/pts-YYYY-MM-DD-HHMM.backup | \
  docker compose --env-file .env.production -f docker-compose.production.yml exec -T postgres \
  sh -c 'pg_restore --clean --if-exists -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
docker compose --env-file .env.production -f docker-compose.production.yml start backend
```

## 10. Deploy an update

Back up first, then deploy only reviewed code from `main`:

```bash
cd /opt/moa/ministry-procurement-tracker
git fetch origin
git status --short
git pull --ff-only origin main
docker compose --env-file .env.production -f docker-compose.production.yml build --pull
docker compose --env-file .env.production -f docker-compose.production.yml up -d
docker compose --env-file .env.production -f docker-compose.production.yml ps
curl --fail https://pts.moa.gov.et/api/health
```

If a release includes a new migration, back up first and apply only that reviewed migration file with `psql`. Do not reapply `schema.sql`.

## 11. Operations and troubleshooting

```bash
# Service state
docker compose --env-file .env.production -f docker-compose.production.yml ps

# Recent API logs
docker compose --env-file .env.production -f docker-compose.production.yml logs --tail=200 backend

# Follow logs
docker compose --env-file .env.production -f docker-compose.production.yml logs -f backend frontend

# Restart only the API
docker compose --env-file .env.production -f docker-compose.production.yml restart backend

# Database health from inside PostgreSQL
docker compose --env-file .env.production -f docker-compose.production.yml exec postgres \
  sh -c 'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
```

Common causes:

| Symptom | Check |
|---|---|
| Login returns 500 | API logs, PostgreSQL health, and whether the schema initialized |
| Login succeeds but cookie is absent | HTTPS is active, `APP_URL` matches the browser origin, and host Nginx sends `X-Forwarded-Proto` |
| `/api/*` returns 502 | Backend container health and frontend Nginx proxy |
| Browser displays old JavaScript | Rebuild frontend image and hard-refresh; assets are content-hashed |
| Invitation email is not delivered | SMTP variables, relay firewall, sender authorization, and backend logs |
| Compose reports a missing variable | Complete `.env.production` and rerun `config --quiet` |

## 12. Production security checklist

- [ ] Repository is private or approved for public release.
- [ ] `.env.production` is mode `600` and absent from Git.
- [ ] Unique long database and JWT secrets are installed.
- [ ] No demo seed accounts exist in production.
- [ ] Administrator changed the temporary password.
- [ ] Only 80/443 (and restricted SSH) are open externally.
- [ ] PostgreSQL and backend ports are not published.
- [ ] HTTPS and certificate renewal are monitored.
- [ ] SMTP uses the Ministry-approved relay and credentials.
- [ ] Nightly encrypted backups are copied off-server.
- [ ] Restore testing and update/rollback responsibilities are assigned.
