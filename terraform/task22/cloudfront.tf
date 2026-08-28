# -- Static site distribution: S3 origin via OAC, caching enabled --------
resource "aws_cloudfront_distribution" "static_site" {
  enabled             = true
  comment             = "Task 22 - CDN + OAC in front of private S3 static site"
  default_root_object = "index.html"
  aliases             = [var.domain_name, "www.${var.domain_name}"]
  price_class         = "PriceClass_100"
  http_version        = "http2"
  is_ipv6_enabled     = true

  origin {
    domain_name              = aws_s3_bucket.static_site.bucket_regional_domain_name
    origin_id                = "task22-s3-origin"
    origin_access_control_id = aws_cloudfront_origin_access_control.static_site.id
  }

  default_cache_behavior {
    target_origin_id       = "task22-s3-origin"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    cache_policy_id        = "658327ea-f89d-4fab-a63d-7e88639e58f6" # AWS managed: CachingOptimized
    compress               = true
  }

  # SPA routing: unknown paths (client-side routes like /cart) must fall
  # through to index.html instead of a static error page, or refreshing on
  # any route but "/" would break.
  custom_error_response {
    error_code         = 403
    response_code      = 200
    response_page_path = "/index.html"
  }
  custom_error_response {
    error_code         = 404
    response_code      = 200
    response_page_path = "/index.html"
  }

  logging_config {
    bucket = aws_s3_bucket.logs.bucket_domain_name
    prefix = "cloudfront/s3-dist/"
  }

  viewer_certificate {
    acm_certificate_arn      = data.aws_acm_certificate.task22.arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  tags = { Name = "task22-static-site-cdn" }
}

# -- Dynamic app distribution: EC2 custom origin, caching disabled -------
resource "aws_cloudfront_distribution" "dynamic_app" {
  enabled         = true
  comment         = "Task 22 - CDN in front of EC2 dynamic app"
  aliases         = ["app.${var.domain_name}"]
  price_class     = "PriceClass_100"
  http_version    = "http2"
  is_ipv6_enabled = true

  origin {
    domain_name = aws_instance.dynamic_app.public_dns
    origin_id   = "task22-ec2-origin"

    custom_origin_config {
      http_port                = 80
      https_port               = 443
      origin_protocol_policy   = "http-only"
      origin_ssl_protocols     = ["TLSv1.2"]
      origin_read_timeout      = 60
      origin_keepalive_timeout = 5
    }
  }

  default_cache_behavior {
    target_origin_id       = "task22-ec2-origin"
    viewer_protocol_policy = "redirect-to-https"
    # This is a real API now (signup/login/cart/etc), not the read-only
    # checkpoint 2 demo -- needs to allow write methods through, or
    # CloudFront rejects them with a 403 before the origin ever sees them.
    allowed_methods = ["GET", "HEAD", "OPTIONS", "PUT", "PATCH", "POST", "DELETE"]
    cached_methods  = ["GET", "HEAD"]
    cache_policy_id = "4135ea2d-6df8-44a3-9df3-4b5a84be39ad" # AWS managed: CachingDisabled (live per-request data)
    # CachingDisabled alone doesn't forward all viewer headers to the origin
    # (only what's in its own minimal header allowlist). Without this, the
    # browser's Access-Control-Request-Headers preflight header never
    # reaches Express's cors() middleware, which then has nothing to
    # reflect back in Access-Control-Allow-Headers -- silently breaking
    # every credentialed cross-origin request with a custom header.
    origin_request_policy_id = "216adef6-5c7f-47e4-b989-5492eafa07d3" # AWS managed: AllViewer
    compress                 = true
  }

  logging_config {
    bucket = aws_s3_bucket.logs.bucket_domain_name
    prefix = "cloudfront/ec2-dist/"
  }

  viewer_certificate {
    acm_certificate_arn      = data.aws_acm_certificate.task22.arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  tags = { Name = "task22-dynamic-app-cdn" }
}
