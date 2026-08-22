#!/bin/bash
# Task 18 monitoring setup, run on the app EC2 instance (or via SSH from it).
# Not idempotent-safe to blindly re-run in full - read before running.
set -euo pipefail

AWS_REGION="us-east-1"
AWS_PROFILE="Joseph"
SNS_EMAIL="${1:?usage: setup.sh <alert-email>}"

# --- CloudWatch agent ---
wget -q https://s3.amazonaws.com/amazoncloudwatch-agent/ubuntu/amd64/latest/amazon-cloudwatch-agent.deb -O /tmp/amazon-cloudwatch-agent.deb
sudo dpkg -i /tmp/amazon-cloudwatch-agent.deb
sudo usermod -aG adm cwagent  # cwagent needs the adm group to read /var/log/syslog

sudo mkdir -p /var/log/ecommerce-app && sudo chmod 777 /var/log/ecommerce-app
sudo cp "$(dirname "$0")/collect-k8s-logs.sh" /usr/local/bin/collect-k8s-logs.sh
sudo chmod +x /usr/local/bin/collect-k8s-logs.sh
(crontab -l 2>/dev/null; echo '* * * * * /usr/local/bin/collect-k8s-logs.sh') | crontab -

# cloudwatch-agent-config.json ships "ens5" as the network interface -
# check `ip -brief addr` and edit the config first if this instance differs.
sudo cp "$(dirname "$0")/cloudwatch-agent-config.json" /opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json
sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl -a fetch-config -m ec2 -s \
  -c file:/opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json

# --- SNS topic + email subscription ---
TOPIC_ARN=$(aws sns create-topic --profile "$AWS_PROFILE" --region "$AWS_REGION" \
  --name ecommerce-monitoring-alerts --query TopicArn --output text)
aws sns subscribe --profile "$AWS_PROFILE" --region "$AWS_REGION" \
  --topic-arn "$TOPIC_ARN" --protocol email --notification-endpoint "$SNS_EMAIL"
echo "Confirm the subscription email sent to $SNS_EMAIL before alarms will deliver."

# --- CloudWatch alarms ---
INSTANCE_HOST=$(hostname)  # matches the "host" dimension the agent reports

aws cloudwatch put-metric-alarm --profile "$AWS_PROFILE" --region "$AWS_REGION" \
  --alarm-name ecommerce-high-cpu --alarm-description "Backend EC2 host CPU utilization is high" \
  --namespace EcommerceMonitoring --metric-name cpu_usage_user \
  --dimensions Name=host,Value="$INSTANCE_HOST" Name=cpu,Value=cpu-total \
  --statistic Average --period 60 --threshold 70 --comparison-operator GreaterThanThreshold \
  --evaluation-periods 2 --alarm-actions "$TOPIC_ARN" --ok-actions "$TOPIC_ARN"

aws cloudwatch put-metric-alarm --profile "$AWS_PROFILE" --region "$AWS_REGION" \
  --alarm-name ecommerce-high-memory --alarm-description "Backend EC2 host memory utilization is high" \
  --namespace EcommerceMonitoring --metric-name mem_used_percent \
  --dimensions Name=host,Value="$INSTANCE_HOST" \
  --statistic Average --period 60 --threshold 80 --comparison-operator GreaterThanThreshold \
  --evaluation-periods 2 --alarm-actions "$TOPIC_ARN" --ok-actions "$TOPIC_ARN"

aws logs put-metric-filter --profile "$AWS_PROFILE" --region "$AWS_REGION" \
  --log-group-name /ecommerce/k8s/pods --filter-name ecommerce-app-errors \
  --filter-pattern '?ERROR ?Exception ?Failed ?" 5"' \
  --metric-transformations metricName=AppErrorCount,metricNamespace=EcommerceMonitoring,metricValue=1,defaultValue=0

aws cloudwatch put-metric-alarm --profile "$AWS_PROFILE" --region "$AWS_REGION" \
  --alarm-name ecommerce-app-errors --alarm-description "Error/Exception/Failed/5xx pattern in pod logs" \
  --namespace EcommerceMonitoring --metric-name AppErrorCount \
  --statistic Sum --period 60 --threshold 0 --comparison-operator GreaterThanThreshold \
  --evaluation-periods 1 --treat-missing-data notBreaching \
  --alarm-actions "$TOPIC_ARN" --ok-actions "$TOPIC_ARN"

# --- Prometheus + Grafana ---
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo add grafana https://grafana.github.io/helm-charts
helm repo update

helm install kube-prometheus prometheus-community/kube-prometheus-stack -n monitoring --create-namespace \
  --set alertmanager.enabled=false \
  --set prometheus.prometheusSpec.retention=1d \
  --set prometheus.prometheusSpec.resources.requests.memory=256Mi \
  --set prometheus.prometheusSpec.resources.limits.memory=512Mi \
  --set grafana.resources.requests.memory=128Mi \
  --set grafana.resources.limits.memory=256Mi \
  --set grafana.adminPassword=admin123

echo "Import Grafana dashboards 1860 (Node Exporter Full) and 315 (Kubernetes cluster monitoring)"
echo "from grafana.com, plus grafana-dashboard-ecommerce-app.json in this directory for app-level panels."
