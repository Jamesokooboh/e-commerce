# The RDS-managed secret (from manage_master_user_password) only holds
# username+password. The app needs host/port/db too, so mirror those into
# one app-facing secret rather than having every caller stitch two secrets
# together.
data "aws_secretsmanager_secret_version" "rds_master" {
  secret_id = aws_db_instance.main.master_user_secret[0].secret_arn
}

resource "aws_secretsmanager_secret" "app_db_credentials" {
  name = "ecommerce/rds/app-credentials"

  tags = { Name = "ecommerce-rds-app-credentials" }
}

resource "aws_secretsmanager_secret_version" "app_db_credentials" {
  secret_id = aws_secretsmanager_secret.app_db_credentials.id
  secret_string = jsonencode({
    username = var.db_master_username
    password = jsondecode(data.aws_secretsmanager_secret_version.rds_master.secret_string).password
    dbname   = aws_db_instance.main.db_name
    host     = aws_db_instance.main.address
    port     = aws_db_instance.main.port
  })
}
