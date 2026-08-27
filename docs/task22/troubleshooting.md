# Task 22 — Issues & Solutions (Part 10.4)

Real problems hit during this task, in the order they came up. Each entry is
an actual error message, not a hypothetical.

## 1. Route 53 domain registration blocked on this AWS account
**Error**: `aws route53domains list-prices` → `AccessDeniedException: Free
Tier accounts are not supported for this service`.
**Root cause**: this account is restricted from Route 53 domain
registration entirely, not just rate-limited or missing a permission.
**Solution**: registered the domain through an external registrar
(Cloudflare) instead of Route 53.

## 2. Cloudflare-registered domains can't delegate to Route 53
**Symptom**: no nameserver-override option anywhere in Cloudflare's
Registrations settings for a domain registered through Cloudflare itself.
**Root cause**: Cloudflare Registrar requires the domain to keep using
Cloudflare's own DNS — this is a platform policy, not a missing setting.
**Solution**: dropped the Route 53 hosted zone (created, then deleted once
confirmed unusable) and used Cloudflare's DNS directly — the doc's
explicitly-supported "external DNS provider" path.

## 3. ACM certificate region mismatch would have silently failed
**Not hit directly, but designed around**: CloudFront only accepts ACM
certificates issued in `us-east-1`, regardless of which region the rest of
the infrastructure lives in. Requested the cert with `--region us-east-1`
explicitly from the start.

## 4. Cloudflare "Add record" apex-name confusion
**Symptom**: `DNS name is invalid` error when adding the root CNAME record.
**Root cause**: the field had the literal placeholder text `@ (root)` typed
into it instead of just `@`.
**Solution**: cleared the field, entered exactly `@`.

## 5. CloudFront logging requires ACL-enabled destination bucket
**Error**: `InvalidArgument: The S3 bucket that you specified for
CloudFront logs does not enable ACL access`.
**Root cause**: CloudFront's classic access-logging delivery mechanism
still writes via S3 ACL grants to the `LogDelivery` canonical group — a
bucket with ACLs disabled (the modern S3 default) can't receive them.
**Solution**: set the logs bucket's Object Ownership to
`BucketOwnerPreferred` and granted the `LogDelivery` group `WRITE` +
`READ_ACP` via `put-bucket-acl`.

## 6. Windows/Git Bash mangles `file://` paths for AWS CLI
**Symptom**: `Unable to load paramfile file:///c/Users/...: No such file or
directory` even though the file exists.
**Root cause**: Git Bash's POSIX-style path (`/c/Users/...`) doesn't match
what the native Windows `aws.exe` expects inside a `file://` URI.
**Solution**: use Windows-style paths in `file://` URIs
(`file://C:/Users/...`) for any AWS CLI argument that loads a local file —
inline JSON also works as a fallback for short payloads.

## 7. `terraform plan` caught two forced-replacement bugs before apply
See `checkpoint5-notes.md` for the full detail. Summary: a
`most_recent = true` AMI data source would have force-replaced the live EC2
instance on the next Ubuntu image release, and a security group defined
with `name_prefix` instead of `name` didn't match the real resource,
also forcing a replace. Both caught by reading `plan` output, both fixed
before any `apply`.

## 8. Cache invalidation is not optional after a content update
**Not an error, a real gotcha demonstrated deliberately** (Checkpoint 4):
updating the S3 object and immediately re-fetching through CloudFront
returned the *old* cached content. Only after `create-invalidation`
did the new content appear. Documented here as a reminder that "I updated
the origin" and "visitors will see the update" are two different claims
when a CDN is in front of it.

## 9. Real scanner traffic found in the EC2 instance's Nginx logs
**Not an error caused by this task**, but a real finding worth recording:
within about a day of the EC2 instance going live, its Nginx access log
already showed automated internet scanning — a raw TLS handshake sent to
the plain-HTTP port, and a `GET /.env` credential-harvesting probe. The
demo app answered `200` to it because it has no routing logic at all (it
returns `200` for every path/method). Nothing was actually exposed since no
`.env` file exists, but it's concrete evidence that "answer something for
every request" is not a safe default the moment a server has a public IP.
