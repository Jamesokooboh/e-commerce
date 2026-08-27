# The ACM certificate was requested and DNS-validated manually against
# Cloudflare (this domain's registrar/DNS provider, which can't delegate to
# Route 53 - see docs/task22/checkpoint3-notes.md). Referencing it here
# rather than managing it as a resource: re-creating it through Terraform
# would just mean re-validating a cert that's already issued and live, for
# no benefit, and there's no Cloudflare provider configured in this root to
# automate that validation step anyway.
data "aws_acm_certificate" "task22" {
  provider    = aws.us_east_1
  domain      = var.domain_name
  statuses    = ["ISSUED"]
  most_recent = true
}
