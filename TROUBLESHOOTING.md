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
