resource "aws_security_group" "rds" {
  name_prefix = "ecommerce-rds-"
  vpc_id      = data.aws_vpc.default.id

  ingress {
    description     = "Postgres from the app instance only"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [var.allowed_ingress_sg_id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "ecommerce-rds-sg" }
}

resource "aws_db_subnet_group" "rds" {
  name       = "ecommerce-rds-subnet-group"
  subnet_ids = data.aws_subnets.default.ids

  tags = { Name = "ecommerce-rds-subnet-group" }
}

resource "aws_db_instance" "main" {
  identifier     = "ecommerce-db"
  engine         = var.db_engine
  engine_version = var.db_engine_version
  instance_class = var.db_instance_class
  db_name        = var.db_name

  allocated_storage      = var.db_allocated_storage
  storage_encrypted      = true
  db_subnet_group_name   = aws_db_subnet_group.rds.name
  vpc_security_group_ids = [aws_security_group.rds.id]
  publicly_accessible    = false

  # Native AWS integration: RDS generates and stores the master password in
  # Secrets Manager itself (rotatable), so nothing sensitive ever lands in
  # Terraform config, state diffs, or git.
  manage_master_user_password = true
  username                    = var.db_master_username

  backup_retention_period = 1 # free-tier account caps backups at 1 day
  skip_final_snapshot     = true
  deletion_protection     = false

  tags = { Name = "ecommerce-db" }
}
