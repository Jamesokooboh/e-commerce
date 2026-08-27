data "aws_vpc" "default" {
  default = true
}

resource "aws_security_group" "dynamic_app" {
  name        = "task22-ec2-sg"
  description = "Task 22 dynamic EC2 hosting: SSH + HTTP + HTTPS"
  vpc_id      = data.aws_vpc.default.id

  ingress {
    description = "SSH from operator"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = [var.allowed_ssh_cidr]
  }

  ingress {
    description = "HTTP (CloudFront origin fetch + direct testing)"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTPS"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "task22-ec2-sg" }
}

resource "aws_instance" "dynamic_app" {
  # Pinned to the exact AMI the instance was actually launched with -- a
  # most_recent=true data source would drift as Canonical publishes new
  # Ubuntu 22.04 builds and force-replace this live, DNS-referenced instance
  # on every apply.
  ami                    = "ami-06e78a71af43ef21a"
  instance_type          = "t3.micro"
  subnet_id              = "subnet-045fdeb448afdf141" # actual subnet the instance was launched in
  vpc_security_group_ids = [aws_security_group.dynamic_app.id]
  key_name               = "miseacademy-dev"
  user_data              = file("${path.module}/../../dynamic-site/user_data.sh")
  monitoring             = true # detailed CloudWatch monitoring

  tags = { Name = "task22-dynamic-site" }
}
