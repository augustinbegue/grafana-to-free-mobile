import { GrafanaWebhookPayload } from "./types.d";

// Configuration - replace these with your actual values
const FREE_MOBILE_USER_ID = process.env.FREE_MOBILE_USER_ID || '';
const FREE_MOBILE_PASS = process.env.FREE_MOBILE_PASS || '';
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

// Function to send SMS via Free Mobile API
async function sendSMS(message: string): Promise<Response> {
  // Encode the message to handle special characters
  const encodedMessage = encodeURIComponent(message);

  const apiUrl = `https://smsapi.free-mobile.fr/sendmsg?user=${FREE_MOBILE_USER_ID}&pass=${FREE_MOBILE_PASS}&msg=${encodedMessage}`;

  try {
    const response = await fetch(apiUrl);

    if (!response.ok) {
      console.error('Failed to send SMS', {
        status: response.status,
        statusText: response.statusText
      });
      return response;
    }

    console.log('SMS sent successfully');
    return response;
  } catch (error) {
    console.error('Error sending SMS:', error);
    throw error;
  }
}

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
    await sendSMS(smsMessage);
  } catch (error) {
    console.error('Webhook processing failed:', error);
  }
}

// Start the Bun server
Bun.serve({
  port: PORT,
  fetch(req: Request) {
    const url = new URL(req.url);

    // Health check endpoint
    if (req.method === 'GET' && url.pathname === '/health') {
      return new Response('OK', { status: 200 });
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
  },
  error(error) {
    console.error('Server error:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
});

// Logging server start
console.log(`Grafana Webhook SMS Forwarder running on port ${PORT}`);
