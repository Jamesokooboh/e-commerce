output "static_site_url" {
  value = "https://${var.domain_name}"
}

output "dynamic_app_url" {
  value = "https://app.${var.domain_name}"
}

output "static_site_distribution_domain" {
  value = aws_cloudfront_distribution.static_site.domain_name
}

output "dynamic_app_distribution_domain" {
  value = aws_cloudfront_distribution.dynamic_app.domain_name
}

output "ec2_public_ip" {
  value = aws_instance.dynamic_app.public_ip
}
