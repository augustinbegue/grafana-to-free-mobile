# Grafana Webhook to SMS Forwarder

## Prerequisites

- [Bun](https://bun.sh/) installed
- Docker (for containerization)
- Free Mobile account with SMS API access

## Local Development Setup

1. Clone the repository

2. Install dependencies:

```bash
bun install
```

3. Set environment variables:

```bash
export FREE_MOBILE_USER_ID='your_free_mobile_user_id'
export FREE_MOBILE_PASS='your_free_mobile_password'
export PORT=3000  # Optional, defaults to 3000
```

4. Run the server:

```bash
bun run index.ts
```

## Docker Deployment

1. Build the Docker image:

```bash
docker build -t grafana-webhook-sms-forwarder:latest .
```

2. Run the Docker container:

```bash
docker run -p 3000:3000 \
  -e FREE_MOBILE_USER_ID='your_user_id' \
  -e FREE_MOBILE_PASS='your_password' \
  grafana-webhook-sms-forwarder:latest
```

## Grafana Configuration

1. In Grafana, go to Alerting > Notification channels
2. Create a new webhook notification channel
3. Set the URL to `http://grafana-webhook-sms-forwarder-service.default.svc.cluster.local/webhook`
4. Configure your alert rules to use this notification channel

## Notes

- Ensure your server is accessible by Grafana
- The script logs SMS sending attempts
- Error handling is included for webhook and SMS API interactions
- Kubernetes deployment includes:
  - Multiple replicas for high availability
  - Resource limits
  - Health checks
  - Secret-based credential management

## Environment Variables

- `FREE_MOBILE_USER_ID`: Your Free Mobile API user ID
- `FREE_MOBILE_PASS`: Your Free Mobile API password
- `PORT`: (Optional) Port for the webhook server, defaults to 3000

## Security Recommendations

- Never commit secrets to version control
- Use Kubernetes secrets or external secret management
- Rotate credentials periodically
