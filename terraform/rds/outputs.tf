output "db_endpoint" {
  value = aws_db_instance.main.address
}

output "db_port" {
  value = aws_db_instance.main.port
}

output "master_user_secret_arn" {
  description = "RDS-managed secret (username+password, auto-rotatable)"
  value       = aws_db_instance.main.master_user_secret[0].secret_arn
}

output "app_credentials_secret_arn" {
  description = "App-facing secret (username+password+dbname+host+port)"
  value       = aws_secretsmanager_secret.app_db_credentials.arn
}
