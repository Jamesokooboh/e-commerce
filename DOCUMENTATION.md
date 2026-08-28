# E-Commerce Platform — Comprehensive Documentation

Single entry point for the whole project: the MERN app itself, its API, and the
full DevOps journey (Docker → Kubernetes → GitOps → ECS → EKS → Monitoring →
RDS/Secrets → DNS/CDN) that was built on top of it across Tasks 1–22.

This file is an index and narrative — detailed step-by-step instructions for
each area already exist elsewhere in the repo and are linked rather than
duplicated.

## 1. What the app does

MERN-stack e-commerce site with two roles:

- **Retailer** — signs up, uploads products (image + details), edits/deletes
  their own products (`My Products`), views other retailers' listings.
- **Consumer** — browses/searches products, adds to cart, removes from cart,
  leaves reviews.

Auth is JWT (httpOnly cookie) plus Google OAuth (implicit flow via
`@react-oauth/google`). There is no checkout/payment step — "Buy Now" is
display-only; the real flow is add → view → remove from cart.

### Tech stack

| Area | Technology |
|------|------------|
| Frontend | React (CRA), Tailwind, Nginx (unprivileged) |
| Backend | Node.js, Express |
| Database | MongoDB (Mongoose) |
| Auth | JWT + bcrypt, Google OAuth |
| Containerization | Docker, Docker Compose, multi-stage builds |
| CI | Jenkins (`Jenkinsfile`) |
| Registries | Docker Hub, GHCR, ECR (GCP Artifact Registry validated once, then torn down) |
| Orchestration (evolution) | Kind → EKS, ArgoCD GitOps, ECS/Fargate (parallel exploration) |
| IaC | Terraform (VPC/EC2, EKS, RDS, state backend, Route53/S3/CloudFront/ACM) |
| Observability | CloudWatch (agent + alarms + SNS), Prometheus/Grafana |
| Edge/DNS | CloudFront, ACM, Cloudflare DNS (domain `benomhub.com`) |

### Repo layout

```
backend/        Express API + Mongoose schemas + handlers
frontend/       React app, runtime env.js config pattern, Nginx
docker-compose.yml   Local/production 3-container stack (mongo, backend, frontend)
k8s/            Plain Kubernetes manifests (backend, frontend, mongo, hpa, secret)
helm/ecommerce/ Helm chart used by ArgoCD (source of truth for k8s deploys)
argocd/         ArgoCD Application manifests (GitOps, incl. blue/green)
ecs/            ECS/Fargate task definitions (backend, frontend, mongo)
terraform/      IaC roots: root (EC2/VPC), eks/, rds/, state-backend/, task22/
monitoring/     CloudWatch agent config, Grafana dashboard, log-shipping scripts
static-site/    Task 22 checkpoint-1 static demo (superseded by real frontend build)
dynamic-site/   Task 22 checkpoint-2 stub Node app (superseded by real backend)
docs/task22/    Architecture, troubleshooting, and validation docs for Task 22
scripts/        Operational scripts (`verify-compose.sh`)
Jenkinsfile     CI: build → push (Docker Hub + ECR) → deploy via Compose
```

## 2. Running it locally

Full step-by-step (env vars, package managers, verification commands) is in
[README.md](README.md) — "Getting Started" and "Task 6: Docker Compose
Orchestration". Short version:

```bash
cp .env.example .env      # set JWT_SECRET (openssl rand -hex 32), Mongo/URIs
docker compose up --build -d
./scripts/verify-compose.sh
```

- Frontend: <http://localhost:3000> · Backend health: <http://localhost:5000/health>

## 3. Backend API reference

All routes in [backend/server.js](backend/server.js). `verifyToken` reads the
`token` httpOnly cookie; `checkRole("Retailer")` gates retailer-only routes.

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/signup` | — | Create account (name, email, password, role) |
| POST | `/oauth` | — | Google OAuth sign-in/sign-up |
| POST | `/login` | — | Email/password login, sets JWT cookie |
| POST | `/logout` | JWT | Clears the JWT cookie |
| POST | `/products` | JWT + Retailer | Create product (multipart image upload) |
| GET | `/products` | — | List all products |
| GET | `/my-products` | JWT + Retailer | List the caller's own products |
| PUT | `/products/:id` | JWT + Retailer (owner) | Edit own product |
| DELETE | `/products/:id` | JWT + Retailer (owner) | Delete own product |
| POST | `/cart` | JWT | Add item to cart |
| GET | `/cart` | JWT | View own cart |
| DELETE | `/cart` | JWT | Remove item from own cart |
| POST | `/searchProducts` | — | Regex search over products |
| POST | `/reviews` | JWT | Post a review |
| GET | `/reviews` | — | List reviews |
| GET | `/health` | — | `{status, database, build}` — DB connectivity + build number |
| GET | `/:id` | — | Fetch a single product by ID |

Security middleware: `helmet`, `cors` (origin allowlist from
`REACT_APP_FRONTEND_URL`, comma-separated for multi-domain),
`express-mongo-sanitize` (NoSQL injection), `express-validator` (input
validation on signup/login), `compression`. XSS is handled structurally by
React's text-node JSX rendering (no `dangerouslySetInnerHTML` anywhere) rather
than by escaping — see the Task 22 log entry below for why an escaping-based
fix was tried and reverted.

## 4. Frontend runtime configuration

The frontend does **not** bake `BACKEND_URL` into the Docker image at build
time (this was a recurring class of bug across Tasks 9/14/15/16 — see §6).
Instead:

- `frontend/docker-entrypoint.d/20-env-config.sh` runs on container start and
  `sed`-substitutes the `BACKEND_URL` container env var into
  `public/env.template.js` → `env.js`, served as a static file.
- `frontend/src/config.js` exports `BACKEND_URL` read from `window.__ENV__`;
  every component imports it from there, not from `process.env`.
- Helm exposes this as `config.backendUrl` → the frontend container's
  `BACKEND_URL` env var.

One value not yet migrated to this pattern: `REACT_APP_GOOGLE_CLIENT_ID` is
still a CRA build-time var (baked in at `npm run build`).

## 5. CI/CD

[Jenkinsfile](Jenkinsfile): checkout → build backend + frontend images →
push to Docker Hub (`okoobohjames/ecommerce-*`) and ECR → pull-verify → deploy
via `docker compose` on the target host → `curl` health checks. ArgoCD Image
Updater separately watches the Docker Hub tags for the Helm-deployed
environments and bumps `helm/ecommerce/.argocd-source-ecommerce.yaml`
automatically.

## 6. Infrastructure evolution (Task-by-task)

Each task iterated the same app onto a different deployment target — the app
code stayed constant; the infra pattern changed. Full details, gotchas, and
verification commands for each live in code (linked) plus the Task 22 docs.

| Task | What it added | Key files |
|------|----------------|-----------|
| 6 | Docker Compose 3-service stack, rootless containers, healthchecks | [docker-compose.yml](docker-compose.yml), [scripts/verify-compose.sh](scripts/verify-compose.sh) |
| 9/14/15 | First Kubernetes deploys, ArgoCD GitOps (`--server-side --force-conflicts` CRD install, Image Updater v0.18.0) | [k8s/](k8s), [helm/ecommerce/](helm/ecommerce), [argocd/](argocd) |
| 16/17 | Kind-on-EC2-in-a-VPC pattern (bastion + private instance), blue/green via 2 namespaces + 4 ALB target groups; **fixed the build-time-URL bug at the class level** (see §4) | [terraform/](terraform) (root), [argocd/application-blue.yaml](argocd/application-blue.yaml), [argocd/application-green.yaml](argocd/application-green.yaml) |
| 18 | Monitoring: CloudWatch agent + SNS + 3 alarms (CPU/memory/app-errors), kube-prometheus-stack with 3 Grafana dashboards | [monitoring/](monitoring) |
| 19 | ECS/Fargate: 3 tasks (backend/frontend/mongo), Cloud Map service discovery, JWT secret via SSM | [ecs/](ecs) |
| 20 | EKS via `terraform-aws-modules` (vpc/eks), EBS CSI driver + IRSA for dynamic PVCs, blue/green via ArgoCD Applications, no bastion needed | [terraform/eks/](terraform/eks) |
| 21 | RDS Postgres + Secrets Manager + S3/DynamoDB Terraform state backend | [terraform/rds/](terraform/rds), [terraform/state-backend/](terraform/state-backend) |
| 22 | Route 53/DNS fundamentals, S3 static hosting, EC2 dynamic hosting behind CloudFront, ACM + custom domain (`benomhub.com` via Cloudflare), cache invalidation + security hardening, all of it re-imported into Terraform | [terraform/task22/](terraform/task22), [docs/task22/](docs/task22) |

Every throwaway environment (Kind-on-EC2, ECS, EKS) was fully torn down after
its task; only the Task 22 production path (EC2 `task22-dynamic-site` +
CloudFront + `benomhub.com`) and the primary dev instance (`miseacademy-dev`,
running ArgoCD/Kind) are expected to be live/billing at any given time.

### Current production topology (benomhub.com)

```
Browser
  │
  ├─ https://benomhub.com, https://www.benomhub.com
  │     → CloudFront (E3R4FRZVP12JA5, CachingOptimized)
  │     → S3 static site bucket (real frontend production build,
  │        env.js → BACKEND_URL=https://app.benomhub.com)
  │
  └─ https://app.benomhub.com
        → CloudFront (E1IAULU29IDDD3, CachingDisabled + AllViewer origin
           request policy so CORS preflight headers reach the origin)
        → EC2 task22-dynamic-site: Nginx → Node backend (Docker) → MongoDB (Docker)
```

ACM cert (us-east-1, required for CloudFront) covers all three hostnames as
SANs on one certificate, DNS-validated via Cloudflare (domain registered
there, not Route 53 — Cloudflare Registrar can't delegate nameservers
elsewhere, so DNS stays on Cloudflare directly).

Annotated diagram of this topology (request path, resource IDs, and the
reasoning behind each infra decision): [Benomhub Infrastructure](https://claude.ai/code/artifact/2d6c6248-f75e-4ea9-923c-66e09c4ce135).
Current as of 2026-08-27.

## 7. Real bugs found and fixed while dogfooding the live app

These were found by testing every user flow end-to-end against the deployed
`benomhub.com`, not by code review alone — each is committed and, unless
noted, deployed live:

- **Cart deletion silently deleted nothing** and wasn't scoped to the
  requesting user (`deleteCart.js` filtered on the wrong document shape).
- **Empty cart crashed the page** (unguarded `cartItem[0]` access).
- **Search 500'd on any regex metacharacter** in the query (unescaped
  `$regex`); plus two dead alert calls with wrong arity.
- **`showProduct` hung indefinitely** on a malformed product ID (no
  try/catch around `findById`).
- **Every authenticated request double-sent a response** (`ERR_HTTP_HEADERS_SENT`)
  due to a missing `return` after a 401 in `verifyToken`.
- **Logout didn't exist** — added the route and the UI button.
- **Google OAuth was fully broken for new users** — wrong role default,
  undefined password field, no error handling; plus a missing `CLIENT_ID` env
  var in `docker-compose.yml` and a never-created OAuth Client ID.
- **XSS "fix" attempt reverted**: HTML-escaping user text broke legitimate
  `&`/quotes/`>` on screen because React never decodes entities — the real,
  sufficient protection is React's default text-node rendering; escaping was
  removed rather than "fixed".
- **CORS failed on `www.benomhub.com` while working on the apex domain** —
  origin check compared against a single string instead of an allowlist.
- **CloudFront blocked all non-GET requests to the dynamic app** (stale
  `allowed_methods` from the read-only checkpoint-2 stub) and dropped the
  CORS preflight header entirely until the `AllViewer` origin request policy
  was attached.

Full narrative and root-cause detail for the Task 22 infra-specific issues:
[docs/task22/troubleshooting.md](docs/task22/troubleshooting.md).

## 8. Further reading

- [README.md](README.md) — local setup, Docker Compose deep-dive, published images.
- [TROUBLESHOOTING.md](TROUBLESHOOTING.md) — Docker/Compose troubleshooting reference.
- [docs/task22/architecture.md](docs/task22/architecture.md) — DNS/CDN/ACM architecture diagram and rationale.
- [docs/task22/validation-commands.md](docs/task22/validation-commands.md) — copy-pasteable checks for the live domain.
- [docs/task22/real-app-deployment.md](docs/task22/real-app-deployment.md) — how the demo content was replaced with the real app, and the known gap in `terraform/task22/ec2.tf`'s `user_data`.
- [CONTRIBUTING.md](CONTRIBUTING.md), [SECURITY.md](SECURITY.md) — contribution and security-reporting process.
