# Task 22 — Validation Commands (Part 10.5)

`dig` isn't available in this environment (Windows/Git Bash, no BIND
tools installed) — `nslookup` is used as the equivalent throughout.

## `nslookup benomhub.com`
Verifies DNS resolution: the domain actually resolves, and to what.
```
Non-authoritative answer:
Server:  dns.google
Address:  8.8.8.8

Name:    benomhub.com
Addresses:  2600:9000:201a:8200:1a:8315:1b80:93a1
          ... (7 more AAAA records)
          13.227.231.6
          13.227.231.117
          13.227.231.108
          13.227.231.99
```
Multiple A and AAAA records across different values is expected —
CloudFront returns several edge IPs per resolution rather than one fixed
address, and both protocols resolve since `IsIPV6Enabled = true` on both
distributions.

## `curl -I https://benomhub.com/`
Verifies HTTPS actually works end-to-end and shows which layer served the
response.
```
HTTP/1.1 200 OK
Content-Type: text/html
Server: AmazonS3
X-Cache: Miss from cloudfront
Via: 1.1 ....cloudfront.net (CloudFront)
X-Amz-Cf-Pop: CDG50-P5
```
`Server: AmazonS3` confirms the S3 origin actually served this response
(not a cached CloudFront error page or a misconfigured origin), `Via`
confirms the request really passed through CloudFront, and
`X-Amz-Cf-Pop` shows which edge location (Paris, in this case) handled it.

## `curl -I https://app.benomhub.com/`
Same command, different origin — proves the dynamic path independently.
```
HTTP/1.1 200 OK
Content-Type: application/json
Server: nginx/1.18.0 (Ubuntu)
X-Cache: Miss from cloudfront
Via: 1.1 ....cloudfront.net (CloudFront)
```
`Server: nginx/1.18.0 (Ubuntu)` confirms this response actually came from
the EC2 instance's Nginx, not a stale cache or a static fallback — matches
the real reverse-proxy setup from Checkpoint 2.

## `openssl s_client -connect benomhub.com:443 -servername benomhub.com | openssl x509 -noout -subject -issuer`
Verifies the certificate actually presented is the real ACM cert, not
CloudFront's shared default.
```
subject=CN=benomhub.com
issuer=C=US, O=Amazon, CN=Amazon RSA 2048 M04
```
