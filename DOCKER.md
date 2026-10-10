# Self-Hosting PixelPaladin with Docker (TrueNAS)

This stack runs the whole app in three containers on your NAS:

```
frontend (Nuxt/Nitro, port 3000)  ──/api/cycles──▶  backend (Express, 4000)  ──▶  mongo (27017)
        ▲
        └── the only published port (default host 3001)
```

The frontend server reverse-proxies `/api/cycles/**` to the backend, so browsers
on your LAN only ever talk to the frontend. There is **no hardcoded IP** and **no
CORS** to configure — reach the app at `http://<NAS-IP>:<APP_PORT>`.

MongoDB data is stored in the `mongo-data` Docker volume and persists across
restarts and image updates.

---

## Files

| File | Purpose |
|------|---------|
| `docker-compose.yml` | Build + run mongo + backend + frontend (local / build-on-NAS) |
| `docker-compose.registry.yml` | Deploy-only: pulls prebuilt images (TrueNAS Apps UI / Portainer) |
| `scripts/build-and-push.sh` | Build multi-arch images and push to a registry |
| `backend/Dockerfile` | Express API image (Node 22) |
| `frontend/Dockerfile` | Nuxt build → Nitro node server (multi-stage) |
| `.env.example` | Copy to `.env` to configure port / database / image registry |

---

## Quick start (any Docker host)

```bash
cp .env.example .env        # edit APP_PORT / MONGODB_URI if desired
docker compose up -d --build
# open http://localhost:3001  (or http://<host-ip>:3001)
```

Useful commands:

```bash
docker compose ps                 # status
docker compose logs -f frontend   # tail logs
docker compose down               # stop (keeps data)
docker compose down -v            # stop AND delete the database volume
docker compose up -d --build      # rebuild after code changes
```

---

## Configuration (`.env`)

| Variable | Default | Notes |
|----------|---------|-------|
| `APP_PORT` | `3001` | Host port the UI is served on |
| `MONGO_DB` | `pixelpaladin` | Database name for the bundled Mongo |
| `MONGODB_URI` | `mongodb://mongo:27017/pixelpaladin` | Set to a MongoDB Atlas URI to use an external DB instead of the bundled container |
| `IMAGE_PREFIX` | `ghcr.io/your-name` | Registry namespace for prebuilt images (see below) |
| `IMAGE_TAG` | `latest` | Tag for prebuilt images |
| `KLIPY_API_KEY` | _(empty)_ | Injected into the **frontend** container for Nitro `/api/klipy/*`. Required for GIF search; leave empty only if you do not use GIFs |
| `KLIPY_BASE_URL` | `https://api.klipy.com` | Optional Klipy API base override |

> The current `backend/.env` (MongoDB Atlas connection string) is **not** used by
> Docker — it is excluded via `.dockerignore`. To keep using Atlas, set
> `MONGODB_URI` in the root `.env`. Otherwise the self-contained `mongo` container
> is used and all data stays on the NAS.

---

## API surface (v2)

Only one host port matters: **`APP_PORT`** (the frontend, default `3001`).
Everything else is internal — backend (`4000`) and mongo (`27017`) live on
the Docker network and are **not** published to the host. The browser talks
only to the Nuxt server; the Nitro middleware in
`frontend/server/middleware/backend-proxy.ts` forwards `/api/cycles*` to the
backend over the internal network.

| Path                  | Owner    | What happens                                       |
|-----------------------|----------|----------------------------------------------------|
| `/api/cycles*`        | Express  | Forwarded to backend on `http://backend:4000`.     |
| `/api/klipy/*`        | Nitro    | GIF search + trending. Needs `KLIPY_API_KEY`.      |
| `/api/health`         | Nitro    | Lightweight health endpoint (compose healthcheck). |
| Anything else         | Nitro    | Renders the SPA; non-route `/api/*` returns 404.    |

The `backend-proxy.ts` middleware exports a single typed constant,
`PROXIED_API_PREFIXES = ["/api/cycles"]`, that is the source of truth for what
gets forwarded. Widening it is a security-relevant change.

The full v2 contract (envelope shape, PATCH `type` union, zod-strict body
rules, error codes) is at
[`development/remediation-w2/orchestration-ctx/decisions/api-contract-v2.md`](development/remediation-w2/orchestration-ctx/decisions/api-contract-v2.md).
Treat that document, not this file, as the source of truth.

---

## Memory limits

Both `docker-compose.yml` and `docker-compose.registry.yml` set a hard `mem_limit`
on every service so a single misbehaving container cannot starve the rest of the
NAS. Defaults are tuned for **single-user LAN use** on a small TrueNAS box; if
you self-host for a family or run heavier GIF-search traffic, raise the frontend
limit (the Nitro SSR cache + asset buffers are usually the first to feel it).

| Service   | `mem_limit` | Why                                                             |
|-----------|-------------|-----------------------------------------------------------------|
| `mongo`   | `512m`      | Caps RSS under heavy writes / index builds; single DB is small  |
| `backend` | `256m`      | Express + mongoose is lean; 256m leaves headroom for V8 bursts  |
| `frontend`| `384m`      | Nitro node + Nuxt SSR cache + emoji/asset buffers; largest user |

Total ≈ **1.15 GB** across the three containers. On an 8 GB-class NAS that leaves
plenty for the host OS, ZFS ARC, and other apps.

To raise a limit (e.g. for a multi-user setup), edit the service block in the
compose file you deploy and `docker compose up -d` again — no rebuild needed
when using `docker-compose.registry.yml`. The values are intentionally **hard
caps** (Docker will OOM-kill the container if exceeded); no `mem_reservation` is
set, so the kernel is free to reclaim idle pages.

---

## Deploying on TrueNAS

### TrueNAS SCALE 24.10 (Electric Eel) or newer — native Docker Compose

Electric Eel replaced the old k3s apps engine with Docker. Two easy paths:

**A. Custom App (YAML) via the web UI**
1. Copy this project folder onto the NAS (e.g. an SMB share or `git clone` into a
   dataset such as `/mnt/pool/apps/pixelpaladin`).
2. **Apps → Discover Apps → (top-right) Custom App → Install via YAML**.
3. Paste the contents of `docker-compose.yml`. Replace the `build:` sections with a
   prebuilt image **or** build on the NAS first (see "Building on the NAS" below),
   since the Apps UI does not build from source.
4. Set the published port and deploy.

**B. Dockge / Portainer (recommended for compose-based stacks)**
1. Install **Dockge** or **Portainer** from the TrueNAS catalog.
2. Create a new stack, paste `docker-compose.yml`, add the `.env` values.
3. Point the volume at a dataset for backups (see below), then deploy.

### Option 1 — Build on the NAS (SSH access)

The main compose file builds from source:

```bash
cd /mnt/pool/apps/pixelpaladin
cp .env.example .env
docker compose up -d --build
```

### Option 2 — Prebuilt images (recommended for the Apps UI)

The TrueNAS Apps UI cannot build from source, so build + push once from your
workstation, then deploy `docker-compose.registry.yml` (which only *pulls* images).

**Step 1 — build & push (from your workstation):**

```bash
docker login ghcr.io                       # or: docker login  (Docker Hub)
IMAGE_PREFIX=ghcr.io/yourname ./scripts/build-and-push.sh
# optional custom tag:  IMAGE_PREFIX=ghcr.io/yourname ./scripts/build-and-push.sh v1
```

The script uses `docker buildx` to build **multi-arch (amd64 + arm64)** images, so
they run on an x86 NAS even when built on an Apple-Silicon Mac. It pushes:

- `ghcr.io/yourname/pixelpaladin-backend:<tag>`
- `ghcr.io/yourname/pixelpaladin-frontend:<tag>`

> GHCR images default to private. Either make them public in your GitHub
> package settings, or run `docker login ghcr.io` on the NAS so it can pull.

**Step 2 — deploy on the NAS:**

- **TrueNAS Custom App → Install via YAML:** paste `docker-compose.registry.yml`,
  then set the environment values `IMAGE_PREFIX`, `IMAGE_TAG`, and `APP_PORT`.
- **Portainer / Dockge:** create a stack from `docker-compose.registry.yml` and
  add the same values to the stack's `.env`.
- **SSH:** `docker compose -f docker-compose.registry.yml up -d` (with a `.env`
  containing `IMAGE_PREFIX` / `IMAGE_TAG`).

To update later: re-run the push script, then on the NAS
`docker compose -f docker-compose.registry.yml pull && ... up -d`.

> **Prefer automation?** See [`deploy/AUTOMATION.md`](deploy/AUTOMATION.md) to
> have GitHub Actions build+publish on a release tag and Watchtower auto-update
> the NAS — no manual push script, no SSH, nothing exposed to the internet.

### Persisting data to a TrueNAS dataset (recommended)

Named volumes live under Docker's data dir. To store the database on a dedicated
dataset (easier snapshots/backups), replace the volume mapping in the `mongo`
service:

```yaml
  mongo:
    volumes:
      - /mnt/pool/apps/pixelpaladin/db:/data/db   # bind mount to a dataset

# and remove the top-level `volumes: mongo-data:` block
```

Create the dataset/directory first and make sure it's writable by the container.

---

## Health & troubleshooting

- `mongo` and `backend` have healthchecks; `docker compose ps` shows `(healthy)`.
- Backend can't reach Mongo → check `MONGODB_URI` and that the `mongo` service is healthy.
- UI loads but tasks don't save → check `docker compose logs backend` and confirm
  `BACKEND_URL=http://backend:4000` is set on the frontend service.
- Changed the source → `docker compose up -d --build` to rebuild.
