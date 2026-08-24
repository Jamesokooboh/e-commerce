variable "aws_region" {
  type    = string
  default = "us-east-1"
}

variable "aws_profile" {
  type    = string
  default = "Joseph"
}

variable "cluster_name" {
  type    = string
  default = "ecommerce-eks"
}

variable "vpc_cidr" {
  type    = string
  default = "10.1.0.0/16"
}

variable "availability_zones" {
  type    = list(string)
  default = ["us-east-1a", "us-east-1b"]
}

variable "public_subnet_cidrs" {
  type    = list(string)
  default = ["10.1.0.0/24", "10.1.1.0/24"]
}

variable "node_instance_type" {
  # t3.medium is NOT free-tier-eligible on this account (confirmed the hard
  # way in Task 16) - m7i-flex.large is, and gives real headroom across 2
  # nodes for a full blue/green stack.
  type    = string
  default = "m7i-flex.large"
}

variable "node_desired_size" {
  type    = number
  default = 2
}
