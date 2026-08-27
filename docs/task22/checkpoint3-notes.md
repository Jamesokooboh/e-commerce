# Checkpoint 3: ACM/SSL + Custom Domain (Parts 5-6)

## Domain
`benomhub.com`, registered through Cloudflare Registrar. Cloudflare Registrar
locks a domain to Cloudflare's own DNS (no option to delegate nameservers
elsewhere was available in the dashboard), so this checkpoint uses the doc's
"external DNS provider" path instead of a Route 53 hosted zone. (A Route 53
hosted zone was created first, then deleted once this was confirmed — no
sense paying for a zone that can never become authoritative.)

## ACM certificate
- `arn:aws:acm:us-east-1:313951301623:certificate/df67069a-37f8-4321-be36-7728e4efc45b`
- Requested in **us-east-1** specifically — CloudFront only accepts certs from that region regardless of where the distribution's edge locations are
- Covers `benomhub.com`, `www.benomhub.com`, `app.benomhub.com` as SANs on one cert (one cert can back multiple CloudFront distributions, doesn't need to be 1:1)
- DNS validation: 3 CNAME records added manually in Cloudflare's DNS (set to DNS-only / grey-cloud, not proxied — proxying isn't needed for validation and would complicate the final routing records)
- Status: `ISSUED`

## CloudFront custom domains
- `E3R4FRZVP12JA5` (static site): `Aliases = [benomhub.com, www.benomhub.com]`, `ViewerCertificate` switched from `CloudFrontDefaultCertificate` to the ACM cert (`SSLSupportMethod: sni-only`, `MinimumProtocolVersion: TLSv1.2_2021`)
- `E1IAULU29IDDD3` (EC2 dynamic app): `Aliases = [app.benomhub.com]`, same cert

## Final DNS records (Cloudflare, all DNS-only)
| Name | Target |
|---|---|
| `@` (apex) | `d22ywprcavcjfy.cloudfront.net` |
| `www` | `d22ywprcavcjfy.cloudfront.net` |
| `app` | `d2mj32h9salpgj.cloudfront.net` |

## Verification
- `nslookup` confirms all three resolve to CloudFront edge IP ranges
- `curl https://benomhub.com/`, `https://www.benomhub.com/`, `https://app.benomhub.com/` all return real `200`s with the actual app/site content (not a cert error, not a CloudFront default error page)
- `openssl s_client` against `benomhub.com:443` shows a real Amazon-issued certificate (`issuer=C=US, O=Amazon, CN=Amazon RSA 2048 M04`, `subject=CN=benomhub.com`) — not CloudFront's shared default cert
