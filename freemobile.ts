import { sanitize } from './sanitize';

// Mutable so tests can shrink them.
export const limits = { perHour: 20, gapMs: 1500 };

const STATUS_TEXT: Record<number, string> = {
  400: 'missing parameter',
  402: 'too many SMS sent too fast (Free Mobile limit)',
  403: 'service not enabled or bad credentials',
  500: 'Free Mobile server error',
};

export interface SendResult {
  ok: boolean;
  status: number;
  detail: string;
}

const sentAt: number[] = [];
let lastCall = 0;
let queue: Promise<unknown> = Promise.resolve();

export function resetState() {
  sentAt.length = 0;
  lastCall = 0;
}

async function deliver(body: string): Promise<SendResult> {
  const user = process.env.FREE_MOBILE_USER_ID;
  const pass = process.env.FREE_MOBILE_PASS;
  if (!user || !pass) return { ok: false, status: 0, detail: 'SMS credentials not configured on the server' };

  const wait = lastCall + limits.gapMs - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCall = Date.now();
  sentAt.push(lastCall);

  const url = new URL('https://smsapi.free-mobile.fr/sendmsg');
  url.search = new URLSearchParams({ user, pass, msg: body }).toString();
  try {
    const res = await fetch(url);
    if (res.status === 200) return { ok: true, status: 200, detail: 'sent' };
    return { ok: false, status: res.status, detail: STATUS_TEXT[res.status] ?? `unexpected status ${res.status}` };
  } catch {
    // Deliberately drop the error object: its message can contain the full URL (with credentials).
    return { ok: false, status: 0, detail: 'network error reaching Free Mobile' };
  }
}

/**
 * Sanitize, rate-limit, serialize and send an SMS.
 * `bypassLimit` skips the hourly cap (used by Grafana alerts, which must always get through);
 * the send is still serialized and still counted toward the cap.
 */
export async function sendSms(
  message: string,
  opts: { source?: string; label?: string; bypassLimit?: boolean } = {},
): Promise<SendResult> {
  const source = opts.source ? sanitize(opts.source).replace(/[\[\]\n]/g, '') : '';
  const body = sanitize(source ? `[${source}] ${message}` : message);
  const label = opts.label || source || 'unknown';
  if (!body) return log(label, 0, { ok: false, status: 0, detail: 'message is empty after removing unsupported characters' });

  const run = queue.then(async () => {
    const cutoff = Date.now() - 3_600_000;
    while (sentAt.length && sentAt[0] < cutoff) sentAt.shift();
    if (!opts.bypassLimit && sentAt.length >= limits.perHour) {
      return { ok: false, status: 429, detail: `rate limit: more than ${limits.perHour} SMS in the last hour` };
    }
    return deliver(body);
  });
  queue = run.catch(() => {});
  return log(label, body.length, await run);
}

function log(source: string, length: number, r: SendResult): SendResult {
  console.log(`sms source=${source} length=${length} status=${r.status}`);
  return r;
}
