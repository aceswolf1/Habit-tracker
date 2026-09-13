# Automated deploy: GitHub → GHCR → NAS

This wires your GitHub repo to your TrueNAS so a **release tag** rebuilds the
images and the NAS **auto-updates itself** — no manual `build-and-push.sh`, no
SSH, nothing on the NAS exposed to the internet.

```
git tag v1.2.0 && git push origin v1.2.0
        │
        ▼
GitHub Actions (.github/workflows/publish.yml)
   build multi-arch (amd64+arm64) → push to GHCR
   tags: 1.2.0, 1.2, latest
        │
        ▼  (Watchtower polls GHCR every 5 min)
NAS Watchtower  ──▶  new :latest digest?  ──▶  pull + recreate backend & frontend
```

There are two pieces: **CI** (already committed) and **Watchtower on the NAS**
(one-time setup).

---

## Part 1 — CI (already set up)

`.github/workflows/publish.yml` runs automatically. It needs **no secrets** — it
uses the built-in `GITHUB_TOKEN`. You only have to do this once in the repo:

1. Push this repo to GitHub (if it isn't already):
   ```bash
   git remote add origin git@github.com:<you>/<repo>.git   # if no origin yet
   git push -u origin main
   ```
2. **Settings → Actions → General → Workflow permissions** → ensure
   **"Read and write permissions"** is enabled (lets Actions push to GHCR).
3. **If you ever pushed these images manually before** (e.g. via
   `scripts/build-and-push.sh`), the GHCR package already exists and does **not**
   grant the repo's Actions token write access — see the gotcha below before
   your first run.

### Gotcha: `denied: permission_denied: write_package` on the first run

If the very first Actions run fails with:

```
failed to push ghcr.io/<you>/pixelpaladin-backend:<tag>: denied:
permission_denied: write_package
```

...the cause is almost always a **pre-existing package that isn't linked to this
repo**. A GHCR package created outside Actions (any manual `docker push`) has no
write role for the repo's `GITHUB_TOKEN`, even though the workflow requests
`packages: write`. Fix it once, per package:

1. Open the package settings:
   - `https://github.com/users/<you>/packages/container/pixelpaladin-backend/settings`
   - `https://github.com/users/<you>/packages/container/pixelpaladin-frontend/settings`
2. Scroll to **"Manage Actions access"** → **Add Repository** → select this repo
   → set the role to **Write**.
3. Re-run the failed job (**Actions → the run → Re-run failed jobs**). No new tag
   needed.

**Alternative (non-linking):** delete the two pre-existing packages
(profile → Packages → each → settings → Delete), then re-run. Packages *created
by* an Actions run are auto-linked to the repo with write access. This is safe
for the NAS — its containers keep running the locally-pulled `:latest`; deleting
the *remote* package doesn't stop them, and the re-run republishes immediately.
The link route is preferred (non-destructive, correct long-term setup).

### Cutting a release

```bash
git tag v1.0.0
git push origin v1.0.0
```

Watch it under the repo's **Actions** tab. When green, three tags per image exist
under **your profile → Packages**:

- `ghcr.io/<you>/pixelpaladin-backend:1.0.0` · `:1.0` · `:latest`
- `ghcr.io/<you>/pixelpaladin-frontend:1.0.0` · `:1.0` · `:latest`

> Watchtower tracks the **moving `:latest`** tag — that's why the workflow always
> updates `:latest` on every release even though you trigger by version tag.

---

## Part 2 — Watchtower on the NAS (one-time)

Your app stack is deployed via **TrueNAS Apps → Custom App**. Add Watchtower as a
**second** Custom App so it can auto-update the first.

1. Make sure your app stack (`docker-compose.registry.yml`) is deployed and its
   `backend` / `frontend` images point at `ghcr.io/<you>/...:latest`. Those two
   services now carry the label `com.centurylinklabs.watchtower.enable=true`, so
   Watchtower will manage exactly them (and never `mongo`).

2. **Apps → Discover Apps → Custom App → Install via YAML** and paste
   [`deploy/watchtower.compose.yml`](./watchtower.compose.yml).

3. Deploy. Within one poll interval (5 min) Watchtower begins tracking updates.
   Check its logs from the TrueNAS app view — you should see it inspecting the
   two pixelpaladin containers.

That's it. From now on: `git tag vX.Y.Z && git push origin vX.Y.Z`, and a few
minutes later the NAS is running the new build.

---

## Private GHCR images (only if your packages are private)

GHCR packages default to **private**. Two options:

**A. Make them public (simplest for a personal app)**
Profile → Packages → each package → Package settings → **Change visibility →
Public**. Then delete the `/config.json` volume line in
`watchtower.compose.yml` — no credentials needed.

**B. Give Watchtower a read-only pull token**

1. Create a GitHub **Personal Access Token (classic)** with the `read:packages`
   scope only.
2. On the NAS, create the credentials file referenced by the compose
   (`/mnt/storage/pixelpaladin/watchtower-config.json`):
   ```json
   {
     "auths": {
       "ghcr.io": {
         "auth": "BASE64_OF_username:TOKEN"
       }
     }
   }
   ```
   Generate the `auth` value with:
   ```bash
   printf '<github-username>:<PAT>' | base64
   ```
3. Keep the `/config.json` volume line in `watchtower.compose.yml`. The bundled
   mongo container also needs the NAS to be able to pull `ghcr.io/...` images at
   deploy time, so the same login on the NAS host (`docker login ghcr.io`) helps
   for the initial `docker-compose.registry.yml` deploy.

---

## Choosing the update timing

- **Faster updates:** lower `WATCHTOWER_POLL_INTERVAL` (e.g. `60` = 1 min).
- **Scheduled window instead of polling:** replace `WATCHTOWER_POLL_INTERVAL`
  with `WATCHTOWER_SCHEDULE` (6-field cron), e.g. `"0 0 4 * * *"` for 4am daily.

## Rolling back

Watchtower only moves forward on `:latest`. To pin/rollback, set the NAS
`backend`/`frontend` image to a specific version tag (e.g. `:1.0.0`) and remove
the watchtower label from that service, or just re-tag a previous release.

## Notes / gotchas

- **Database is never auto-updated** — `mongo` has no watchtower label on purpose.
- **First deploy still manual:** Watchtower updates *existing* containers; the
  very first `docker-compose.registry.yml` deploy is done via the Apps UI.
- **`scripts/build-and-push.sh` is now optional** — keep it for manual/local
  publishing, but day-to-day you just push a tag.
