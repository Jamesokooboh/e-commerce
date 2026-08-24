terraform {
  required_version = ">= 1.5"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "s3" {
    bucket         = "ecommerce-tf-state-313951301623"
    key            = "rds/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "ecommerce-tf-lock"
    encrypt        = true
    profile        = "Joseph"
  }
}

provider "aws" {
  region  = var.aws_region
  profile = var.aws_profile
}
