# Patient, Clinic Owner and Consultant apps on the web

The three mobile apps also run in a browser (React Native for Web, the same code as on phones). They are
published like the reception web app: static files served by nginx, talking to the same API.

| App | Address | Source | Built files |
| --- | --- | --- | --- |
| Patient | `https://dentorpatient.localappstore.in` | `mobile/apps/patient` | `mobile/apps/patient/dist-web/` |
| Clinic Owner | `https://dentorowner.localappstore.in` | `mobile/apps/owner` | `mobile/apps/owner/dist-web/` |
| Consultant | `https://dentorconsultant.localappstore.in` | `mobile/apps/consultant` | `mobile/apps/consultant/dist-web/` |

Unchanged: the reception web app and Super Admin console (`https://dentor.localappstore.in`) and the API
(`https://dentorapi.localappstore.in`).

## What works differently in a browser

- Fingerprint / face sign-in and push notifications are phone-only; notifications still appear inside the app.
- Photos and files are chosen with the browser's file picker.
- The session is kept in the browser's local storage (as in the reception web app); "Log out" removes it.
- There is no "install" prompt: these are plain websites.

## 0. Before you start

- **The API goes first.** The web apps call the same endpoints as the phone apps (patient portal, owner,
  consultant, account deletion). Deploy the backend from this release (`DEPLOYMENT_RUNBOOK.md`) before
  publishing them; on the old backend they load but sign-in and most screens fail.
- **Upload size.** If `DEPLOYMENT_RUNBOOK.md` finding F1 is not fixed yet, add `client_max_body_size 16m;` to the
  `dentorapi.localappstore.in` HTTPS server block, then `sudo nginx -t && sudo systemctl reload nginx`.
  Without it, photos and files over about 0.7 MB fail with 413, in the browser as on phones.

## Building on the server instead (git checkout at /var/www/dentor)

The server builds the reception web app in place (`frontend/dist`). The three apps can be built and served
the same way, with no copying. In that case, skip steps 1 and 4 and use these nginx roots in step 2:
`/var/www/dentor/mobile/apps/{patient,owner,consultant}/dist-web`.

```sh
cd /var/www/dentor && git pull origin main          # after the release is committed and pushed
node -v                                             # 22.11 or newer
df -h /var/www                                      # the install needs about 1.5 GB
cd /var/www/dentor/mobile
npm ci
DENTOR_API_URL=https://dentorapi.localappstore.in npm run build:web
grep -l "dentorapi.localappstore.in" apps/*/dist-web/assets/*.js   # one file per app
```

Each release: `git pull`, then `npm ci` and the build. No restart is needed. During the build, each app
is blank for a few seconds. To roll back, check out the previous commit and build again.

## 1. Build (on the Mac) 🟢 local only

```sh
cd ~/Documents/Projects/Dentor/mobile
DENTOR_API_URL=https://dentorapi.localappstore.in npm run build:web     # all three → apps/<app>/dist-web
grep -l "dentorapi.localappstore.in" apps/*/dist-web/assets/*.js            # must list one file per app
```

`DENTOR_API_URL` is required: without it the build talks to `http://localhost:8000`.

## 2. DNS and certificates (you, once) 🔴 production

1. At your DNS provider, add three **A** records pointing to the server (163.227.186.66):
   `dentorpatient`, `dentorowner`, `dentorconsultant` (under `localappstore.in`).
2. On the server, once the names resolve (`dig +short dentorpatient.localappstore.in`):

```sh
sudo mkdir -p /var/www/dentor-apps/patient /var/www/dentor-apps/owner /var/www/dentor-apps/consultant
```

3. nginx: one file, `/etc/nginx/sites-available/dentor-apps` (then `sudo ln -s ../sites-available/dentor-apps /etc/nginx/sites-enabled/`):

```nginx
# Patient, Clinic Owner and Consultant web apps (docs/WEB_APPS.md)
server {
    listen 80;
    server_name dentorpatient.localappstore.in;
    root /var/www/dentor-apps/patient;
    include /etc/nginx/snippets/dentor-app.conf;
}
server {
    listen 80;
    server_name dentorowner.localappstore.in;
    root /var/www/dentor-apps/owner;
    include /etc/nginx/snippets/dentor-app.conf;
}
server {
    listen 80;
    server_name dentorconsultant.localappstore.in;
    root /var/www/dentor-apps/consultant;
    include /etc/nginx/snippets/dentor-app.conf;
}
```

   and `/etc/nginx/snippets/dentor-app.conf`:

```nginx
index index.html;
# The apps use real URL paths (e.g. /appointments): unknown paths get the app, which opens the right screen.
location / {
    try_files $uri $uri/ /index.html;
    add_header Cache-Control "no-cache";
}
# Built files carry a content hash in their names: cache them for a year.
location /assets/ {
    try_files $uri =404;
    add_header Cache-Control "public, max-age=31536000, immutable";
}
```

4. Check and load, then add HTTPS with the same certbot you used for the other Dentor sites:

```sh
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d dentorpatient.localappstore.in -d dentorowner.localappstore.in -d dentorconsultant.localappstore.in
```

## 3. Let the API accept the three sites 🔴 production (restart)

The API only answers browsers from the sites in `CORS_ORIGINS` (comma-separated). Add the three addresses to
the existing value in `/var/www/dentor/backend/.env`, keeping `https://dentor.localappstore.in`:

```
CORS_ORIGINS=https://dentor.localappstore.in,https://dentorpatient.localappstore.in,https://dentorowner.localappstore.in,https://dentorconsultant.localappstore.in
```

```sh
sudo cp -p /var/www/dentor/backend/.env /var/www/dentor/backend/.env.bak-$(date +%Y%m%d-%H%M)
sudo nano /var/www/dentor/backend/.env          # edit the CORS_ORIGINS line
sudo systemctl restart dentor-api.service && sleep 3 && systemctl is-active dentor-api.service
curl -s -o /dev/null -w '%{http_code}\n' -H 'Origin: https://dentorpatient.localappstore.in' -X OPTIONS \
  -H 'Access-Control-Request-Method: POST' https://dentorapi.localappstore.in/api/patient/auth/login   # 200
```

Phones need no entry: CORS applies to browsers only.

## 4. Upload (each release) 🟡 server files

```sh
# Mac
cd ~/Documents/Projects/Dentor/mobile
for app in patient owner consultant; do
  rsync -av --delete apps/$app/dist-web/ root@163.227.186.66:/tmp/dentor-$app-web/
done
# server: keep the previous release (skip on the first deploy), then publish
REL=/var/www/dentor-apps.bak-$(date +%Y%m%d-%H%M)
sudo cp -a /var/www/dentor-apps "$REL"
for app in patient owner consultant; do
  sudo rsync -a --delete /tmp/dentor-$app-web/ /var/www/dentor-apps/$app/
done
```

No restart is needed for new files. Open browsers pick up the new release on their next page load
(`index.html` is served uncached). One app can be published on its own: run the loops with only its name.

**Roll back:** `sudo rsync -a --delete "$REL"/<app>/ /var/www/dentor-apps/<app>/` (no restart).

## 5. Check

| Open | Expect |
| --- | --- |
| `https://dentorpatient.localappstore.in` | the Dentor welcome screen; log in works (test login or real) |
| `https://dentorowner.localappstore.in` | the Clinic Owner sign-in; the owner login works |
| `https://dentorconsultant.localappstore.in` | the Consultant sign-in |
| any app, reload on an inner page | the same page opens again (not a 404) |
| browser console | no "CORS" errors (if there are, step 3 was not applied or the API was not restarted) |
