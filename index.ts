import { Serve } from "bun";

// Configuration - replace these with your actual values
const FREE_MOBILE_USER_ID = process.env.FREE_MOBILE_USER_ID || '';
const FREE_MOBILE_PASS = process.env.FREE_MOBILE_PASS || '';

// Interface for Grafana Webhook payload
interface GrafanaWebhookPayload {
  ruleName: string;
  state: string;
  message: string;
  evalMatches?: Array<{
    value: number;
    metric: string;
  }>;
}

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
  const smsMessage = `Alert: ${payload.ruleName} is in ${payload.state} state. ${payload.message}`;

  try {
    await sendSMS(smsMessage);
  } catch (error) {
    console.error('Webhook processing failed:', error);
  }
}

// Bun server handler
export default {
  port: process.env.PORT ? parseInt(process.env.PORT) : 3000,
  async fetch(req: Request) {
    const url = new URL(req.url);

    // Health check endpoint
    if (req.method === 'GET' && url.pathname === '/health') {
      return new Response('OK', { status: 200 });
    }

    // Webhook endpoint
    if (req.method === 'POST' && url.pathname === '/webhook') {
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
    }

    // Not Found for other routes
    return new Response('Not Found', { status: 404 });
  }
} satisfies Serve;

// Logging server start
console.log(`Grafana Webhook SMS Forwarder running on port ${process.env.PORT || 3000}`);
