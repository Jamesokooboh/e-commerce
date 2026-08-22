#!/bin/bash
set -euxo pipefail

# Docker
apt-get update -y
apt-get install -y ca-certificates curl gnupg
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  > /etc/apt/sources.list.d/docker.list
apt-get update -y
apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
usermod -aG docker ubuntu

# kubectl
curl -fsSLo /usr/local/bin/kubectl "https://dl.k8s.io/release/$(curl -fsSL https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
chmod +x /usr/local/bin/kubectl

# Kind
curl -fsSLo /usr/local/bin/kind https://kind.sigs.k8s.io/dl/v0.24.0/kind-linux-amd64
chmod +x /usr/local/bin/kind

# Helm
curl -fsSL https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash

# Single-node Kind cluster. NodePorts are mapped straight to the host so the
# ALB (hitting this instance's private IP) can reach the app without the
# app manifests knowing anything changed.
cat > /home/ubuntu/kind-config.yaml <<'EOF'
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
nodes:
  - role: control-plane
    extraPortMappings:
      - containerPort: 30080
        hostPort: 30080
        protocol: TCP
      - containerPort: 30050
        hostPort: 30050
        protocol: TCP
      - containerPort: 30081
        hostPort: 30081
        protocol: TCP
      - containerPort: 30051
        hostPort: 30051
        protocol: TCP
EOF
chown ubuntu:ubuntu /home/ubuntu/kind-config.yaml

# `usermod -aG docker` only takes effect on a new login session, so use `sg`
# to run this one command as ubuntu with the docker group already active
# instead of requiring a reboot.
sudo -u ubuntu -E env KUBECONFIG=/home/ubuntu/.kube/config \
  sg docker -c "kind create cluster --name ecommerce-task16 --config /home/ubuntu/kind-config.yaml"
