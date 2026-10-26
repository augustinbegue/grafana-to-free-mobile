import { createHash, timingSafeEqual } from 'node:crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { z } from 'zod';
import { sendSms } from './freemobile';

function tokenMatches(header: string | null, token: string): boolean {
  const given = header?.match(/^Bearer (.+)$/i)?.[1] ?? '';
  const digest = (s: string) => createHash('sha256').update(s).digest();
  return timingSafeEqual(digest(given), digest(token));
}

function buildServer(): McpServer {
  const server = new McpServer({ name: 'free-mobile-sms', version: '1.0.0' });
  server.registerTool(
    'send_sms',
    {
      description:
        "Send a text message (SMS) to Augustin's phone. Use sparingly, only when he needs to know now " +
        '(task finished, blocked, needs a decision). Keep it short and actionable, plain text, no emoji or markdown. ' +
        'Set source to a short tag of where you run (e.g. "t3code", "laptop").',
      inputSchema: {
        message: z.string().min(1).describe('Plain-text SMS body, short and actionable (max ~900 chars)'),
        source: z.string().max(32).optional().describe('Short sender tag, prefixed as "[source] "'),
      },
    },
    async ({ message, source }) => {
      const r = await sendSms(message, { source });
      return {
        content: [{ type: 'text' as const, text: r.ok ? 'SMS sent' : `SMS not sent: ${r.detail}` }],
        isError: !r.ok,
      };
    },
  );
  return server;
}

export async function handleMcp(req: Request): Promise<Response> {
  const token = process.env.MCP_TOKEN;
  if (!token) return new Response('MCP disabled: MCP_TOKEN not set', { status: 503 });
  if (!tokenMatches(req.headers.get('authorization'), token)) {
    return new Response('Unauthorized', { status: 401, headers: { 'WWW-Authenticate': 'Bearer' } });
  }
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405, headers: { Allow: 'POST' } });
  }
  // Stateless: fresh server + transport per request
  const server = buildServer();
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await server.connect(transport);
  return transport.handleRequest(req);
}
