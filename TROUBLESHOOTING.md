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

# Troubleshooting Log — Task 7 (Jenkins CI/CD Pipeline on AWS EC2)

## Issue: Instance too small to run Jenkins alongside the existing app

**Symptom**: Before installing Jenkins, checked `free -h` on the existing Task 1 EC2 instance (`t3.small`, 1.9GB RAM) and found only 72MB free, since the e-commerce app (backend, frontend, mongo) had already been running continuously for 4 days.

**Root cause**: Jenkins itself needs headroom for its JVM, and this task's pipeline runs `npm install`/`npm run build` (inside the Docker build) plus multiple concurrent `docker build`/`docker push` operations — all memory-hungry. Running that on top of an already-tight instance would risk OOM kills mid-build.

**Fix**: Resized the instance from `t3.small` (2GB RAM) to `m7i-flex.large` (8GB RAM, 2 vCPU) via `aws ec2 modify-instance-attribute` (required a stop/start, and the public IP changed since no Elastic IP was attached — updated the security group and all references to the new IP afterward).

## Docker permissions for the `jenkins` system user

By default the `jenkins` user isn't in the `docker` group, so pipeline steps that call `docker` fail with a permission error. Fixed with:
```bash
sudo usermod -aG docker jenkins
sudo systemctl restart jenkins
```
Verified two ways before building the real pipeline: directly via SSH (`sudo -u jenkins docker run --rm hello-world`), and from inside Jenkins itself via a throwaway freestyle job running the same command — both had to work independently, since SSH access working doesn't guarantee the Jenkins service's own environment/group membership is correct until the service restarts.

## Credentials management

Configured four credentials in Jenkins (Manage Jenkins → Credentials) rather than hardcoding any secret in the `Jenkinsfile`:
- `github-token` (Username with password) — for cloning the private repo
- `dockerhub-creds` (Username with password) — for `docker login`
- `aws-access-key-id` / `aws-secret-access-key` (Secret text) — used via `aws ecr get-login-password` for ECR auth

All four are pulled into the pipeline via `withCredentials`, so nothing is ever printed to build logs or committed to the repo.

## Pipeline result

First run of the `Jenkinsfile` succeeded end-to-end on the first attempt (`Finished: SUCCESS`): checked out the `feature/James-Okooboh` branch, built backend and frontend Docker images, pushed both (tagged with the Jenkins build number and `latest`) to Docker Hub and AWS ECR, then verified by pulling the just-pushed images back down from both registries.

## GitHub webhook

Created the webhook via the GitHub API (`repos/.../hooks`) pointing at `http://<jenkins-ip>:8080/github-webhook/`, and enabled "GitHub hook trigger for GITScm polling" on the Jenkins job. Confirmed the initial `ping` event delivered with a `200` status, proving GitHub can reach Jenkins over the public IP/port before relying on a real push to trigger a build.

# Troubleshooting Log — Task 8 (Jenkins Pipeline with Docker Hub & Docker Compose)

## Issue: Stopping the EC2 instance between tasks breaks the webhook

**Symptom**: After stopping the instance (to save cost between Task 7 and Task 8) and starting it again, it came back with a new public IP (no Elastic IP attached). The GitHub webhook was still configured with the *old* IP, so the first push after restarting silently failed to reach Jenkins — no build was triggered.

**Root cause**: A `stop`/`start` cycle on an EC2 instance without an Elastic IP always assigns a new public IP. Nothing about that is unique to Jenkins/webhooks, but it's an easy thing to forget to update.

**Fix**: Updated the webhook's URL via the GitHub API (`PATCH repos/.../hooks/:id`) to the new IP, verified with a fresh `ping` (200 OK), then manually redelivered the failed push event's webhook attempt (`POST .../deliveries/:id/attempts`) rather than making a throwaway commit just to retrigger it.

**Lesson**: Anything that hardcodes a server's IP (webhook URLs, `.env` `PUBLIC_BACKEND_URL`/`FRONTEND_URL`, security group rules) needs to be revisited every time the instance restarts without an Elastic IP. Worth attaching an Elastic IP if this instance needs to survive many more stop/start cycles.

## Deploying via Docker Compose from a Jenkins pipeline

**Challenge**: `.env` is gitignored (correctly, since it holds `JWT_SECRET`), so it's never present in Jenkins' checked-out workspace, which is also wiped and recreated for every build.

**Fix**: Kept a persistent `.env` and `docker-compose.yml` at a fixed path on the instance (`/home/ubuntu/e-commerce`, outside the ephemeral Jenkins workspace), updated `FRONTEND_IMAGE`/`BACKEND_IMAGE` there to point at the images this pipeline actually pushes (`okoobohjames/...`) instead of the original repo author's images, and had the pipeline's deploy stage `cd` into that fixed path and run `docker compose --env-file .env pull && up -d` against it. Verified the `jenkins` user could read the `.env` file and run compose there before wiring it into the pipeline (`sudo -u jenkins docker compose ... config`).

## Pipeline result

Extended the Task 7 `Jenkinsfile` with two new stages: cleaning up the local per-build image tags after a successful push (`docker rmi ... || true`, so failures don't fail the build), and deploying with `docker compose pull && up -d` against the persistent compose setup, followed by a verification stage that actually curls `/health` and the frontend root and fails the build (`curl -sf`) if either doesn't respond. Build #3 (triggered by the redelivered webhook after fixing the URL) completed `SUCCESS`: images built, pushed, local copies cleaned up, Compose recreated all three containers from the freshly pushed `:latest` images, and both health checks passed.

# Troubleshooting Log — Task 9 (Kubernetes Deployment with Kind & EC2)

## Instance reuse decision

Reused the existing Jenkins/app EC2 instance (`m7i-flex.large`, 8GB RAM) instead of launching a new dedicated one. A 3-node Kind cluster (1 control-plane + 2 workers, each a full node running as its own container with kubelet/containerd/etc.) is heavier than the task doc's suggested `t2.medium` (4GB) comfortably supports alongside Jenkins and the running app — the existing instance had 6.4GB available, which was enough headroom, and avoided paying for a second running instance.

## Issue: NodePort services unreachable from the host

**Symptom**: After deploying backend and frontend as `NodePort` services (`30050`, `30080`) and confirming all pods `Running`, `curl http://localhost:30050/health` from the EC2 host itself timed out completely (`curl: (7) Failed to connect`).

**Root cause**: Kind runs each "node" as a Docker container on the host, and by default only the Kubernetes API server port is mapped out to the host — NodePort services are reachable from *inside* the Kind Docker network but not from the host machine unless explicitly configured.

**Fix**: Deleted and recreated the cluster with `extraPortMappings` in the Kind config, mapping the control-plane container's `30050`/`30080` to the same host ports:
```yaml
nodes:
  - role: control-plane
    extraPortMappings:
      - containerPort: 30050
        hostPort: 30050
      - containerPort: 30080
        hostPort: 30080
```
After recreating with this config and reapplying all manifests, both NodePorts responded correctly from the host.

## Avoiding the recurring build-time backend URL bug (this project's most common issue)

Rather than let the frontend's `:latest` image (built with `http://localhost:5000` baked in, used by the Compose deployment on this same instance) also serve the Kubernetes deployment — which would break signup again, exactly as happened in Tasks 3, 5, 6, and 8 — built a separate `okoobohjames/ecommerce-frontend:k8s` tag with `REACT_APP_BACKEND_URL=http://<ec2-ip>:30050` (the backend's actual NodePort) baked in via `--build-arg`, and referenced that tag specifically in `k8s/frontend.yaml`. This keeps the Kubernetes and Compose deployments independent instead of fighting over what `:latest` should mean.

## Verification performed

- Cluster: `kubectl get nodes` — 1 control-plane + 2 workers, all `Ready`.
- Deployment: `kubectl get pods` — backend (2 replicas), frontend (2 replicas), mongo (1 replica), all `Running`/`1/1`.
- Backend → Database: `POST /signup` through the NodePort succeeded and the health endpoint reports `"database":"connected"`.
- Frontend → Backend: frontend served correctly (`HTTP 200`) with the `:k8s` image's baked-in URL matching the backend's actual NodePort.
- Scaling: `kubectl scale deployment backend --replicas=3` — Kubernetes created a third pod automatically, reaching `3/3 Ready` without any other changes.

# Troubleshooting Log — Task 10 (Kubernetes with ConfigMaps, Secrets & Persistent Volume Storage)

## Windows key-file permission issue (local, not server-side)

**Symptom**: `ssh -i keys/miseacademy-dev.pem ...` failed with `Permission denied (publickey)` and Windows warned `Bad permissions... UNPROTECTED PRIVATE KEY FILE`, even after running `icacls /inheritance:r` and granting the current user explicit read access.

**Root cause**: `icacls "<file>" /grant:r "<user>:(R)"` only adds/replaces that one principal's ACE — it doesn't remove other existing entries. A leftover group ACE (`OKOOBOH\CodexSandboxUsers`) was still present from before, and OpenSSH's Windows port rejects any key file with more than the owner's own access, regardless of what that extra access actually is.

**Fix**: `icacls "<file>"` (no args) to actually list every ACE on the file, then `icacls "<file>" /remove "<extra-principal>"` to remove the specific leftover entry rather than assuming a grant alone would clean things up.

## Migrating existing resources to a namespace

Since Task 9's `backend`/`frontend`/`mongo` resources already existed in the `default` namespace, applying namespaced versions of the same manifests would have left two parallel sets of resources running side by side (Kubernetes namespaces are non-overlapping — a `Service` named `mongo` in `default` and one named `mongo` in `ecommerce` are entirely separate objects). Deleted the `default`-namespace Deployments/Services/Secret explicitly before applying the namespaced manifests, rather than letting old and new versions coexist and consume double the resources.

## MongoDB: Deployment → StatefulSet with a PVC

Replaced the plain `Deployment` + `emptyDir` from Task 9 with a `StatefulSet` using `volumeClaimTemplates`, which Kind auto-provisions against its default `standard` StorageClass (`rancher.io/local-path`) — no manual `PersistentVolume` needed, since the provisioner creates one per PVC on demand. The StatefulSet's Service is headless (`clusterIP: None`), which is the standard pattern — StatefulSet pods get stable network identities rather than being load-balanced like a Deployment's pods.

## ConfigMap key naming caught early

The ConfigMap stores `FRONTEND_URL`, but the backend code actually reads `process.env.REACT_APP_FRONTEND_URL` for its CORS check. Mapped the ConfigMap key explicitly per env var (`configMapKeyRef` with a different env var name) instead of using a blanket `envFrom`, which would have silently injected `FRONTEND_URL` as-is and left `REACT_APP_FRONTEND_URL` unset, breaking CORS the same way the Task 3 bug did.

## Data persistence verified for real

1. Signed up a test user through the NodePort — confirmed in MongoDB via `mongosh`.
2. Fully deleted the `mongo-0` pod (`kubectl delete pod`, not just a restart) and waited for the StatefulSet controller to recreate it.
3. Queried MongoDB again — the exact same document (same `_id`) was still there, proving the data lives in the PVC/PV, independent of the pod's lifecycle, the same guarantee proven for the standalone Docker volume in Task 4, now proven again at the Kubernetes layer.

## Full-stack communication verified inside the namespace

`POST /signup` through the frontend's NodePort succeeded end-to-end: frontend (serving via NodePort) → backend (2 replicas, ConfigMap/Secret-driven config) → MongoDB (StatefulSet, PVC-backed) → response confirmed and the document persisted.

# Troubleshooting Log — Task 11 (Resource Management & Auto Scaling with Kind)

## Issue: `kubectl top pods` failed with "Metrics API not available"

**Symptom**: After installing the standard Metrics Server manifest, `kubectl top pods` returned `error: Metrics API not available` even though the `metrics-server` Deployment showed `Available`.

**Root cause**: Metrics Server tries to connect to each node's kubelet over TLS using the kubelet's serving certificate, which Kind's nodes don't have properly signed by a CA Metrics Server trusts by default. This is a well-known Kind-specific gotcha, not a real cluster misconfiguration.

**Fix**: Patched the `metrics-server` Deployment to add `--kubelet-insecure-tls` to its container args, which is fine for a local Kind cluster (would not be appropriate for a real production cluster). After the patch and a short wait for the pod to restart, `kubectl top pods` returned real CPU/memory numbers.

## Issue: Backend pods restarted (exit 137) during the load test

**Symptom**: During the Apache Bench load test (100 concurrent requests for 2 minutes), one backend pod restarted once. `kubectl describe pod` showed repeated `Readiness probe failed` / `Liveness probe failed` events with `context deadline exceeded (Client.Timeout exceeded while awaiting headers)`, and `Last State: Terminated, Reason: Error, Exit Code: 137` (SIGKILL, sent by the kubelet after the liveness probe failed enough times).

**Root cause**: The probes' default `timeoutSeconds: 1` was too tight for a pod actively being CPU-throttled by its own `resources.limits.cpu: 500m` while under heavy synthetic load — the `/health` endpoint was still working, it just occasionally took slightly longer than 1 second to respond while the container was CPU-starved, and the kubelet killed it after enough consecutive timeouts.

**Fix**: Widened both probes to `timeoutSeconds: 5` with `failureThreshold: 3`, giving a throttled pod more room to answer before being considered unhealthy, rather than removing or loosening the resource limits themselves (which are what actually makes the HPA's CPU-percentage metric meaningful in the first place).

## Autoscaling and load test results

- Applied the `backend-hpa` HorizontalPodAutoscaler (target 50% CPU, min 2 / max 5 replicas). Confirmed it read real metrics (`cpu: 1%/50%`) rather than `<unknown>`, which would have meant Metrics Server wasn't reachable.
- Ran `ab -n 50000 -c 100 -t 120 http://localhost:30050/products`: 43,156 requests completed, **0 failed requests**, ~360 req/sec sustained.
- Watched the HPA scale the backend Deployment from 2 → 5 replicas (its configured max) as CPU utilization climbed to 253% of the target during the load test.
- After the load test ended, confirmed the HPA's default 5-minute stabilization window before scaling back down — after waiting it out, the deployment returned to 2 replicas with CPU back down to ~1%, and the two remaining pods had 0 restarts.

# Troubleshooting Log — Task 13 (Helm Packaging & Ingress)

## Kind cluster had to be recreated for Ingress support

The existing Kind cluster (alive since Task 9) only had `extraPortMappings` for the app's own NodePorts (30050/30080), not the standard ports 80/443 that an Ingress controller needs, and no node carried the `ingress-ready` label ingress-nginx's Kind-specific manifest expects. Recreated the cluster with both: `extraPortMappings` for 80/443 (in addition to keeping 30050/30080) and a `kubeadmConfigPatches` entry labeling the control-plane node `ingress-ready=true`. This reset the MongoDB PVC (Kind's local-path-provisioner storage lives inside the node's container filesystem, not external to the cluster), which was fine since it only held demo signups. Metrics Server also had to be reinstalled for the same reason — anything that isn't in a manifest gets lost when the cluster itself is torn down.

## Issue: Ingress returned "Connection reset by peer" on every request

**Symptom**: The ingress-nginx controller pod was `Running`/`1/1 Ready`, its `Service` and the `Ingress` resource both looked correct, but every `curl` to `http://localhost/` (and to the frontend/backend via the Ingress host header) failed with `Connection reset by peer`.

**Root cause**: `kubectl get pod -n ingress-nginx -o wide` showed the controller scheduled on `ecommerce-worker`, not `ecommerce-control-plane`. Since the container's `hostPort: 80`/`443` only actually forward to the host on the control-plane node (that's the only node with those `extraPortMappings` in the Kind config), a pod running the same hostPort spec on a *different* node has nothing listening on the EC2 host's port 80/443 — Docker forwards the connection into the control-plane container regardless of where the pod actually is, and since nothing inside that container is listening, the kernel sends a TCP reset. Checked the Deployment's `nodeSelector` and found it only required `kubernetes.io/os: linux` — the `ingress-ready` node-pinning that older/other versions of this manifest included wasn't present.

**Fix**: Patched the `ingress-nginx-controller` Deployment's `nodeSelector` to require `ingress-ready: "true"` in addition to the OS selector, forcing it onto the correctly-configured control-plane node. After the rollout, both `/` (frontend) and `/api/health` (backend, via the Ingress's rewrite rule) returned `200`.

## Helm chart structure

Converted the raw `k8s/*.yaml` manifests into `helm/ecommerce/` (`Chart.yaml`, `values.yaml`, `templates/`), parameterizing image repository/tag, replica counts, ports, resource limits, HPA thresholds, and Ingress host/class. `secret.jwtSecret` defaults to a placeholder in `values.yaml` (never a real committed secret) and is overridden at install/upgrade time with `--set secret.jwtSecret=<generated-value>`, matching the pattern already used for the raw manifests' Kubernetes Secret.

## Verification performed

- `helm lint helm/ecommerce` — passed (only a cosmetic "icon is recommended" note).
- `helm template` reviewed before installing, to catch templating mistakes without touching the cluster.
- `helm install` — all resources (Deployments, Services, StatefulSet+PVC, ConfigMap, Secret, HPA, Ingress) created successfully; PVC `Bound`; all pods `Running`.
- Frontend and backend both reachable and functioning through the Ingress (`Host: ecommerce.local`), including a full `POST /api/signup` round-trip to MongoDB.
- `helm upgrade` verified by bumping `frontend.replicaCount` from 2 to 3 via `--set` — release moved to revision 2 and Kubernetes scaled the Deployment accordingly, with no manual `kubectl` commands needed.

# Troubleshooting Log — Task 14 (GitOps with ArgoCD + Image Updater)

## Issue: ArgoCD's own CRDs failed to install

**Symptom**: `kubectl apply -n argocd -f <official install.yaml>` applied everything except one CRD, failing with `The CustomResourceDefinition "applicationsets.argoproj.io" is invalid: metadata.annotations: Too long: must have at most 262144 bytes`.

**Root cause**: `kubectl apply` stores the entire previous manifest in a `kubectl.kubernetes.io/last-applied-configuration` annotation for 3-way merge diffing. ArgoCD's CRDs are large enough that this annotation itself exceeds Kubernetes' 256KiB annotation size limit.

**Fix**: Re-ran with `--server-side --force-conflicts`, which uses server-side apply (tracks field ownership instead of a client-side annotation) and has no such size limit. Used the same flags for the ArgoCD Image Updater install later for consistency.

## Issue: ArgoCD couldn't clone the repo — "Repository not found"

**Symptom**: The `Application` resource sat at `SYNC STATUS: Unknown` with a `ComparisonError` condition: `failed to list refs: authentication required: Repository not found.`

**Root cause**: `Jamesokooboh/e-commerce` is a private repo; ArgoCD's repo-server was trying to clone it unauthenticated, and GitHub returns a 404 (not a 401) for unauthenticated requests against private repos, which is what produces the misleading "not found" message.

**Fix**: Created a `Secret` in the `argocd` namespace labeled `argocd.argoproj.io/secret-type: repository`, with `type=git`, `url=https://github.com/Jamesokooboh/e-commerce.git`, `username=x-access-token`, and `password=<GitHub token>` (piped in directly from `gh auth token`, never typed or logged in plaintext, since token handling is a step best done by hand rather than scripted by an assistant). After a hard refresh (`kubectl patch application ecommerce -n argocd --type merge -p '{"metadata":{"annotations":{"argocd.argoproj.io/refresh":"hard"}}}'`), the Application moved to `Synced`/`Healthy`.

## ArgoCD Application

`argocd/application.yaml` defines the `ecommerce` Application: source is `helm/ecommerce` on `feature/James-Okooboh`, destination is the `ecommerce` namespace, with `syncPolicy.automated` (`prune: true`, `selfHeal: true`) so it reconciles without manual `kubectl apply`/`argocd sync` calls.

## GitOps sync verified for real

Bumped `frontend.replicaCount` from 2 to 3 in `values.yaml`, committed, and pushed to `feature/James-Okooboh` — deliberately did *not* trigger a manual refresh, to prove the polling loop itself works. ArgoCD detected the change on its own (~3 min default poll interval) and rolled out the third frontend replica with no intervention: `GitHub → ArgoCD → Kubernetes` confirmed end-to-end.

## Issue: ArgoCD Image Updater ignored all the documented annotations

**Symptom**: Installed the Image Updater from its `master` branch manifest. Pods came up healthy, but logs showed `No ImageUpdater CRs to process` and never looked at the `argocd-image-updater.argoproj.io/*` annotations already set on the `ecommerce` Application.

**Root cause**: `master` (and the `v1.x` tags) turned out to be a ground-up rewrite that reads a new `ImageUpdater` custom resource instead of annotations on the `Application` — a breaking change not obvious from the repo's top-level layout (the classic `manifests/` directory was replaced with `config/`, and the `stable` branch this project's original tutorial referenced no longer exists at all, returning a plain 404). Checked the release tags directly (`gh api repos/argoproj-labs/argocd-image-updater/tags`) and found the annotation-based tool tops out at `v0.18.0` — versions `v1.0.0`+ are the CRD rewrite.

**Fix**: Deleted the `v1.x` Deployment, ServiceAccount, Roles/RoleBindings, ClusterRoles/ClusterRoleBindings, and the `ImageUpdater` CRD it installed, then applied `https://raw.githubusercontent.com/argoproj-labs/argocd-image-updater/v0.18.0/manifests/install.yaml` instead. Its logs immediately showed `Starting image update cycle, considering 1 annotated application(s) for update`.

## Image Updater configuration

Annotations on `argocd/application.yaml`:
- `image-list`: which image(s) to track and their alias (initially `backend`+`frontend`, later `backend` only — see below).
- `<alias>.update-strategy: latest`: pick the most recently *built* matching tag, not the highest lexical/semver one (the app's tags are plain integers pushed by Jenkins, not semver).
- `<alias>.allow-tags: regexp:^[0-9]+$`: restricts the updater to numeric tags only, so it never mistakes the mutable `latest`/`k8s` tags for a real version to roll forward to.
- `<alias>.helm.image-tag`: maps the discovered tag to the chart's actual values path (`backend.image.tag` / `frontend.image.tag`).
- `write-back-method: git`: commit the change back to the tracked branch instead of just mutating the live Argo `Application` object, so the desired state stays in git.

## Automatic image update verified for real

Docker Hub already had `okoobohjames/ecommerce-backend:9` and `ecommerce-frontend:9`, both newer builds than what was deployed (`latest`/`k8s`). Within one polling cycle, Image Updater:
1. Detected both new tags.
2. Wrote a Helm parameter override to `helm/ecommerce/.argocd-source-ecommerce.yaml`, committed as itself (`argocd-image-updater <noreply@argoproj.io>`) and pushed to `feature/James-Okooboh` — no human commit involved.
3. ArgoCD picked up the new commit and rolled both Deployments to `:9`.

`Code → Docker image → registry → Image Updater → Helm → ArgoCD → Kubernetes` confirmed end-to-end, with `images_updated=2, errors=0` in the updater's log.

## Issue: auto-updated frontend silently broke frontend→backend calls

**Symptom**: After the automatic update above, both Deployments reported `Running`/`1/1`, ArgoCD showed `Healthy`, and `curl` to both NodePorts returned `200` — everything *looked* fine from the infrastructure side.

**Root cause**: `okoobohjames/ecommerce-frontend:9` is a generic build from the Jenkins pipeline; only the special `:k8s` tag was built with `--build-arg REACT_APP_BACKEND_URL=http://<EC2 IP>:30050` baked in for this Kind/NodePort setup (see the Task 9/known-follow-up note about that tag's IP going stale). Confirmed by `grep`-ing the built JS bundle inside the running pod (`kubectl exec ... grep -oE 'https?://...' main.*.js`): `:9` had `http://localhost:5000` hardcoded, which resolves to nothing from a real browser. A liveness/readiness probe or a plain `curl /` can't catch this — the container is healthy, the page loads, only an actual API call from a browser would fail.

**Fix**: Removed `frontend` from the Image Updater's `image-list` annotation entirely (backend only) and reverted the `.argocd-source-ecommerce.yaml` override so `frontend.image.tag` falls back to the chart's `k8s` default. **Lesson**: an image auto-update policy has to match how each image is actually *built*, not just tagged — tracking "any new numeric tag" is safe for a build that's URL-agnostic (backend) and unsafe for one that bakes in environment-specific config at build time (this frontend). The frontend image's `:k8s` tag itself still carries the older Elastic-IP-migration follow-up noted in memory; auto-updating it wouldn't have fixed that, only masked it with an even more broken build.

## Final verification

- `kubectl get application ecommerce -n argocd` → `Synced` / `Healthy`.
- `kubectl get pods -n ecommerce` → backend (`:9`, auto-updated) and frontend (`:k8s`, pinned) all `Running`, `1/1`.
- `curl http://localhost:30080/` → `200`; `curl http://localhost:30050/products` → `200` (`GET /products`, not `/api/products` — the backend has no `/api` prefix).

# Troubleshooting Log — Task 15 (CI/CD Integration: Jenkins → Docker Hub → ArgoCD Image Updater → GitOps)

## Kind cluster survived an EC2 stop/start after all

**Context**: the instance was stopped between Task 14 and Task 15 to save cost. Prior notes here (and in project memory) assumed a stop/start would wipe the Kind cluster, ArgoCD, and the whole `ecommerce` deployment, requiring a full rebuild.

**What actually happened**: after `start-instances`, every Kind node container came back up on its own (Docker's restart policy), etcd's data was still on the container's filesystem since the container was only stopped, not removed, and every pod — ArgoCD, Image Updater, ingress-nginx, Metrics Server, the app itself — self-healed to `Running`/`Synced`/`Healthy` within about 2 minutes with zero manual steps. The earlier assumption was simply wrong (or was true of an older Kind/Docker Desktop combination this environment doesn't match). Corrected in project memory so future sessions check state first instead of blindly re-running the full install sequence.

## Issue: Image Updater wasn't picking up newer backend tags after restart

**Symptom**: Docker Hub already had `okoobohjames/ecommerce-backend` tags up through `:17` (Jenkins auto-builds via the GitHub webhook on every push, including Task 14's config-only commits), but the deployed backend stayed on `:9` and the updater's logs showed `images_considered=1, images_updated=0` every cycle with no explanation.

**Root cause**: bumped the updater to `--loglevel debug` temporarily and found the real reason: `found 17 from 17 tags eligible for consideration ... Image 'okoobohjames/ecommerce-backend:9' already on latest allowed version`. The `latest`/`newest-build` strategy ranks tags by the *build timestamp baked into the image config*, not by when the tag was pushed to the registry. Tags `10`–`17` were all produced by Jenkins builds triggered by Task 14 pushes that never touched `backend/` or `frontend/` source (only `values.yaml`, `argocd/application.yaml`, `TROUBLESHOOTING.md`) — Docker's build cache reused the exact same layers each time, so those tags are byte-identical images with the same underlying creation timestamp as `:9`, just re-pushed under new tag numbers. The updater was correct: there was no real new build to roll out.

**Fix**: not a bug to fix — a reminder that "a new tag exists" and "a new build exists" aren't the same thing when the build has caching. Reverted the debug logging once the cause was clear (`kubectl patch deployment argocd-image-updater ... args: ["run"]`).

## Automatic image update verified with a real code change

To prove the chain end-to-end (not just re-tag detection), made an actual source change: added a `build` field to `GET /health` (`backend/server.js`), sourced from a new `BUILD_NUMBER` build-arg (`backend/Dockerfile`), wired through the Jenkinsfile (`docker build --build-arg BUILD_NUMBER=${IMAGE_TAG} ...`). This both gives a genuine way to confirm which build is actually running (useful for exactly this kind of verification going forward) and, more importantly here, actually invalidates Docker's build cache.

Result, fully automatic after the `git push`:
1. GitHub webhook → Jenkins build `#18` → pushed `okoobohjames/ecommerce-backend:18` to Docker Hub.
2. Image Updater's next poll cycle found it, wrote the Helm override to `.argocd-source-ecommerce.yaml`, committed and pushed it as itself.
3. ArgoCD synced the new commit and rolled the backend Deployment to `:18`.
4. `curl http://localhost:30050/health` → `{"status":"ok","database":"connected","build":"18"}` — the live container is genuinely running the new build, not a re-tag.

`GitHub → Jenkins → Docker Image → Docker Hub → ArgoCD Image Updater → Helm/Git → ArgoCD → Kubernetes` confirmed working end-to-end with zero manual steps after the initial push.
