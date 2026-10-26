import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { handle } from './index';
import { limits, resetState } from './freemobile';
import { sanitize } from './sanitize';

describe('sanitize', () => {
  test('replaces typographic chars', () => {
    expect(sanitize('a — b – c “q” it’s…')).toBe('a - b - c "q" it\'s...');
  });
  test('strips emoji', () => expect(sanitize('Deploy done \u{1F680}✅ ok')).toBe('Deploy done ok'));
  test('removes accents', () => expect(sanitize('été à Noël, Ça')).toBe('ete a Noel, Ca'));
  test('collapses newlines and trims', () => expect(sanitize('  a\n\n\n\nb \n')).toBe('a\n\nb'));
  test('truncates to 900 with ellipsis', () => {
    const out = sanitize('x'.repeat(2000));
    expect(out.length).toBe(900);
    expect(out.endsWith('...')).toBe(true);
  });
  test('empty after stripping', () => expect(sanitize(' \u{1F680} ')).toBe(''));
});

const realFetch = globalThis.fetch;
let freeCalls: URL[] = [];
let freeStatus = 200;

beforeEach(() => {
  process.env.MCP_TOKEN = 'secret';
  process.env.FREE_MOBILE_USER_ID = 'uid';
  process.env.FREE_MOBILE_PASS = 'pw';
  limits.gapMs = 0;
  limits.perHour = 20;
  resetState();
  freeCalls = [];
  freeStatus = 200;
  globalThis.fetch = (async (input: any) => {
    freeCalls.push(new URL(String(input)));
    return new Response('', { status: freeStatus });
  }) as typeof fetch;
});
afterEach(() => {
  globalThis.fetch = realFetch;
});

const rpc = (method: string, params: unknown, id = 1, token: string | null = 'secret') =>
  handle(
    new Request('http://x/mcp', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
    }),
  ) as Promise<Response>;

const call = (args: unknown) => rpc('tools/call', { name: 'send_sms', arguments: args });

describe('/mcp', () => {
  test('auth: 401 without or with wrong token, 503 without MCP_TOKEN', async () => {
    expect((await rpc('tools/list', {}, 1, null)).status).toBe(401);
    expect((await rpc('tools/list', {}, 1, 'nope')).status).toBe(401);
    delete process.env.MCP_TOKEN;
    expect((await rpc('tools/list', {}, 1, 'secret')).status).toBe(503);
  });

  test('GET and DELETE are 405', async () => {
    for (const method of ['GET', 'DELETE']) {
      const res = await handle(new Request('http://x/mcp', { method, headers: { authorization: 'Bearer secret' } }));
      expect(res.status).toBe(405);
    }
  });

  test('initialize, tools/list, tools/call', async () => {
    const init = await rpc('initialize', {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: { name: 't', version: '1' },
    });
    expect(init.status).toBe(200);
    expect((await init.json()).result.serverInfo.name).toBe('free-mobile-sms');

    const list = await (await rpc('tools/list', {}, 2)).json();
    expect(list.result.tools.map((t: any) => t.name)).toEqual(['send_sms']);

    const res = await (await call({ message: 'Build done \u{1F680} — ok', source: 't3code' })).json();
    expect(res.result.isError).toBeFalsy();
    expect(res.result.content[0].text).toBe('SMS sent');
    expect(freeCalls).toHaveLength(1);
    expect(freeCalls[0].searchParams.get('user')).toBe('uid');
    expect(freeCalls[0].searchParams.get('msg')).toBe('[t3code] Build done - ok');
  });

  test('maps Free status codes to errors', async () => {
    freeStatus = 402;
    const res = await (await call({ message: 'hi' })).json();
    expect(res.result.isError).toBe(true);
    expect(res.result.content[0].text).toContain('too many SMS');
  });

  test('empty after sanitizing is an error and sends nothing', async () => {
    const res = await (await call({ message: '\u{1F680}' })).json();
    expect(res.result.isError).toBe(true);
    expect(freeCalls).toHaveLength(0);
  });

  test('hourly cap blocks tool but not webhook', async () => {
    limits.perHour = 2;
    await call({ message: 'a' });
    await call({ message: 'b' });
    const res = await (await call({ message: 'c' })).json();
    expect(res.result.isError).toBe(true);
    expect(res.result.content[0].text).toContain('rate limit');
    expect(freeCalls).toHaveLength(2);

    const hook = await handle(
      new Request('http://x/webhook', {
        method: 'POST',
        body: JSON.stringify({ title: 'Alert', alerts: [] }),
      }),
    );
    expect(hook.status).toBe(200);
    expect(freeCalls).toHaveLength(3);
  });
});

describe('other routes', () => {
  test('/health is open', async () => {
    const res = await handle(new Request('http://x/health'));
    expect(res.status).toBe(200);
  });
});
