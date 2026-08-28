variable "aws_region" {
  type    = string
  default = "us-east-1"
}

variable "aws_profile" {
  type    = string
  default = "Joseph"
}

variable "domain_name" {
  type    = string
  default = "benomhub.com"
}

variable "allowed_ssh_cidr" {
  description = "CIDR allowed to SSH into the Task 22 EC2 instance"
  type        = string
}
