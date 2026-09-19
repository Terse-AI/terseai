/** Terminal formatting. No dependencies; colour only when stdout is a TTY. */

const tty = process.stdout.isTTY && !process.env.NO_COLOR;
const wrap = (a, b) => (s) => (tty ? `\x1b[${a}m${s}\x1b[${b}m` : String(s));

export const c = {
  bold: wrap(1, 22),
  dim: wrap(2, 22),
  red: wrap(31, 39),
  green: wrap(32, 39),
  yellow: wrap(33, 39),
  cyan: wrap(36, 39),
  // Terse's lime, where the terminal can show it.
  acc: tty ? (s) => `\x1b[38;2;198;216;44m${s}\x1b[39m` : String,
};

// eslint-disable-next-line no-control-regex
const visible = (s) => String(s).replace(/\x1b\[[0-9;]*m/g, '');

export function num(n) {
  const a = Math.abs(n);
  if (a >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (a >= 1e4) return `${(n / 1e3).toFixed(1)}K`;
  return Math.round(n).toLocaleString('en-US');
}
export const pct = (x) => `${(x * 100).toFixed(1)}%`;
export const money = (x) => (x >= 100 ? `$${x.toFixed(0)}` : `$${x.toFixed(2)}`);

export function bar(frac, width = 30) {
  const f = Math.max(0, Math.min(1, frac || 0));
  const full = Math.round(f * width);
  return c.acc('█'.repeat(full)) + c.dim('░'.repeat(width - full));
}

const TICKS = '▁▂▃▄▅▆▇█';
export function spark(values) {
  if (!values.length) return '';
  const max = Math.max(...values, 1);
  return c.acc(values.map((v) => TICKS[Math.max(0, Math.min(7, Math.round((v / max) * 7)))]).join(''));
}

export function table(head, rows) {
  const all = [head, ...rows].map((r) => r.map((x) => String(x)));
  const w = head.map((_, i) => Math.max(...all.map((r) => visible(r[i] || '').length)));
  const line = (r, style = (s) => s) => '  ' + r.map((x, i) => {
    const pad = ' '.repeat(Math.max(0, w[i] - visible(x).length));
    return i === 0 ? style(x) + pad : pad + style(x);
  }).join('   ');
  return [line(all[0], c.dim), '  ' + c.dim(w.map((n) => '─'.repeat(n)).join('   ')), ...all.slice(1).map((r) => line(r))].join('\n');
}
