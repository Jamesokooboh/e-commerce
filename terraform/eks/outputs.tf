output "cluster_name" {
  value = module.eks.cluster_name
}

output "cluster_endpoint" {
  value = module.eks.cluster_endpoint
}

output "vpc_id" {
  value = module.vpc.vpc_id
}

output "public_subnet_ids" {
  value = module.vpc.public_subnets
}

output "node_security_group_id" {
  value = module.eks.node_security_group_id
}

output "alb_security_group_id" {
  value = aws_security_group.alb.id
}
