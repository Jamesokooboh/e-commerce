# Checkpoint 2: EC2 Dynamic Hosting + CloudFront CDN

## EC2 dynamic hosting (Part 3)
- Instance `i-0fc6c9157a1a4053f` (`task22-dynamic-site`), Ubuntu 22.04, `t3.micro`, public IP `44.192.10.129`
- Security group `sg-0e3b946bd397cbd5a`: SSH from operator IP only, HTTP/HTTPS open (needed for CloudFront and direct testing)
- `user_data.sh` installs Nginx + Node.js, deploys a minimal stdlib-only Node app (`dynamic-site/app.js`) on port 3000 as a systemd service, configures Nginx as a reverse proxy from `:80` to `:3000`
- Verified live: `curl http://44.192.10.129/` returns real JSON from the Node app, proxied through Nginx

## CloudFront CDN (Part 4)
- Distribution `E1IAULU29IDDD3`, domain `d2mj32h9salpgj.cloudfront.net`
- Custom origin: the EC2 instance's public DNS name, `OriginProtocolPolicy: http-only` (no cert on the origin itself — CloudFront terminates TLS at the edge using its default `*.cloudfront.net` certificate, since no custom domain/ACM cert exists yet)
- `ViewerProtocolPolicy: redirect-to-https` — plain HTTP requests get a 301 to HTTPS
- Cache policy: AWS managed `CachingDisabled` (`4135ea2d-6df8-44a3-9df3-4b5a84be39ad`) — deliberate, since the origin returns a live timestamp per request; caching it would make the CDN silently serve a stale response instead of proxying live app data
- Verified live: HTTPS request through the distribution returns the real app response (not a cached/stale one — timestamp matches request time), plain HTTP correctly redirects to HTTPS

## CDN concepts
- **Edge locations**: CloudFront's globally distributed points of presence that cache/serve content close to the requester
- **Cache hit**: a request is served from an edge location's cache without contacting the origin
- **Cache miss**: the edge has no valid cached copy and must fetch from the origin (or a regional edge cache)
- **Origin server**: the actual source of truth for content — here, the EC2 instance
- **TTL**: how long a cached object is considered fresh before CloudFront re-validates with the origin
- **Cache invalidation**: manually forcing CloudFront to drop cached copies before their TTL expires (used in checkpoint 4)
- **Global content delivery**: routing each viewer to their nearest edge location automatically, reducing latency versus always hitting a single-region origin
