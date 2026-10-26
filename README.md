# Grafana Webhook to SMS Forwarder + MCP server

Forwards Grafana alerts, and messages from AI agents (via MCP), as SMS through the Free Mobile API.

## Endpoints

| Endpoint | Auth | Description |
| --- | --- | --- |
| `GET /health` | none | Liveness check |
| `POST /webhook` | none (keep in-cluster) | Grafana webhook payload, sent as SMS |
| `POST /mcp` | `Authorization: Bearer <MCP_TOKEN>` | MCP Streamable HTTP, stateless, tool `send_sms` |

`GET`/`DELETE /mcp` return 405. If `MCP_TOKEN` is unset, `/mcp` returns 503 (fails closed).

Tool `send_sms` takes `message` (required) and `source` (optional short tag, e.g. `t3code`, sent as a `[source] ` prefix).

All SMS bodies are sanitized to plain ASCII (emoji removed, em/en dashes become `-`, accents stripped), truncated to 900 chars.

### Abuse guard

- Sends are serialized with at least 1.5 s between calls to Free's API.
- More than 20 SMS in the last hour: `send_sms` is refused. The Grafana webhook bypasses this cap on purpose (alerts must always get through) but still counts toward it and is still serialized.
- State is in memory (per replica, reset on restart).

## MCP client configuration

```bash
claude mcp add --scope user --transport http sms https://sms-mcp.server.begue.cc/mcp \
  --header "Authorization: Bearer <token>"
```

Generic JSON config:

```json
{ "mcpServers": { "sms": { "type": "http", "url": "https://sms-mcp.server.begue.cc/mcp",
  "headers": { "Authorization": "Bearer <token>" } } } }
```

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
export MCP_TOKEN='long_random_token'
export PORT=3000  # Optional, defaults to 3000
```

4. Run the server:

```bash
bun run index.ts
bun test && bunx tsc --noEmit
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
  -e MCP_TOKEN='long_random_token' \
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
- `MCP_TOKEN`: Bearer token required on `/mcp` (unset disables `/mcp` with 503)
- `PORT`: (Optional) Port for the webhook server, defaults to 3000

## Security Recommendations

- Never commit secrets to version control
- Use Kubernetes secrets or external secret management
- Rotate credentials periodically
