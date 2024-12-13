// Interface for Grafana Webhook payload
export interface GrafanaWebhookPayload {
  ruleName: string;
  state: string;
  message: string;
  evalMatches?: Array<{
    value: number;
    metric: string;
  }>;
}
