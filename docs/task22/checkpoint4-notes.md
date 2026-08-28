# Checkpoint 4: CloudFront Cache & Invalidation + Security Best Practices

## Cache strategies (Part 7)
- Put a second CloudFront distribution (`E3R4FRZVP12JA5`, `d22ywprcavcjfy.cloudfront.net`) in front of the Checkpoint 1 S3 static site, this time with caching actually enabled (`CachingOptimized` managed policy) instead of the `CachingDisabled` policy used for the dynamic EC2 origin in Checkpoint 2 — static content is exactly what CDN caching is for.
- Demonstrated the real behavior, not just the theory: updated `index.html` in S3, then immediately re-fetched through CloudFront and got the **old cached version back** (a genuine cache hit on stale content). Created an invalidation (`/*`), waited for it to complete, re-fetched, and got the **updated content**. Both states verified with real HTTP responses.
- **Cache hit**: served from the edge without contacting the origin (what happened right after the S3 update, before invalidation).
- **Cache miss**: edge has no valid cached copy, must fetch from origin (what happens after invalidation clears the cache, or on first request to a new edge).
- **TTL**: how long a cached object is considered fresh; `CachingOptimized` uses S3's `Cache-Control`/`ETag` headers to decide, with a 24-hour default max age.
- **Cache invalidation**: the explicit override used here — forces edges to drop cached copies before TTL expiry. Necessary whenever content changes and can't wait for natural TTL expiry.

## Security best practices (Part 8)

### S3 + CloudFront OAC
- The S3 bucket from Checkpoint 1 was public-read (per that checkpoint's doc-sanctioned "initial testing" allowance). Locked it down for real: created a CloudFront Origin Access Control (`E19V5PCML1POZS`), replaced the public-read bucket policy with one scoped to `Principal: cloudfront.amazonaws.com` + `Condition: AWS:SourceArn` matching only this specific distribution, and re-enabled the public access block.
- Verified the lockdown is real: the old S3 website endpoint now returns **403** directly — the only path to the content is through CloudFront.

### EC2
- Checked `sshd_config`: `PasswordAuthentication no` is already set (Ubuntu cloud-image default) — key-only SSH, nothing to change.
- Security group already scoped: SSH restricted to the operator's IP only, HTTP/HTTPS open (required for CloudFront and public testing, not overly broad).
- Enabled EC2 detailed CloudWatch monitoring (1-minute metric granularity instead of the 5-minute default).
- **Real finding while checking the Nginx access log**: the instance had already been probed by internet scanners within about a day of going live, including a `GET /.env HTTP/1.1` request (a common automated scan for leaked credentials/secrets) and a raw TLS handshake sent to the plain-HTTP port (also automated scanning, not a browser). The app returned `200` for `/.env` because it has no routing logic at all — it responds `200` to every path and method. Not a real leak here (there's no `.env` file, no secrets in this demo app), but a concrete illustration of why "the app returns something for every request" is a real anti-pattern worth flagging, not a hypothetical one.

### DNS
- DNSSEC, least-privilege IAM for DNS management, and MFA on the AWS account are still deferred along with the rest of the domain-dependent work (Checkpoint 3) — there's no hosted zone yet to apply them to. Documented here so the requirement isn't silently dropped once a domain is available.

### Monitoring & logging
- Nginx access/error logs: already present by default, confirmed real traffic in them (see EC2 finding above).
- CloudFront access logs: enabled on **both** distributions, delivered to a dedicated `task22-logs-313951301623` bucket (kept separate from the content bucket) under `cloudfront/ec2-dist/` and `cloudfront/s3-dist/` prefixes.
- EC2 CloudWatch monitoring: enabled (detailed/1-minute).
- S3 access logs and CloudWatch alarms on the new resources: not added this checkpoint — logging destinations already exist for meaningful investigation via CloudFront logs + Nginx logs, and alarms weren't asked for specifically; can be added if this environment moves beyond a training task.
