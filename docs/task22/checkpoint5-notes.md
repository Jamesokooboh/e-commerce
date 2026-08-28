# Checkpoint 5: Terraform Automation (Part 9)

## Scope decision
`terraform/task22/` automates everything built by hand in Checkpoints 1-4:
the static site S3 bucket + OAC + policy, the logs bucket, both CloudFront
distributions, and the EC2 instance + security group. **Not** managed here:
the ACM certificate (referenced via a `data "aws_acm_certificate"` source
instead — re-creating it as a resource would mean re-validating a
certificate that's already issued and live, for no benefit) and the
Cloudflare DNS records (no Cloudflare provider credentials configured in
this root; Cloudflare Registrar domains also can't use Route 53 anyway, see
`checkpoint3-notes.md`). Both are documented here rather than silently
dropped from the "automate everything" goal.

## Approach: import, don't rebuild
Everything in Checkpoints 1-4 was already live, verified, and screenshotted.
Tearing it down and reprovisioning from scratch just to say it was
"Terraform-first" would have meant real downtime on a working demo for zero
benefit. Instead: wrote Terraform config matching the actual infrastructure,
then used `terraform import` on each of the 11 resources (S3 buckets, ACL,
public access block, bucket policy, OAC, security group, EC2 instance, both
CloudFront distributions) to bring them under Terraform state without
touching them.

## Two real bugs `terraform plan` caught before they became outages
1. **`aws_ami` data source with `most_recent = true`** would have force-replaced
   the live, DNS-referenced EC2 instance the moment Canonical published a
   newer Ubuntu 22.04 build (the AMI is baked into `aws_instance` and any
   change to it forces a new instance). Fixed by pinning the exact AMI ID
   the instance was actually launched with (`ami-06e78a71af43ef21a`)
   instead of a data source.
2. **Security group defined with `name_prefix` instead of `name`** — since the
   real resource's name (`task22-ec2-sg`) doesn't match the prefix pattern
   Terraform expects for a `name_prefix`-managed resource, `plan` showed
   `must be replaced`. Deleting and recreating this SG mid-flight would have
   dropped the EC2 instance's and both CloudFront distributions' network
   rules. Fixed by switching to an explicit `name`.

Both were caught by reading `terraform plan`'s output before applying,
not by trusting that "it imported successfully" meant the config was safe.
After both fixes, `plan` showed `0 to add, 6 to change (in-place only), 0 to
destroy` — tag/description/TTL additions, nothing destructive. Applied
cleanly, then confirmed `benomhub.com`, `www.benomhub.com`, and
`app.benomhub.com` were all still returning real `200`s afterward, and a
follow-up `terraform plan` showed `No changes. Your infrastructure matches
the configuration.`
