# DNS Fundamentals (Task 22, Part 1)

## What DNS is
DNS (Domain Name System) translates human-readable domain names (`example.com`)
into the IP addresses or other resource records that computers actually use to
route traffic.

## How domain resolution works
```
User Browser
    |
    v
DNS Resolver (ISP or public, e.g. 8.8.8.8)
    |
    v
Route 53 / DNS Provider (authoritative for the domain)
    |
    v
CloudFront / Load Balancer / EC2 / S3 (the actual destination)
```
The resolver walks the DNS hierarchy (root -> TLD -> authoritative nameservers)
until it reaches the nameservers authoritative for the domain, then asks them
directly for the requested record.

## Record types
| Record | Purpose |
|---|---|
| A | Maps a name directly to an IPv4 address |
| AAAA | Maps a name directly to an IPv6 address |
| CNAME | Aliases one name to another name (cannot coexist with other records on the same name, cannot be used at a zone apex) |
| Alias (Route 53-specific) | Like CNAME but works at the zone apex and points directly at AWS resources (CloudFront, ALB, S3) for free, with health-aware resolution |
| NS | Delegates a subdomain to a different set of nameservers |
| MX | Directs mail for the domain to a mail server |
| TXT | Arbitrary text — used for domain verification (e.g. ACM validation) and SPF/DKIM |
| TTL | How long (seconds) a resolver is allowed to cache a record before re-querying |

## Public vs. private DNS
- **Public DNS**: resolvable from the internet, served by public authoritative nameservers.
- **Private DNS** (e.g. a Route 53 private hosted zone): only resolvable from within an associated VPC — used for internal service discovery without exposing names publicly.

## Note on this task's domain
Task 22 needs a real registered domain to exercise the live parts (Route 53
hosted zone, ACM validation, CloudFront custom domain). That's deferred for
now — see the project tracking notes. The S3 static hosting and EC2/Nginx
dynamic hosting checkpoints below were verified against AWS-provided default
endpoints (S3 website endpoint, EC2 public IP) instead, since those don't
require a domain.
