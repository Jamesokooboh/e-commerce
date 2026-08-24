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

# EKS ships neither a default StorageClass provisioner nor the EBS CSI
# driver pre-installed. gp2's "kubernetes.io/aws-ebs" StorageClass silently
# routes through the CSI driver anyway (in-tree-to-CSI migration, on by
# default in modern Kubernetes) - so PVCs hang in Pending forever until this
# addon + its IRSA role exist. Found the hard way: PVC events said "waiting
# for ebs.csi.aws.com" with nothing actually running to answer that.
# Standalone resources (not module.eks's own cluster_addons input) to avoid
# a circular module dependency - this needs module.eks's OIDC output, and
# module.eks would need this role's ARN back if it went through the module.
module "ebs_csi_irsa" {
  source  = "terraform-aws-modules/iam/aws//modules/iam-role-for-service-accounts-eks"
  version = "~> 5.0"

  role_name             = "${var.cluster_name}-ebs-csi-irsa"
  attach_ebs_csi_policy = true

  oidc_providers = {
    main = {
      provider_arn               = module.eks.oidc_provider_arn
      namespace_service_accounts = ["kube-system:ebs-csi-controller-sa"]
    }
  }
}

resource "aws_eks_addon" "ebs_csi" {
  cluster_name             = module.eks.cluster_name
  addon_name                = "aws-ebs-csi-driver"
  service_account_role_arn = module.ebs_csi_irsa.iam_role_arn
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
