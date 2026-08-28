output "vpc_id" {
  value = aws_vpc.main.id
}

output "public_subnet_ids" {
  value = aws_subnet.public[*].id
}

output "private_subnet_ids" {
  value = aws_subnet.private[*].id
}

output "bastion_public_ip" {
  value = aws_instance.bastion.public_ip
}

output "private_instance_id" {
  value = aws_instance.private.id
}

output "private_instance_ip" {
  value = aws_instance.private.private_ip
}

output "alb_security_group_id" {
  value = aws_security_group.alb.id
}
