variable "aws_region" {
  description = "AWS region to provision into"
  type        = string
  default     = "us-east-1"
}

variable "aws_profile" {
  description = "AWS CLI profile to use"
  type        = string
  default     = "Joseph"
}

variable "availability_zones" {
  description = "Two AZs to spread public/private subnets across"
  type        = list(string)
  default     = ["us-east-1a", "us-east-1b"]
}

variable "vpc_cidr" {
  type    = string
  default = "10.0.0.0/16"
}

variable "public_subnet_cidrs" {
  type    = list(string)
  default = ["10.0.0.0/24", "10.0.1.0/24"]
}

variable "private_subnet_cidrs" {
  type    = list(string)
  default = ["10.0.10.0/24", "10.0.11.0/24"]
}

variable "key_name" {
  description = "Existing EC2 key pair name"
  type        = string
  default     = "miseacademy-dev"
}

variable "allowed_ssh_cidr" {
  description = "CIDR allowed to SSH into the bastion (your IP, not 0.0.0.0/0)"
  type        = string
}

variable "bastion_instance_type" {
  type    = string
  default = "t3.micro"
}

variable "private_instance_type" {
  type    = string
  default = "c7i-flex.large"
}

variable "app_node_ports" {
  description = "NodePorts the Kind cluster exposes for the app (frontend, backend)"
  type        = list(number)
  default     = [30080, 30050]
}
