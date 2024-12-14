// Interface for Grafana Webhook payload
export interface GrafanaWebhookPayload {
  receiver: string;
  status: 'firing' | 'resolved';
  orgId: number;
  alerts: Alert[];
  groupLabels: Record<string, string>;
  commonLabels: Record<string, string>;
  commonAnnotations: Record<string, string>;
  externalURL: string;
  version: string;
  groupKey: string;
  truncatedAlerts: number;
  title: string;
  state: 'alerting' | 'ok';
  message: string;
}

export interface Alert {
  status: 'firing' | 'resolved';
  labels: Record<string, string>;
  annotations: Record<string, string>;
  startsAt: string;
  endsAt: string;
  generatorURL: string;
  fingerprint: string;
  silenceURL: string;
  dashboardURL: string;
  panelURL: string;
  values: Record<string, number>;
}
