variable "aws_region" {
  type    = string
  default = "us-east-1"
}

variable "aws_profile" {
  type    = string
  default = "Joseph"
}

variable "state_bucket_name" {
  description = "Globally-unique S3 bucket name for Terraform remote state"
  type        = string
  default     = "ecommerce-tf-state-313951301623"
}

variable "lock_table_name" {
  type    = string
  default = "ecommerce-tf-lock"
}
