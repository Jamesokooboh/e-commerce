module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "~> 20.0"

  cluster_name    = var.cluster_name
  cluster_version = "1.31"

  vpc_id     = module.vpc.vpc_id
  subnet_ids = module.vpc.public_subnets

  cluster_endpoint_public_access  = true
  cluster_endpoint_private_access = false

  # Public subnets only (no bastion needed for this task) - nodes need a
  # public IP to reach the EKS API/ECR without a NAT Gateway.
  eks_managed_node_group_defaults = {
    ami_type = "AL2023_x86_64_STANDARD"
  }

  eks_managed_node_groups = {
    default = {
      instance_types = [var.node_instance_type]
      min_size       = var.node_desired_size
      max_size       = var.node_desired_size
      desired_size   = var.node_desired_size

      subnet_ids = module.vpc.public_subnets
    }
  }

  # The user running Terraform gets cluster-admin automatically.
  enable_cluster_creator_admin_permissions = true

  tags = {
    Project = "ecommerce-task20"
  }
}

resource "aws_security_group" "alb" {
  name_prefix = "${var.cluster_name}-alb-"
  vpc_id      = module.vpc.vpc_id

  ingress {
    description = "HTTP frontend"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTP backend"
    from_port   = 5000
    to_port     = 5000
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "${var.cluster_name}-alb-sg" }
}

# Allow the ALB to reach the app's NodePorts (30000-32767) on the worker nodes.
resource "aws_security_group_rule" "nodeport_from_alb" {
  type                     = "ingress"
  from_port                = 30000
  to_port                  = 32767
  protocol                 = "tcp"
  security_group_id        = module.eks.node_security_group_id
  source_security_group_id = aws_security_group.alb.id
  description               = "NodePort range from ALB"
}
