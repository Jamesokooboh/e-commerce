# Task 22 — Architecture & Documentation (Part 10)

## Static website architecture
```
User Browser
    |
    v
Cloudflare DNS (benomhub.com, www.benomhub.com -- CNAME, DNS-only)
    |
    v
CloudFront (d22ywprcavcjfy.cloudfront.net)
    ViewerCertificate: ACM cert for benomhub.com / www.benomhub.com (SNI)
    CachePolicy: CachingOptimized
    |
    v
S3 bucket task22-static-site-313951301623 (private)
    access only via Origin Access Control -> this one distribution
```

## Dynamic website architecture
```
User Browser
    |
    v
Cloudflare DNS (app.benomhub.com -- CNAME, DNS-only)
    |
    v
CloudFront (d2mj32h9salpgj.cloudfront.net)
    ViewerCertificate: ACM cert for app.benomhub.com (SNI)
    CachePolicy: CachingDisabled (origin returns live per-request data)
    |
    v
EC2 instance i-0fc6c9157a1a4053f (custom origin, http-only to CloudFront)
    Nginx :80 --reverse proxy--> Node.js app :3000 (systemd service)
```

## Note on Route 53 vs. the actual DNS layer
The doc's reference architecture uses Route 53 at the DNS layer. This
project's domain (`benomhub.com`) is registered through Cloudflare
Registrar, which does not allow delegating its nameservers to Route 53 (see
`checkpoint3-notes.md`) — so Cloudflare's own DNS fills that role instead,
functionally equivalent for everything downstream (CloudFront, ACM
validation, the actual routing). No Application Load Balancer is used since
CloudFront talks to the EC2 instance directly as a custom origin, and this
task's dynamic app is a single instance, not a fleet needing load balancing.

## Full request flow, both paths combined
```
                    +-- www.benomhub.com --+
                    |                      v
User --> Cloudflare DNS --> benomhub.com --> CloudFront (S3 origin, OAC) --> S3 (private)
                    |
                    +-- app.benomhub.com --> CloudFront (EC2 origin) --> Nginx --> Node.js app
```
