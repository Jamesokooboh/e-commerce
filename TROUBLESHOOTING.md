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

# Troubleshooting Log — Task 16 (Terraform: VPC, Bastion, Private Kubernetes, ALB)

## Environment

A brand-new environment, entirely separate from the `miseacademy-dev` instance and default VPC used in Tasks 1–15: a purpose-built VPC (`terraform/`) with 2 AZs × (1 public + 1 private subnet), a single shared NAT Gateway, a `t3.micro` bastion in a public subnet, and a private EC2 instance running a single-node Kind cluster, fronted by a manually-created ALB (per the task doc's explicit instruction not to use Terraform for the ALB). Reused the existing `helm/ecommerce` chart as-is for the app.

## Issue: Ubuntu AMI data source returned no results

**Symptom**: `terraform plan` failed with `Error: Your query returned no results` on the `aws_ami` data source.

**Root cause**: the AMI name filter used the old `hvm-ssd-gp3` naming; current Canonical Ubuntu 22.04 AMIs in `us-east-1` are published under `ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*` (checked directly with `aws ec2 describe-images --owners 099720109477`).

**Fix**: corrected the filter pattern in `terraform/ec2.tf`.

## Issue: private EC2 instance rejected at apply time — not Free Tier eligible

**Symptom**: `aws_instance.private` failed with `InvalidParameterCombination: The specified instance type is not eligible for Free Tier`, after everything else (VPC, subnets, NAT Gateway, bastion) had already been created successfully.

**Root cause**: this AWS account is restricted to Free-Tier-eligible instance types only, and the originally-planned `t3.medium` isn't on that list. `aws ec2 describe-instance-types --filters Name=free-tier-eligible,Values=true` showed the actual eligible set for this account includes `c7i-flex.large` (2 vCPU / 4GB) — more than enough for a single-node Kind cluster.

**Fix**: switched `private_instance_type` to `c7i-flex.large` and re-applied; only the one instance needed creating, everything else was already up.

## SSH ProxyJump needed host-key trust on both hops

**Symptom**: `ssh -J ubuntu@<bastion> ubuntu@<private-ip> ...` failed with `Host key verification failed`, even with `-o StrictHostKeyChecking=no` on the outer command.

**Root cause**: `-o` flags on the outer `ssh` invocation don't automatically propagate to the implicit jump-host connection `-J` opens; each hop negotiates its own host key independently.

**Fix**: used an explicit `-o ProxyCommand="ssh ... -o StrictHostKeyChecking=no -W %h:%p ubuntu@<bastion>"` instead of `-J`, which puts `StrictHostKeyChecking=no` on both the jump connection and the final one.

## AWS CLI on Git Bash mangled a bare `/` argument

**Symptom**: `aws elbv2 create-target-group --health-check-path /` failed with `Health check path 'C:/Program Files/Git/' must begin with a '/' character`.

**Root cause**: Git Bash's MSYS layer rewrites bare-looking Unix paths in command arguments into Windows paths before the AWS CLI ever sees them — a Windows-specific quirk, not an AWS or Terraform issue.

**Fix**: prefixed the command with `MSYS_NO_PATHCONV=1` to disable that rewriting for the one call.

## Issue: frontend baked in an unreachable backend URL (again)

**Symptom**: after deploying the app and creating the ALB (frontend only, on port 80), the frontend loaded fine through the ALB, but this is the exact same class of bug hit in Tasks 9/14/15 — checked for it deliberately this time before calling it done, rather than after a user reported it broken.

**Root cause**: `frontend.image.tag` in `values.yaml` still points at the `:k8s` tag build, which has the *old* environment's Elastic IP (`44.194.117.44:30050`) baked in as `REACT_APP_BACKEND_URL` — meaningless in this brand-new VPC. Docker Hub also had no build with this environment's ALB DNS name baked in (it doesn't exist until the ALB is created, which happens after the image would need to be built).

**Fix**: rather than pushing yet another tag to the shared Docker Hub repo for a throwaway environment, built the frontend image directly on the private instance (`docker build --build-arg REACT_APP_BACKEND_URL=http://<alb-dns>:5000 ...`, source `scp`'d over via the bastion) and loaded it straight into the Kind cluster with `kind load docker-image` — no registry, no credentials, nothing published outside this cluster. `helm upgrade --set frontend.image.repository=... --set frontend.image.tag=task16` switched the Deployment to it.

## Issue: backend had no path through the ALB at all

**Symptom**: the ALB's single target group only covered the frontend NodePort (30080); the backend NodePort (30050) had no route from outside the VPC, so even with the frontend's backend URL fixed, actual API calls would have nowhere to go.

**Fix**: added a second target group (`ecommerce-task16-tg-backend`, port 30050, health check `/health`) and a second ALB listener on port 5000 forwarding to it, plus the matching security-group ingress rule. `curl http://<alb-dns>:5000/health` confirmed it end-to-end.

## Issue: CORS rejected the new frontend origin

**Symptom**: with both the frontend URL and backend routing fixed, a real cross-origin request (sent with an `Origin` header matching the ALB, the way a browser would) still needed checking — the backend's CORS middleware (`backend/server.js`) is configured with `origin: process.env.REACT_APP_FRONTEND_URL`, sourced from the Helm chart's `config.frontendUrl`, which was still set to the *old* environment's frontend URL.

**Fix**: `helm upgrade --set config.frontendUrl=http://<alb-dns>` plus `kubectl rollout restart deployment/backend` (a ConfigMap value change alone doesn't restart existing pods). Verified with `curl -H "Origin: http://<alb-dns>" ...` and confirmed `Access-Control-Allow-Origin` echoed back the correct origin.

## Terraform state drift from a manual mid-task fix

The backend ALB listener above required opening port 5000 on the ALB's security group, done via `aws ec2 authorize-security-group-ingress` in the moment rather than round-tripping through Terraform. Added the equivalent `ingress` block to `aws_security_group.alb` in `terraform/ec2.tf` afterward and re-ran `terraform plan`/`apply` — it correctly reconciled the drift (updated the existing security group in place, not a resource replacement) and a follow-up `terraform plan` showed a clean "No changes."

## Unrelated: local working tree had a stray `frontend/` deletion

Discovered mid-task that `frontend/` showed as fully deleted in `git status` on this machine, with an untracked byte-identical duplicate sitting at `docs/frontend/` (dated before this session — not something this session did). Confirmed via `git diff HEAD -- frontend/` and a content diff against the duplicate that nothing was actually lost (GitHub's `origin` was never affected, since this was a local-only uncommitted change, and Jenkins builds from `origin` directly, not this checkout). Restored with `git restore frontend/`, then removed the now-redundant `docs/frontend/` duplicate.

## Final verification

- `terraform plan` → clean, no drift, after every manual/CLI-driven change was folded back into the `.tf` files.
- Private instance confirmed to have **no direct public reachability**: `curl` from outside the VPC to `10.0.10.22:30080` timed out, while the same request through the ALB returned `200` — proving the private subnet routing is real, not just labeled.
- Both ALB target groups (`frontend` on 30080, `backend` on 30050) report `healthy`.
- `curl http://<alb-dns>/` returns the real app HTML (not a placeholder), and the served JS bundle was `grep`'d directly to confirm it contains the *correct* backend URL for this environment.
- `curl -H "Origin: http://<alb-dns>" http://<alb-dns>:5000/products` returns `200` with a matching `Access-Control-Allow-Origin` header — a genuine cross-origin request succeeds, not just a same-origin health check.

# Troubleshooting Log — Task 17 (Blue/Green Deployment & Rollback with Kubernetes and Terraform)

## Closing a debt from Task 16: runtime config injection for the frontend

Task 16's retrospective flagged that the frontend baking `REACT_APP_BACKEND_URL` in at Docker build time was the root cause behind the same class of bug recurring in Tasks 9, 14, 15, and 16 — each fix was operational (rebuild, retag, redeploy) rather than structural. Fixed it for real this time instead of deferring again:

- `frontend/Dockerfile` no longer takes `REACT_APP_BACKEND_URL` as a build arg.
- `frontend/docker-entrypoint.d/20-env-config.sh` runs automatically at container start (the official nginx image convention `nginxinc/nginx-unprivileged` also honors) and `sed`-substitutes a `BACKEND_URL` container env var into `frontend/public/env.template.js` → `env.js`, served as a plain static file.
- `frontend/public/index.html` loads `env.js` before the React bundle.
- All 14 call sites across 8 components now import `BACKEND_URL` from a new `frontend/src/config.js` (`window.__ENV__.BACKEND_URL`) instead of reading `process.env.REACT_APP_BACKEND_URL` — verified with a `grep` for zero remaining matches.
- `helm/ecommerce` gained `config.backendUrl`, wired to a `BACKEND_URL` env var on the frontend container, mirroring how the backend already gets `FRONTEND_URL` for CORS.

**Issue: `RUN chmod +x` failed with "Operation not permitted"** — `nginxinc/nginx-unprivileged` sets its own non-root default user in the base image itself, before my Dockerfile's own (redundant-looking) `USER 101` line ever executes, so the `COPY`/`RUN` steps for the entrypoint script were already running unprivileged. **Fix**: added an explicit `USER root` at the top of the runtime stage, before any commands that need root, with `USER 101` still switching back to unprivileged at the end for the actual container runtime.

**Verified for real, not just by reading the Dockerfile**: one frontend image, built once, deployed to two different namespaces with two different `BACKEND_URL` values via Helm, and `curl <host>/env.js` on each confirmed the correct value was actually substituted — not the `__BACKEND_URL__` placeholder (would mean the `sed` silently failed) and not the dev-default baked into the image (would mean the entrypoint script never ran at all).

## Issue: green's NodePorts were completely unreachable from the host

**Symptom**: after deploying `green` with different NodePorts (`30051`/`30081`) than `blue` (`30050`/`30080`), `curl localhost:30081` on the private instance itself returned nothing — not even a connection refused, just `curl: (7) Failed to connect`.

**Root cause**: Kind maps host ports into the control-plane container only via `extraPortMappings` set at `kind create cluster` time, and `terraform/user_data.sh`'s `kind-config.yaml` only listed the original two ports (`30050`/`30080`) from Task 16. Extending `terraform/variables.tf`'s `app_node_ports` (which drives the *security group* rules) had no effect on Kind's own port forwarding — these are two separate, unrelated mechanisms that happen to need the same numbers kept in sync manually. Green's Kubernetes Services existed and were correctly configured; they were just never reachable from outside the Kind container at all.

**Fix**: updated `user_data.sh`'s `kind-config.yaml` to include all four ports, then — since Kind's port mappings can't be changed on a running cluster — `kind delete cluster` + `kind create cluster` with the corrected config, and redeployed both `blue` and `green` from scratch. Confirmed via `curl localhost:30081` going from `000` to `200` after the fix.

## Finding: an ALB target group in a group not attached to any listener is never health-checked at all

While green's backend was still deliberately broken, checking its target groups' health expecting `unhealthy` instead returned `"State": "unused", "Reason": "Target.NotInUse"` — for *both* the broken backend and the actually-healthy frontend. An ALB simply doesn't run health checks against a target group until it's referenced by a listener's default action or a rule; being registered as a target isn't enough. This corrected the plan mid-task: "test green independently before switching," as the doc puts it, has to mean testing directly against green's own NodePorts, not via ALB target health, since the ALB is structurally incapable of observing an unattached target group's state.

## Issue: the first two attempts to break green's backend for the rollback test didn't actually break anything

Wanted a second, different failure mode (not another bad image tag) to test the rollback path specifically. Two attempts before finding one that worked:

1. `--set mongo.port=27018` — the chart's `mongo-statefulset.yaml` template uses `.Values.mongo.port` for **both** Mongo's own listening port and the backend's `MONGO_URI` construction, so overriding it moved both sides together and they stayed connected. `/health` kept reporting `"database":"connected"` throughout.
2. `kubectl set env deployment/backend -n green MONGO_URI=mongodb://nonexistent-mongo-host:27017/...` — this genuinely broke the *new* pod, but the Deployment's `RollingUpdate` strategy kept the old, still-healthy pod serving traffic the entire time (a pod that fails its own readiness probe never becomes a Service endpoint, so the Service/NodePort only ever routed to the one pod that still worked). `/health` still returned `200` — the rolling update was silently masking the failure by design, which is usually exactly what you want, but defeated the point of this specific test.

**Fix**: found the old ReplicaSet was still holding its full `replicas: 1` (Kubernetes never scaled it down, since the new ReplicaSet never passed readiness — that's how `RollingUpdate` is supposed to behave). Scaled it to `0` directly (`kubectl scale replicaset <old-rs> --replicas=0`) to force a genuine full outage. Confirmed via the health endpoint going from `200` to `000`, and the ALB target group correctly flipping to `unhealthy`/`Target.FailedHealthChecks` shortly after — this is the actual "detect the failure" moment of the workflow, driven by a real backend outage rather than a synthetic one.

## Full workflow verified end-to-end

1. `blue` deployed, verified fully working through the ALB (frontend `200`, backend health `200`, real cross-origin request with matching `Access-Control-Allow-Origin`).
2. `green` deployed with a broken image tag — confirmed `ImagePullBackOff`, confirmed switching now would have served a broken app (backend not reachable at all, even directly).
3. `green`'s tag fixed, redeployed, verified independently healthy (its own NodePorts, its own `env.js`) *before* touching the ALB, per the doc's own ordering.
4. Both ALB listeners (`80`→frontend, `5000`→backend) switched from blue's target groups to green's via `aws elbv2 modify-listener` — confirmed traffic actually moved with a real cross-origin request through the switched listener, not just a config check.
5. `green` broken a second way (bad Mongo connectivity, forced to a genuine full outage as above) — ALB correctly detected it as `unhealthy`.
6. Both listeners switched back to blue — confirmed blue fully functional again post-rollback (one transient `502` immediately at the switch, self-resolved on retry — ALB listener config changes take a moment to propagate across its underlying nodes, worth expecting on any live switch).

`Users → ALB → Blue → Version 1` → switch → `Users → ALB → Green → Version 2` → simulated failure → detected via ALB → rollback → `Users → ALB → Blue → Version 1` confirmed working, matching the task doc's expected workflow exactly.

# Troubleshooting Log — Task 18 (Monitoring Kubernetes Applications with CloudWatch, Prometheus & Grafana)

## Environment

Reused `miseacademy-dev` (the long-running instance from Tasks 1–15, default VPC) rather than a new one, since the task doc just asks for "an EC2 instance using the default VPC" and this one already had Docker/Kind set up. Everything self-healed on restart as expected from earlier findings — except SSH itself, see below.

## Issue: SSH timed out on restart, looked like a boot delay, wasn't

**Symptom**: `ssh ... ubuntu@44.194.117.44` timed out repeatedly after `aws ec2 start-instances`, even though `describe-instance-status` reported both system and instance status checks as `ok`.

**Root cause**: the instance's security group only allowed SSH from a specific `/32` CIDR pinned to whatever the operator's IP was during an *earlier* session — which had since changed. AWS's own health checks were correctly green; the block was a stale allow-list entry, not a boot issue.

**Fix**: `aws ec2 revoke-security-group-ingress` the old CIDR, `authorize-security-group-ingress` the current one (`curl -s https://checkip.amazonaws.com`). Worth checking this before assuming a "running" instance with passing health checks that still won't SSH is just slow to boot.

## No IAM role was ever attached to this instance

The CloudWatch agent needs permission to push metrics/logs, and nothing had been set up for that across 17 prior tasks (never needed until now). Created `ecommerce-cloudwatch-agent-role` (trust policy for `ec2.amazonaws.com`) with the AWS-managed `CloudWatchAgentServerPolicy`, wrapped it in an instance profile, and attached it to the running instance with `aws ec2 associate-iam-instance-profile` — this works without a reboot.

## Issue: CloudWatch agent couldn't read `/var/log/syslog`

**Symptom**: the agent's own log showed a continuous stream of `Failed to tail file /var/log/syslog with error: open /var/log/syslog: permission denied`, and the `/ecommerce/system` log group never got created at all.

**Root cause**: the agent config sets `run_as_user: cwagent`, and `/var/log/syslog` is only group-readable (`syslog:adm`, mode `640`). The `cwagent` user wasn't in the `adm` group.

**Fix**: `sudo usermod -aG adm cwagent`, restart the agent.

## Issue: network metrics never appeared

The agent config's `net` block listed `eth0` as the interface to collect from — copied from generic documentation without checking this instance. `ip -brief addr` showed the actual interface is `ens5` (standard on newer AWS Nitro-based instance types). Fixed by editing the interface name and re-applying the config.

## Reaching Kubernetes pod logs from CloudWatch doesn't work the way the docs imply, for a Kind cluster

CloudWatch's file-based log collection is a host-level agent tailing plain files. On EKS or ECS, Container Insights bridges that gap for you; on a **Kind** cluster, the pods run inside containerd nested inside the Kind node's own Docker container — their logs never land on the EC2 host's filesystem at all, so there's nothing for the agent to tail directly.

**Fix**: a small script (`monitoring/collect-k8s-logs.sh`) runs every minute via cron, does `kubectl logs --since=70s` across every pod in the `ecommerce` namespace, and appends the output (prefixed per-pod) to a plain file the CloudWatch agent already knows how to watch. Not as instant as a real streaming log driver, but genuinely reliable and needed no extra components (no Fluent Bit, no CloudWatch Container Insights, neither of which actually apply to a self-managed Kind cluster).

## Issue: `helm install --wait` timed out installing kube-prometheus-stack, and the actual reason was a full disk

**Symptom**: `helm install ... --wait --timeout 5m` failed with `context deadline exceeded`. `kubectl get pods -n monitoring` showed `grafana` and `prometheus` stuck in `ImagePullBackOff` while `node-exporter`, `kube-state-metrics`, and the operator itself all came up fine.

**Root cause**: `kubectl describe pod` on the stuck pods showed the real error underneath: `failed to pull and unpack image ...: no space left on device`. The Kind cluster was over 4 days old (survived several stop/starts across Tasks 15–17) and had accumulated enough image layers from dozens of different task deployments that the host's 20GB root EBS volume was at 100% (`df -h /` — `20G 20G 46M`). `docker system df` only showed ~7GB tracked, well under the actual 20GB used, which was the first clue this wasn't a normal "just prune images" situation — the gap was mostly untracked overlay2 diff layers, not something a targeted cleanup command would find by category.

**Fix**: `docker system prune -af` freed 4.2GB (down to 80% usage, 3.9GB free) — enough headroom to unblock the pulls. Deleted the two stuck pods so Kubernetes recreated them against the now-available space; both came up healthy within a minute. Worth checking disk space *before* investigating a stuck deployment on a cluster that's been alive for several days across many tasks, rather than assuming it's a networking or registry problem.

## Grafana dashboards

Rather than hand-building dashboards from scratch, imported two well-established community dashboards via Grafana's own import API (fetching the JSON from `grafana.com`'s public download endpoint and POSTing it to `/api/dashboards/import` with the local Prometheus datasource substituted in): **Node Exporter Full** (ID `1860`) for infrastructure metrics, and **Kubernetes cluster monitoring via Prometheus** (ID `315`) for cluster/pod-level metrics. Built one small custom dashboard (`monitoring/grafana-dashboard-ecommerce-app.json`) for what those two don't cover — backend/frontend container CPU, memory, pod status, and restart rate scoped specifically to the `ecommerce` namespace.

## Verified with real load and a real application error, not synthetic checks

- `ab -n 20000 -c 50 -t 90` against the backend: 40,148 requests completed, **0 failed**, ~446 req/sec sustained. Confirmed the load actually registered in the monitoring pipeline (not just that `ab` ran) by querying Prometheus directly for `container_cpu_usage_seconds_total` on the backend pods during the test window — non-zero, moving.
- Deliberately triggered a real application error rather than assuming the alarm would work: `GET /not-a-valid-object-id` hits the backend's `/:id` catch-all route (the same route implicated in Task 1's very first bug, still present) and throws an unhandled Mongoose `BSONError` when it tries to cast the string to an ObjectId — a genuine, unhandled error, not a mocked one.
- **Notable finding**: the pods showed **zero restarts** throughout — the app's process-level safety net (added back in Task 2) caught the error without crashing the container. That's good application behavior, but it also means pod-restart-count alone would never have surfaced this error to anyone watching dashboards. The log-pattern-based CloudWatch alarm (`ecommerce-app-errors`, a metric filter on `/ecommerce/k8s/pods` matching `ERROR`/`Exception`/`Failed`/5xx) caught it and flipped to `ALARM` within a minute — a concrete demonstration of why log-based alerting matters even for an app that degrades gracefully.
- All three alarms confirmed in genuinely correct states afterward: `ecommerce-high-cpu` and `ecommerce-high-memory` settled to `OK` (load wasn't sustained/heavy enough to cross 70%/80%), `ecommerce-app-errors` in `ALARM` (the real error above).

## Issue: the CPU alarm silently never left `INSUFFICIENT_DATA`

**Symptom**: `ecommerce-high-memory` (created with the same pattern, same dimension) settled into `OK` within a couple of minutes; `ecommerce-high-cpu` stayed on `INSUFFICIENT_DATA` indefinitely — worth checking rather than assuming it just needed more time, since `describe-alarms`'s `StateReason` for it never advanced past "Unchecked: Initial alarm creation" even minutes later, which memory's `OK` status disproved as a simple timing issue.

**Root cause**: `aws cloudwatch list-metrics` on `cpu_usage_user` showed the real, published metric carries **two** dimensions — `host` and `cpu=cpu-total` (from the agent config's `totalcpu: true`) — but the alarm was only created with the `host` dimension. CloudWatch alarms require an **exact** dimension match, not a subset; a metric published with an extra dimension the alarm doesn't specify simply never matches. `mem_used_percent` only ever carries the single `host` dimension, which is why that alarm worked immediately with the same approach.

**Fix**: recreated the alarm with both dimensions (`Name=host,Value=<host> Name=cpu,Value=cpu-total`). Settled into a real `OK` state within the next evaluation period. Worth checking `list-metrics`' actual dimension set for a new custom-namespace metric before wiring an alarm to it, rather than assuming the dimensions used in a `put-metric-alarm` call will simply "match well enough."

## Reproducibility

All of the above is captured as code in `monitoring/` (`cloudwatch-agent-config.json`, `collect-k8s-logs.sh`, `grafana-dashboard-ecommerce-app.json`, `setup.sh` running the SNS/alarm/agent/Prometheus commands end-to-end) rather than left as one-off CLI history — the network interface name in the CloudWatch config and the `host` dimension in `setup.sh`'s alarms are instance-specific and need checking against whatever instance this is re-run on.
