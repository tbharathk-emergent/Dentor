# Step 3 runbook: deploying the backend and web app to production

For the person who runs the commands on the production server. Prepared on 15 October 2026;
**nothing here has been run**. Each phase needs the owner's approval before it starts. Background:
[`DEPLOYMENT_CHECKLIST.md`](DEPLOYMENT_CHECKLIST.md) sections C and D, and
[`BUILD_AND_DEPLOYMENT_GUIDE.md`](BUILD_AND_DEPLOYMENT_GUIDE.md) section 10.

| Mark | Meaning |
| --- | --- |
| 🟢 READ-ONLY | reads only; changes nothing on the server, in the database or for users |
| 🟡 SERVER FILES | writes files on the server (backups, staging copies) but does not change what users get |
| 🔴 CHANGES PRODUCTION | changes the running API or web app, or the database |

## What is known and what is not

| Known (verified from outside, read-only, 15 Oct) | Unknown (must be read on the server, phase 0) |
| --- | --- |
| Web `https://dentor.localappstore.in` and API `https://dentorapi.localappstore.in` on one server, 163.227.186.66, Ubuntu, nginx 1.24 | how the API is started (systemd service name, or pm2 / supervisor / docker), its user |
| HTTPS certificate for both names, valid until 6 Jan 2027 | the backend folder on the server, and whether it is a git checkout |
| The live API is the **old** backend (`/api/clinic-app/*` → 404); health is ok | the Python interpreter / virtualenv it uses |
| CORS allows the web origin; `index.html` and `sw.js` are not cached; client routes work | where the environment file is and which variable names it has |
| The new backend needs **no new Python packages** (`pyproject.toml`, `uv.lock`, `requirements.txt` unchanged since 211c0d2) and **removes no files** | the web root folder, nginx's server blocks |
| At start-up the new backend only adds indexes and new collections, fills `expires_at` on notifications (a collection the old backend does not have), and refuses to start with an unsafe production setting (same checks as the old one) | where MongoDB runs, whether `mongodump` / `mongosh` are installed, free disk space |

Nothing below guesses those unknowns: they are variables filled in at phase 0.

## Phase 0 results (run by the owner, 16 October 2026)

| Item | Verified value | Notes |
| --- | --- | --- |
| Service | `dentor-api.service` (systemd), active, `Restart=always`, runs as **root** | the server also runs 12 other projects' APIs; nothing here touches them |
| Start command | `/var/www/dentor/backend/venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8012 --workers 4` | port 8012 is **not** reachable from the internet (checked); uvicorn trusts nginx's forwarded address by default |
| Code | `/var/www/dentor/backend`, inside the git checkout `/var/www/dentor` at commit **211c0d2** (the same commit this repository is based on); only change: untracked `frontend/yarn.lock` | the new release is 211c0d2 plus 863 uncommitted paths on the Mac |
| Python | `/var/www/dentor/backend/venv` (named `venv`, not `.venv`), Python 3.12.3 | the new backend needs no new packages, so this virtualenv is reused |
| Settings | `/var/www/dentor/backend/.env`, plain `KEY=value` (0 other lines): `CORS_ORIGINS`, `DB_NAME`, `DENTOR_ENV`, `JWT_SECRET`, `MONGO_URL`, `SEED_DEMO`, `SUPER_ADMIN_EMAIL`, `SUPER_ADMIN_PASSWORD`; unit adds `PYTHONUNBUFFERED` | `DENTOR_ENV=production`, `DB_NAME=dentor`, `SEED_DEMO=0`, `CORS_ORIGINS=https://dentor.localappstore.in`; no email / SMS / push settings yet |
| Database | MongoDB on `localhost:27017`, `mongod` active; `mongodump`, `mongorestore`, `mongosh` installed (database tools 100.17.0) | — |
| Web root | `/var/www/dentor/frontend/dist` (nginx `server_name dentor.localappstore.in`) | no `/api` proxy on the web domain: `https://dentor.localappstore.in/api/…` returns the web page (the web app calls `dentorapi` directly, so nothing depends on it) |
| API proxy | `dentorapi.localappstore.in` → `http://127.0.0.1:8012`, with `Host`, `X-Real-IP`, `X-Forwarded-For`, `X-Forwarded-Proto` | **no `client_max_body_size`**: nginx's default 1 MB applies; a 2 MB request got `413` (checked) |
| Disk | 59 GB free on `/` (96 GB, 36 % used) | plenty for a backup |

### Findings to decide on (each is a production change; none is needed to deploy)

| # | Finding | Effect today | Suggested change |
| --- | --- | --- | --- |
| F1 | nginx limits API requests to 1 MB | patient files and photos over about 0.7 MB (base64) fail with 413; the apps allow up to 5 MB | add `client_max_body_size 16m;` to the `dentorapi.localappstore.in` HTTPS server block, `sudo nginx -t`, `sudo systemctl reload nginx` |
| F2 | `backend/.env` is world-readable (`-rw-r--r--`) | any account on this shared server can read `JWT_SECRET`, `SUPER_ADMIN_PASSWORD` and `MONGO_URL` | `sudo chmod 600 /var/www/dentor/backend/.env` (the service runs as root, so it still reads it) |
| F3 | `--workers 4` | sign-in rate limits are kept per worker, so up to 4× looser; scheduled offers are safe (each is claimed once) | optional: `--workers 1` in the unit (`systemctl edit`), then `daemon-reload` and restart |

## Variables (from phase 0; type them in the server shell)

```sh
DATE=$(date +%Y%m%d-%H%M)
SERVICE=dentor-api.service
REPO_DIR=/var/www/dentor
APP_DIR=/var/www/dentor/backend
ENV_FILE=/var/www/dentor/backend/.env
PYTHON=/var/www/dentor/backend/venv/bin/python
WEB_ROOT=/var/www/dentor/frontend/dist
BACKUP_DIR=/var/backups/dentor           # outside the git checkout; 59 GB free on /
STAGE=/root/dentor-release-$DATE         # the service and the files are root's
```

## Phase 0: discover the server (you run it) 🟢 READ-ONLY

Every command only reads. None prints a secret value: environment variables, `.env` files and the MongoDB
address are reduced to **names** or a **host** before they are shown. Still glance over the output before
sharing it, and leave out anything that looks like a password, token or key.

### 0a. Find how the API runs

```sh
systemctl list-units --type=service --all --no-pager | grep -iE 'dentor|uvicorn|gunicorn|fastapi'
ps -eo user,args | grep -E 'uvicorn|gunicorn|app\.main' | grep -v grep | cut -c1-200
command -v pm2 >/dev/null && pm2 ls        # only lists process names and states
command -v docker >/dev/null && docker ps --format '{{.Names}}  {{.Image}}  {{.Status}}'
```

If `ps` shows a command line with something that looks like a password, do not share that line.

### 0b. Details of the service (set SVC to the unit found in 0a)

```sh
SVC=<unit name from 0a, e.g. dentor-api.service>

# how it is started, where, as whom: these properties carry no environment values
systemctl show "$SVC" -p ExecStart -p WorkingDirectory -p EnvironmentFiles -p User -p Group \
  -p ActiveState -p SubState -p Restart --no-pager

# environment variables set inside the unit: NAMES only
systemctl cat "$SVC" --no-pager | grep -E '^[[:space:]]*Environment=' | grep -oE '[A-Z_][A-Z0-9_]*=' | sed 's/=$//' | sort -u
```

### 0c. The backend folder and its settings file (set the paths from 0b)

```sh
APP=<WorkingDirectory from 0b>
ENVF=<EnvironmentFiles path from 0b, or $APP/.env>

ls -la "$APP"
ls -la "$APP/.venv/bin/python" 2>/dev/null
git -C "$APP" log -1 --format='%h %ci %s' 2>/dev/null          # live commit, if it is a git checkout
git -C "$APP" status --porcelain 2>/dev/null | head -20        # local changes on the server, if any

# variable NAMES in the settings file only (no values, no comments)
sudo grep -E '^[[:space:]]*(export[[:space:]]+)?[A-Za-z_][A-Za-z0-9_]*[[:space:]]*=' "$ENVF" | sed -E 's/^[[:space:]]*(export[[:space:]]+)?([A-Za-z_][A-Za-z0-9_]*).*/\2/' | sort

# is the settings file plain KEY=value lines? (needed for "set -a; . file" in later phases)
sudo grep -vE '^[[:space:]]*(#|$)' "$ENVF" | grep -cvE '^[[:space:]]*(export[[:space:]]+)?[A-Za-z_][A-Za-z0-9_]*=' | sed 's/^/lines that are not KEY=value: /'

# a few non-secret values
sudo grep -E '^[[:space:]]*(DENTOR_ENV|DB_NAME|SEED_DEMO|CORS_ORIGINS)[[:space:]]*=' "$ENVF"
# the database HOST only: user name, password and options removed
sudo grep -E '^[[:space:]]*MONGO_URL[[:space:]]*=' "$ENVF" | sed -E 's#^[^=]*=[\"'\'' ]*(mongodb(\+srv)?://)([^@/]*@)?([^/?\"'\'' ]+).*#MONGO host: \1\4#'
```

### 0d. Python, web root, proxy, MongoDB tools, disk

```sh
<the python path in ExecStart, e.g. "$APP/.venv/bin/python"> --version

# dentor server blocks: names, roots, proxy targets, body limit, forwarded-address headers only
sudo nginx -T 2>/dev/null | grep -nE 'server_name|^[[:space:]]*root |proxy_pass|client_max_body_size|proxy_set_header[[:space:]]+(Host|X-Real-IP|X-Forwarded-For|X-Forwarded-Proto)' \
  | grep -vE 'ssl_|auth'

# MongoDB: running locally? tools installed?
systemctl is-active mongod 2>/dev/null; ps -eo comm | grep -c '^mongod$' | sed 's/^/local mongod processes: /'
command -v mongodump mongorestore mongosh; mongodump --version 2>/dev/null | head -1

# disk: the root disk and where backups would go
df -h / /var 2>/dev/null
```

### 0e. (Optional) Database size, for the backup disk space 🟢 READ-ONLY

Loads the settings file into this shell without printing it, then asks MongoDB for sizes only.

```sh
set -a; . "$ENVF"; set +a
mongosh "$MONGO_URL" --quiet --eval "const s=db.getSiblingDB(process.env.DB_NAME).stats(1024*1024); print('collections', s.collections, ' dataMB', Math.round(s.dataSize), ' storageMB', Math.round(s.storageSize))"
exit    # close this shell afterwards so the loaded values do not stay in it
```

Skip 0e if the settings file is not plain `KEY=value` lines (see 0c).

### What to send back

The output of 0a–0e, after checking it holds no secret. From it the runbook's variables are filled in:
`SERVICE`, `APP_DIR`, `ENV_FILE`, `PYTHON`, `WEB_ROOT`, MongoDB location and tools, free disk.

## Phase 1: get the new code to the server (choose one)

The server's folder is a git checkout at 211c0d2, so the cleanest route is git.

**G. Git (recommended: traceable, and the server checkout stays clean).** Needs your approval to **commit
and push** (on the Mac), then 🟡 a fetch on the server, which does not change the live files:

```sh
# Mac (only after you approve the commit and push)
cd ~/Documents/Projects/Dentor && git status --short | grep -E 'signing\.properties|\.jks|\.env$'   # must print nothing
git add -A && git commit -m "<message>" && git push origin main
# server 🟡: download the new commit; the live working tree is not changed yet
cd /var/www/dentor && git status --porcelain          # expect only: ?? frontend/yarn.lock
git fetch origin && git log --oneline HEAD..origin/main | head
```

**C. Copy (no commit).** 🟢 on the Mac, 🟡 on the server. The server checkout will then show modified files
until the changes are committed; a later `git pull` there needs care.

```sh
# Mac
mkdir -p ~/Documents/Projects/Dentor-releases/server-$(date +%Y%m%d)
tar -czf ~/Documents/Projects/Dentor-releases/server-$(date +%Y%m%d)/dentor-backend.tar.gz \
  --exclude='.venv' --exclude='venv' --exclude='__pycache__' --exclude='.pytest_cache' --exclude='.env' --exclude='tests' \
  -C backend .
scp ~/Documents/Projects/Dentor-releases/server-$(date +%Y%m%d)/dentor-backend.tar.gz root@163.227.186.66:/root/
```

**Web app (both methods):** `frontend/dist` is not in git; the server's copy was built there. Send the
build made on the Mac (15 Oct 14:57, after the last web change, talks to `dentorapi.localappstore.in`):

```sh
cd ~/Documents/Projects/Dentor && grep -l dentorapi.localappstore.in frontend/dist/assets/*.js   # must print a file
tar -czf ~/Documents/Projects/Dentor-releases/dentor-web-$(date +%Y%m%d).tar.gz -C frontend/dist .
scp ~/Documents/Projects/Dentor-releases/dentor-web-$(date +%Y%m%d).tar.gz root@163.227.186.66:/root/dentor-web.tar.gz
```

## Phase 2: back up the database (you run it) 🟡 SERVER FILES (reads the database)

```sh
sudo mkdir -p "$BACKUP_DIR" && sudo chown "$USER" "$BACKUP_DIR"
set -a; . "$ENV_FILE"; set +a          # loads MONGO_URL and DB_NAME without printing them
                                       # (check the file is plain KEY=value lines first)
mongodump --uri="$MONGO_URL" --db="$DB_NAME" --gzip --archive="$BACKUP_DIR/dentor-$DATE.archive.gz"
```

## Phase 3: verify the backup 🟢 READ-ONLY

```sh
ls -lh "$BACKUP_DIR/dentor-$DATE.archive.gz"                 # not empty
mongorestore --uri="$MONGO_URL" --gzip --archive="$BACKUP_DIR/dentor-$DATE.archive.gz" \
  --nsInclude="$DB_NAME.*" --dryRun -v 2>&1 | tail -20    # --dryRun: reads the archive, writes nothing
mongosh "$MONGO_URL" --quiet --eval "const d=db.getSiblingDB('$DB_NAME'); d.getCollectionNames().sort().forEach(c=>print(c, d[c].countDocuments()))"
```

The collection list in the dry run must match the `mongosh` list. Copy the archive off the server
(from the Mac): `scp <user>@<server>:"$BACKUP_DIR/dentor-<DATE>.archive.gz" ~/Documents/Projects/Dentor-backups/`.

## Phase 4: stage the new code and run the upgrade check 🟡 / 🟢

```sh
mkdir -p "$STAGE/web"                                                            # 🟡
git -C "$REPO_DIR" archive origin/main backend | tar -x -C "$STAGE"             # 🟡 method G: the fetched commit
# method C instead: mkdir -p "$STAGE/backend" && tar -xzf /root/dentor-backend.tar.gz -C "$STAGE/backend"
tar -xzf /root/dentor-web.tar.gz -C "$STAGE/web"                                 # 🟡
cd "$STAGE/backend"
set -a; . "$ENV_FILE"; set +a                                                     # production settings, not printed
DENTOR_ENV=production "$PYTHON" -m app.preflight; echo "preflight exit $?"       # 🟢 READ-ONLY
```

`app.preflight` only reads (`find`, `find_one`, `count_documents`). Exit 0 = go; 1 = fix every
"FIX FIRST" line before phase 5; 2 = the database could not be read. Send back the report (it contains clinic
names and login counts, no passwords).

## Phase 5: deploy the backend 🔴 CHANGES PRODUCTION (separate approval)

```sh
sudo mkdir -p "$BACKUP_DIR"
sudo cp -a "$APP_DIR" "$BACKUP_DIR/backend-code-$DATE"          # rollback copy, outside the checkout (🟡)

# method G
cd "$REPO_DIR" && sudo git pull --ff-only origin main             # 🔴 new code in place (the running API is not affected until the restart)
# method C instead:
# sudo rsync -a --exclude='.env' --exclude='venv' --exclude='.venv' --exclude='__pycache__' --exclude='tests' "$STAGE/backend/" "$APP_DIR/"

sudo systemctl restart "$SERVICE"                                  # 🔴 a few seconds' interruption
sleep 5; systemctl is-active "$SERVICE"
sudo journalctl -u "$SERVICE" -n 60 --no-pager
```

- The virtualenv `venv`, `.env` and the unit file are not touched; no package is installed.
- Users signed in before the restart stay signed in (same `JWT_SECRET`).
- If the service does not become `active`, or the journal shows a start-up error, go to rollback.

## Phase 6: backend smoke tests 🟢 READ-ONLY (except the sign-ins, which only create a session)

```sh
curl -s https://dentorapi.localappstore.in/api/health                                         # {"ok":true}
curl -s -o /dev/null -w '%{http_code}\n' https://dentorapi.localappstore.in/api/clinic-app/patients   # 401 (was 404): new backend live
curl -s -o /dev/null -w '%{http_code}\n' https://dentorapi.localappstore.in/api/patient/me            # 401
curl -s -o /dev/null -w '%{http_code}\n' -X OPTIONS -H 'Origin: https://dentor.localappstore.in' \
  -H 'Access-Control-Request-Method: POST' https://dentorapi.localappstore.in/api/auth/login    # 200 (CORS)
sudo journalctl -u "$SERVICE" --since "10 min ago" --no-pager | grep -iE 'error|traceback' | head
```

By hand: the **current** web app still works (it was tested against the new backend locally, 7 / 7): an
administrator signs in, opens Patients and Appointments; the Super Admin signs in at `/platform`. Check the
access log shows real client addresses, not `127.0.0.1` on every line.

## Phase 7: deploy the web app 🔴 CHANGES PRODUCTION (separate approval; only after phase 6 passes)

```sh
sudo cp -a "$WEB_ROOT" "$BACKUP_DIR/web-dist-$DATE"         # rollback copy, outside the checkout (🟡)
sudo rsync -a "$STAGE/web/" "$WEB_ROOT/"                      # 🔴 new index.html, sw.js, assets
sudo chown -R --reference="$BACKUP_DIR/web-dist-$DATE" "$WEB_ROOT"
```

No `--delete`: old hashed files in `assets/` stay, so tabs still open on the old version keep working until
they reload. nginx needs no reload (static files; `index.html` and `sw.js` are already served uncached).

## Phase 8: web smoke tests 🟢

- `curl -s https://dentor.localappstore.in/ | grep -o '<title>[^<]*'` → `Dentor · Clinic Management`.
- By hand, after one reload: administrator sign-in; Patients, Appointments, Accounts, **Expenses** (new);
  the sidebar collapse button (new) on a desktop; Super Admin `/platform` → "Connected services" shows SMS,
  **Email** (new) and Push; switch to a clinic and back.

## Phase 9 (later, separate approval): release APKs against production

Install the release APKs from `Dentor-releases/2026-10-15_v1.0_build1/` on a phone and sign in with real
production accounts made for this (Clinic Owner / Administrator for the Clinic app, a Consultant login linked
to a profile for the Consultant app). The patient app needs the SMS gateway first.

## Rollback

| What | Commands | Mark |
| --- | --- | --- |
| Backend | method G: `cd "$REPO_DIR" && sudo git checkout 211c0d2 -- backend && sudo systemctl restart "$SERVICE"` (puts the old versions of changed files back; files the release added stay on disk but the old code never imports them; `git checkout main -- backend` re-applies the release). Method C, or if git is unclear: `sudo rsync -a --delete --exclude=venv --exclude=.env "$BACKUP_DIR/backend-code-$DATE/" "$APP_DIR/" && sudo systemctl restart "$SERVICE"` | 🔴 |
| Web | `sudo rsync -a --delete "$BACKUP_DIR/web-dist-$DATE/" "$WEB_ROOT/"` | 🔴 |
| Database (**only** if data was damaged; discards everything written after the backup) | `mongorestore --uri="$MONGO_URL" --gzip --archive="$BACKUP_DIR/dentor-$DATE.archive.gz" --nsInclude="$DB_NAME.*" --drop` | 🔴 |

The old backend runs on the database as the new one leaves it: the new one only added collections, indexes
and an `expires_at` field on its own notifications. After a backend rollback the mobile apps stop working again
(404), and the web app must also be rolled back if phase 7 ran.

## Production environment variables

Check by name in phase 0 (values hidden). No new variable is **required** by the new backend.

| Variable | Required | Needed for | Expected |
| --- | --- | --- | --- |
| `DENTOR_ENV` | yes | safety checks at start-up | `production` |
| `MONGO_URL`, `DB_NAME` | yes | database | unchanged |
| `JWT_SECRET` | yes | sessions (32+ characters) | unchanged (changing it signs everyone out) |
| `SUPER_ADMIN_EMAIL`, `SUPER_ADMIN_PASSWORD` | yes | platform login; start-up refuses the development default | unchanged |
| `SEED_DEMO` | must be off | — | unset or `0` |
| `CORS_ORIGINS` | yes (web and API are different hosts) | browser access | includes `https://dentor.localappstore.in` (verified working today) |
| `EMAIL_PROVIDER`, `EMAIL_WEBHOOK_URL`, `EMAIL_WEBHOOK_TOKEN` | no (new) | password reset by email, staff sign-up, application emails | add when an email service exists |
| `SMS_PROVIDER`, `SMS_WEBHOOK_URL`, `SMS_WEBHOOK_TOKEN` | no (new) | **patient sign-up and code login** | add when an SMS gateway exists |
| `PUSH_PROVIDER`, `PUSH_WEBHOOK_URL`, `PUSH_WEBHOOK_TOKEN` | no (new) | phone alerts | later |
| `NOTIFICATION_RETENTION_DAYS`, `REFRESH_TOKEN_DAYS`, `PATIENT_ACCESS_MINUTES`, `OTP_TTL_SECONDS`, `OTP_MAX_PER_HOUR`, `MAX_BODY_BYTES`, `JWT_EXPIRE_MINUTES` | no | tuning | defaults 180, 30, 60, 300, 5, 16 MB, 720 |

## Who does what

| Phase | Who | Approval |
| --- | --- | --- |
| 0 Discover | you, on the server | read-only; send back the results |
| 1 Package | on the Mac (I can run it) | your OK |
| 1 Copy to server | you | your OK |
| 2–3 Backup and verify | you, on the server | your OK |
| 4 Stage and upgrade check | you, on the server | your OK; send back the report |
| 5 Deploy backend | you, on the server | **separate explicit approval** |
| 6 Backend smoke tests | you (curl lines can also run from the Mac) | — |
| 7 Deploy web | you, on the server | **separate explicit approval** |
| 8 Web smoke tests | you | — |
| 9 APKs against production | you, on a phone | **separate approval** |
| Rollback | you, on the server | if a smoke test fails |
