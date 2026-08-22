#!/bin/bash
# Runs every minute via cron, tailing the last 70s of each ecommerce pod's
# logs into a plain file the CloudWatch agent watches. Kind runs its own
# containerd nested inside a Docker container, so pod logs never land on the
# EC2 host's own filesystem the way CloudWatch's file-based log collection
# expects (that only works for EKS/ECS-native setups) - this script bridges
# the gap without needing Fluent Bit or Container Insights.
mkdir -p /var/log/ecommerce-app
for pod in $(kubectl get pods -n ecommerce -o jsonpath='{.items[*].metadata.name}'); do
  kubectl logs -n ecommerce "$pod" --since=70s --timestamps 2>/dev/null | sed "s/^/$pod: /"
done >> /var/log/ecommerce-app/k8s-pods.log
