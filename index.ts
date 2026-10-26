import { GrafanaWebhookPayload } from "./types.d";

import { sendSms } from "./freemobile";
import { handleMcp } from "./mcp";

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

// Function to process Grafana webhook
async function processWebhook(payload: GrafanaWebhookPayload) {
  // Construct a meaningful SMS message
  console.log('Processing webhook:', payload);
  let smsMessage = `${payload.title}`;
  payload.alerts.forEach((alert) => {
    smsMessage += `\n\n${alert.labels.alertname}: ${alert.annotations.summary}`;
    smsMessage += `\nStatus: ${alert.status}`;
    smsMessage += `\nDate: ${new Date(alert.startsAt).toLocaleString()}`;
    smsMessage += '\nLabels:';
    Object.keys(alert.labels)
      .filter((key) => key !== 'alertname')
      .forEach((key) => {
        smsMessage += `\n- ${key}: ${alert.labels[key]}`;
      });
    if (alert.values) {
      smsMessage += '\nValues:';
      Object.keys(alert.values).forEach((key) => {
        smsMessage += `\n- ${key}: ${alert.values[key]}`;
      });
    }
  });

  try {
    await sendSms(smsMessage, { label: 'grafana', bypassLimit: true });
  } catch (error) {
    console.error('Webhook processing failed:', error);
  }
}

export function handle(req: Request): Response | Promise<Response> {
    const url = new URL(req.url);

    // Health check endpoint
    if (req.method === 'GET' && url.pathname === '/health') {
      return new Response('OK', { status: 200 });
    }

    // MCP endpoint (auth handled in handleMcp)
    if (url.pathname === '/mcp') {
      return handleMcp(req);
    }

    // Webhook endpoint
    if (req.method === 'POST' && url.pathname === '/webhook') {
      return (async () => {
        try {
          // Parse the incoming webhook payload
          const payload: GrafanaWebhookPayload = await req.json();

          // Process the webhook
          await processWebhook(payload);

          // Respond with success
          return new Response('Webhook received and processed', { status: 200 });
        } catch (error) {
          console.error('Webhook error:', error);
          return new Response('Error processing webhook', { status: 500 });
        }
      })();
    }

    // Not Found for other routes
    return new Response('Not Found', { status: 404 });
}

if (import.meta.main) {
  Bun.serve({
    port: PORT,
    fetch: handle,
    error(error) {
      console.error('Server error:', error);
      return new Response('Internal Server Error', { status: 500 });
    }
  });
  console.log(`Grafana Webhook SMS Forwarder + MCP running on port ${PORT}`);
}
