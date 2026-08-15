# Troubleshooting Log — Task 1 (Dev EC2 Deployment)

## Issue: Backend container stuck in restart loop

**Symptom**: `docker compose up -d` failed with `dependency backend failed to start`; `ecommerce-backend` kept restarting.

**Root cause**: The published image `abdelazez66/ecommerce-backend:v1` was built from an older commit where the `/:id` catch-all route was registered before `/health`. Express matches routes in registration order, so the Compose healthcheck's request to `/health` fell through to the product-lookup handler (`showProduct`), which tried to cast the string `"health"` to a MongoDB ObjectId and threw an uncaught `CastError`, crashing the Node process.

**Fix**: Rebuilt the images from local source instead of pulling the stale published tag:

```bash
docker compose up -d --build
```

Current `server.js` already registers `/health` ahead of `/:id`, so the healthcheck now hits the correct handler. All three services (mongo, backend, frontend) report healthy after the rebuild.

## Environment

- Deployed to a dev EC2 instance (Ubuntu 22.04, t3.small) for this task.
- `.env` created from `.env.example` with a generated `JWT_SECRET` (`openssl rand -hex 32`).
- Verified externally:
  - `GET /health` → `{"status":"ok","database":"connected"}`
  - `GET /products` → `[]` (empty DB, expected on first boot)
  - Frontend reachable on port 3000

# Troubleshooting Log — Task 2 (Server Setup & Feature Deployment)

## Database details (as requested by Task 2)

- **Type**: MongoDB 7 (official `mongo:7` image), run as its own container.
- **Auth**: none configured — the `mongo` service has no root username/password, so the backend connects unauthenticated over the internal Docker network only (not exposed with credentials).
- **Connection string**: `mongodb://mongo:27017/${MONGO_DATABASE:-ecommerce}` (set automatically by Compose, no manual entry needed).
- **Database name**: `ecommerce`.
- **Ports**: frontend `3000→8080` (nginx), backend `5000→5000` (Node/Express), mongo `27017→27017`.

## Issue: Backend crashes (process exits) when adding a product without an image

**Symptom**: `POST /products` with no `image` field killed the whole backend container; all other users lost service until Docker restarted it.

**Root cause**: `addProduct.js` read `req.file.filename` without checking that Multer actually attached a file. The resulting `TypeError` was thrown inside an `async` handler with no `try/catch`, so it became an unhandled promise rejection, which crashes the whole Node process by default.

**Fix**: Added a guard that returns `400` when `req.file` is missing (`backend/handlers/addProduct.js`).

## Issue: Product creation failed with `ENOENT` even with a valid image

**Symptom**: `POST /products` with an image returned `500`, log showed `ENOENT: no such file or directory, open '/app/handlers/images/...'`.

**Root cause**: Multer's disk storage writes to `backend/handlers/images/`, but that directory isn't tracked by git (empty dirs aren't) and nothing created it during the Docker build.

**Fix**: `backend/Dockerfile` now runs `mkdir -p handlers/images` after copying the source.

## Issue: Product image URLs were `undefined/images/...`

**Root cause**: `addProduct.js` builds the image URL from `process.env.REACT_APP_BACKEND_URL`, but `docker-compose.yml` only set that variable for the `frontend` build args, not for the running `backend` container.

**Fix**: Added `REACT_APP_BACKEND_URL` to the `backend` service's `environment` block in `docker-compose.yml`.

## Issue: Backend crashed again on `DELETE /cart` with no `cartItem`

**Root cause**: Same pattern as the image bug — `deleteCart.js` read `req.body.cartItem[0]` without checking it existed.

**Fix**: Added a guard returning `400` when `cartItem` is missing (`backend/handlers/deleteCart.js`).

**Broader fix**: Since this class of bug (unguarded property access crashing the entire process) had now shown up three times in different handlers, added a process-level `unhandledRejection` handler in `server.js` so a single bad request can no longer take down the whole server for every other user. Individual handlers were still patched with proper input guards — the process-level handler is a safety net, not a substitute for validation.

## Issue: Frontend couldn't reach the backend when accessed remotely (browser showed no products)

**Symptom**: Backend and API worked fine over `curl`, but loading the frontend in a browser on a different machine showed an empty product list. Network tab showed `GET http://localhost:5000/products` failing with `ERR_CONNECTION_REFUSED`.

**Root cause**: `REACT_APP_BACKEND_URL` was hardcoded to `http://localhost:${BACKEND_PORT}` in `docker-compose.yml`. That's baked into the React build at build time, so "localhost" resolves to whatever machine the *browser* is running on, not the server — this only works when browsing from the same host running Docker.

**Fix**: Made the value configurable via a new `PUBLIC_BACKEND_URL` variable (defaults to the old `localhost` behavior for local dev, unchanged). Set `PUBLIC_BACKEND_URL=http://<ec2-public-ip>:5000` and `FRONTEND_URL=http://<ec2-public-ip>:3000` (for CORS) in the server's `.env`, then rebuilt.

## Functional testing performed

- Signup + login as both `Retailer` and `Consumer` roles (JWT cookie auth) — pass
- Add product with image upload as Retailer — pass (after fixes above)
- List products (`GET /products`) — pass, confirmed in both `curl` and the browser UI
- Add to cart / view cart / delete cart as Consumer — pass (after fix)
- Add and fetch product reviews — pass
- Frontend → Backend → MongoDB round-trip verified end-to-end through the actual browser UI, not just `curl`

## Known limitation (not fixed, out of scope)

Each `POST /cart` call creates a brand-new cart document instead of merging into an existing cart for the user (`addToCart.js` always does `new cart(...).save()`), so a user accumulates multiple cart documents rather than one cart with multiple items. This is an application design issue rather than a deployment bug — flagging it here rather than changing cart business logic under a deployment task.

# Troubleshooting Log — Task 3 (Standalone Containerization)

## Issue: Signup failed with "Failed to fetch" when running containers standalone

**Symptom**: Backend and frontend containers were both running and individually healthy (`GET /health` returned `200`), but signing up through the frontend UI failed with a generic error banner. Browser console showed `POST http://localhost:5000/signup net::ERR_FAILED` / `TypeError: Failed to fetch`. Backend logs showed no request had reached the server at all — not even a failed one.

**Root cause**: The backend container was started with `REACT_APP_FRONTEND_URL=http://localhost:3000` (used by the `cors` middleware to set the allowed origin), but the frontend container was actually mapped to host port `3001`. Since the request's `Origin` header (`http://localhost:3001`) didn't match the CORS allow-list, the browser blocked the preflight/request client-side before it ever reached Express — which is why nothing showed up in the backend logs.

**Fix**: Recreated `backend-standalone` with the correct origin:
```bash
docker run -d --name backend-standalone --network ecommerce-net -p 5000:5000 \
  -e MONGO_URI="mongodb://mongo-standalone:27017/ecommerce" \
  -e JWT_SECRET="temp-local-secret-for-task3" \
  -e REACT_APP_FRONTEND_URL="http://localhost:3001" \
  ecommerce-backend-standalone
```

**Lesson**: When running frontend/backend as separate standalone containers (rather than via `docker-compose`, which wires these values together automatically), the `-p` host port mapping and the `REACT_APP_FRONTEND_URL` env var must be kept in sync manually.

## Standalone containerization verified

- Built and ran the backend (`node:22-alpine`) and frontend (`node:22-alpine` build → `nginx-unprivileged` runtime) as independent containers, not via Compose.
- MongoDB ran in its own container (`mongo:7`) on a shared Docker network (`ecommerce-net`).
- Confirmed backend → MongoDB connectivity via `/health`.
- Confirmed frontend → backend → MongoDB end-to-end via a real signup through the browser UI; verified the resulting user document directly in MongoDB with `mongosh` (password correctly hashed).

# Troubleshooting Log — Task 4 (Docker Volume, Network & Container Setup)

## Data persistence verified with a named Docker volume

**Context**: The `mongo-standalone` container from Task 3 had no volume attached, so its data lived only in the container's writable layer — it would survive a `stop`/`start`, but not a `docker rm`.

**Fix**: Created a named volume and mounted it at Mongo's data directory:
```bash
docker volume create ecommerce-mongo-data
docker run -d --name mongo-standalone --network ecommerce-net -p 27017:27017 \
  -v ecommerce-mongo-data:/data/db mongo:7
```

**Verification (the real test)**:
1. Signed up a test user through the frontend UI — confirmed in MongoDB via `mongosh`.
2. Fully removed the container: `docker stop mongo-standalone && docker rm mongo-standalone`.
3. Recreated it with the same `-v ecommerce-mongo-data:/data/db` mount.
4. Queried `db.users.find()` again — the same user document was still there, proving the data lives in the volume independent of the container's lifecycle, not just the container's own filesystem.

## Network verified by container name

Confirmed all three containers (`mongo-standalone`, `backend-standalone`, `frontend-standalone`) are attached to the shared `ecommerce-net` network:
```bash
docker network inspect ecommerce-net --format "{{range .Containers}}{{.Name}} {{end}}"
```
This is what lets the backend reach Mongo via the hostname `mongo-standalone` (rather than a hardcoded IP) — the same mechanism `docker-compose` sets up automatically, done here by hand to understand it.

No new issues were hit in this task — the volume + network setup worked as expected once done explicitly.

# Troubleshooting Log — Task 5 (Docker Multi-Stage, Hardening & Multi-Registry Deployment)

## Hardening verification

- `backend/Dockerfile` and `frontend/Dockerfile` already used multi-stage builds from earlier tasks (dependencies/build stage separate from runtime).
- Confirmed the built backend image excludes dev dependencies: `du -sh /app/node_modules` → 41.6M (production-only, via `npm install --omit=dev`).
- Confirmed the backend container actually runs as a non-root user, not just declares it: `docker run --rm <image> whoami` → `node`.
- Frontend runtime stage uses `nginx-unprivileged`, running as UID 101.

## Pushed and verified images on three registries

- Docker Hub: `okoobohjames/ecommerce-backend:latest`, `okoobohjames/ecommerce-frontend:latest`
- GitHub Container Registry: `ghcr.io/jamesokooboh/ecommerce-backend:latest`, `ghcr.io/jamesokooboh/ecommerce-frontend:latest`
- AWS ECR: `313951301623.dkr.ecr.us-east-1.amazonaws.com/ecommerce-backend:latest`, `.../ecommerce-frontend:latest`
- Verified each is independently pullable (`docker pull` from each registry returned the same image digest).

## Issue: Signup failed after pulling and running images from the registry

**Symptom**: Pulled the backend image from Docker Hub and ran it on host port `5001` (to avoid clashing with the still-running Task 3 containers on `5000`). Frontend loaded fine, but signup failed.

**Root cause**: Same class of issue as Task 3 — `REACT_APP_BACKEND_URL` is baked into the frontend's JS bundle at *build* time, not read at container start. The pushed frontend image had `http://localhost:5000` baked in from when it was originally built, so running the backend on a different port (`5001`) broke the frontend's hardcoded API calls. This can't be fixed by changing container ports or env vars at runtime — the frontend image itself would need to be rebuilt with the correct `REACT_APP_BACKEND_URL` build arg for a different port.

**Fix**: Retired the older Task 3 standalone containers (superseded by this task's registry-pulled versions) and freed up their ports, then ran the Task 5 containers on the same ports (5000/3000) the frontend image already expects, avoiding an unnecessary rebuild.

**Lesson**: When distributing a frontend image via a registry, the backend URL baked into it should either point to a stable, well-known hostname (not `localhost`), or the image should be rebuilt per-environment with the correct `REACT_APP_BACKEND_URL` build arg — reusing the same image across different port mappings will silently break API calls.

# Troubleshooting Log — Task 6 (Orchestration Using Docker Compose)

## Issue: `docker compose up` failed with "ports are not available... forbidden by its access permissions"

**Symptom**: Mongo started fine, but the backend service got stuck at "Starting" and then failed with:
```
Error response from daemon: ports are not available: exposing port TCP 0.0.0.0:5000 -> 127.0.0.1:0: listen tcp 0.0.0.0:5000: bind: An attempt was made to access a socket in a way forbidden by its access permissions.
```
`netstat -ano | findstr :5000` showed nothing listening on that port — no ordinary process conflict.

**Root cause**: Windows/Hyper-V reserves dynamic port ranges for its own use (visible via `netsh interface ipv4 show excludedportrange protocol=tcp`), and Docker Desktop can't bind a container port that falls inside one of those ranges even though nothing is actually using it. Both the default backend port (`5000`, inside `4916–5015`) and the default frontend port (`3000`, inside `2942–3041`) happened to fall inside excluded ranges on this machine. A second attempt at port `5050` also failed for the same reason (inside `5041–5140`) — these ranges can shift between reboots, so a port that's free one day may not be the next.

**Fix**: Changed `BACKEND_PORT` and `FRONTEND_PORT` in `.env` to values outside any excluded range (`5500` and `8081`). Not a code fix — purely a local environment/port-selection issue, worth checking with `netsh` whenever a Docker port bind fails with a permissions-style error rather than a plain "already in use" error.

## Issue: Signup failed again after switching to Compose (same root cause as Tasks 3 & 5)

**Symptom**: All three services reported healthy via `docker compose ps`, but signup through the browser UI failed.

**Root cause**: Third occurrence of the same underlying issue: the pre-pushed frontend image (`okoobohjames/ecommerce-frontend:latest`, from Task 5) had `REACT_APP_BACKEND_URL=http://localhost:5000` baked in at build time. Since the Hyper-V port conflict forced the backend onto port `5500` instead, the frontend's compiled JS was calling the wrong port.

**Fix**: Rather than relying on the pre-pushed image, forced Compose to rebuild the frontend locally against the current `.env`:
```bash
docker compose up -d --build frontend
```
The `frontend` service's `build.args` already reads `PUBLIC_BACKEND_URL` (falling back to `localhost:${BACKEND_PORT}`) from `.env` — a mechanism added back in Task 2 — so rebuilding picked up the correct port automatically. No code changes needed, just using the build path instead of the pulled-image path when the environment's ports don't match what the image was built for.

## Restart policy verified

- All services use `restart: unless-stopped` and have healthchecks defined in `docker-compose.yml`.
- Fully quit and reopened Docker Desktop (simulating a host/daemon restart), then confirmed via `docker inspect <container> --format "{{.State.StartedAt}}"` that the backend and frontend containers had genuinely new `StartedAt` timestamps matching the restart time — proving they came back automatically rather than the `ps` output just showing stale state.
- Mongo's container stayed continuously running through the same Docker Desktop restart (a WSL2 backend quirk) but remained healthy throughout — noted as an observation, not a problem.

## Clean shutdown verified

`docker compose down` (without `-v`) stops and removes containers/network but preserves the named `ecommerce_mongo_data` volume, so a subsequent `docker compose up -d` starts with existing data intact rather than a fresh empty database.
