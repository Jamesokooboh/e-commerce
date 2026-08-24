variable "aws_region" {
  type    = string
  default = "us-east-1"
}

variable "aws_profile" {
  type    = string
  default = "Joseph"
}

variable "db_engine" {
  type    = string
  default = "postgres"
}

variable "db_engine_version" {
  type    = string
  default = "16.4"
}

variable "db_instance_class" {
  type    = string
  default = "db.t3.micro"
}

variable "db_allocated_storage" {
  type    = number
  default = 20
}

variable "db_name" {
  type    = string
  default = "ecommerce"
}

variable "db_master_username" {
  type    = string
  default = "ecommerce_admin"
}

variable "allowed_ingress_sg_id" {
  description = "Security group allowed to reach the DB on 5432 (the app instance's SG)"
  type        = string
  default     = "sg-0807f1ec2bf8b96a3" # miseacademy-dev-sg
}
