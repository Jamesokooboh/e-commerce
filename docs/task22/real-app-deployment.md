# Deploying the real e-commerce app onto Task 22's infrastructure

Task 22's checkpoints built and verified generic demo content (a static
placeholder page, a stub Node app). This note covers replacing that with
the repo's actual e-commerce app, reusing the same infrastructure as-is.

## Frontend (S3 + CloudFront, benomhub.com / www)
- Built locally: `npm install --legacy-peer-deps && npm run build` in `frontend/`
- Generated `env.js` from `public/env.template.js` with the real backend
  domain baked in (`BACKEND_URL: "https://app.benomhub.com"`) — this is
  exactly the runtime-config mechanism from the Task 17 bug fix (see
  `frontend/src/config.js`), which works for a static S3 build just as well
  as it does for the Docker image it was originally built for
- Uploaded the whole `build/` directory to `task22-static-site-313951301623`,
  replacing the Checkpoint 1 demo `index.html`/`error.html`
- Updated CloudFront's custom error responses (403/404) from serving the
  old `error.html` to serving `index.html` with a `200` — required for SPA
  client-side routing (a reload on `/cart` would otherwise 404, since
  there's no such object in S3)
- Invalidated the cache after upload

## Backend (EC2, app.benomhub.com)
- Installed Docker on the instance (`get.docker.com`)
- Ran `mongo:7` and `okoobohjames/ecommerce-backend:782` (the same
  CI-published image the ArgoCD Image Updater keeps current elsewhere in
  this project) via the repo's existing `docker-compose.yml`, starting only
  the `mongo` and `backend` services — the `frontend` service in that file
  is unused here since the frontend is static, on S3
- JWT secret: generated fresh, stored in Secrets Manager
  (`ecommerce/task22/jwt-secret`), fetched with local AWS credentials and
  handed to the instance via a `.env` file (the instance itself has no IAM
  role attached, so it can't fetch its own secrets — same reasoning as
  Task 21's connectivity test, avoid a chain of shell-quoting through SSH)
- Repointed Nginx from the Checkpoint 2 stub app (port 3000) to the real
  backend (port 5000), and disabled the stub's systemd service

## Known gap: `terraform/task22/ec2.tf`'s `user_data` is now stale
The instance was set up for the real app **manually over SSH**, not through
Terraform. `ec2.tf` still points `user_data` at
`dynamic-site/user_data.sh` — the Checkpoint 2 script that installs Nginx
and the stub app. If this EC2 instance is ever replaced (manually
terminated, or a future Terraform change forces a replacement), the new
instance will boot back into the Checkpoint 2 demo state, not this one.
Recreating the real deployment would mean redoing the steps above by hand.

**Not fixed here** — folding this into `user_data` properly means an
instance profile with Secrets Manager access (to fetch the JWT secret at
boot without a human in the loop) and a rewritten script, which is real
work beyond "get the real app running." Flagging it instead of silently
leaving it for someone to discover the hard way.
