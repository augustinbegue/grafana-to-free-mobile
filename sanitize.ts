// Free Mobile silently strips emoji and the owner dislikes em dashes: reduce text to plain ASCII.
const MAX_LENGTH = 900;

const TYPOGRAPHIC: Record<string, string> = {
  '—': '-', '–': '-', '‒': '-', '―': '-', '−': '-',
  '‘': "'", '’': "'", '‚': "'", '‛': "'",
  '“': '"', '”': '"', '„': '"', '‟': '"',
  '…': '...',
  ' ': ' ', ' ': ' ', ' ': ' ', ' ': ' ', ' ': ' ', ' ': ' ', ' ': ' ',
  '•': '-', '·': '-', '●': '-', '◦': '-',
  'œ': 'oe', 'Œ': 'OE', 'æ': 'ae', 'Æ': 'AE', 'ß': 'ss',
};

export function sanitize(input: string): string {
  let s = input.replace(/[^\x00-\x7F]/g, (c) => TYPOGRAPHIC[c] ?? c);
  // NFKD splits accented letters into base + combining mark; drop the marks (e -> e)
  s = s.normalize('NFKD').replace(/\p{M}+/gu, '');
  s = s
    .replace(/\r\n?/g, '\n')
    .replace(/[^\x20-\x7E\n]/g, '')
    .replace(/[ ]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (s.length > MAX_LENGTH) s = s.slice(0, MAX_LENGTH - 3).trimEnd() + '...';
  return s;
}
