/**
 * `terse gain` — what the output filters saved.
 *
 * Numbers are tokens of shell output the agent did NOT have to read, estimated
 * with the SDK's tokenizer. That is one slice of your input tokens, not your
 * whole bill — `terse usage` shows the whole bill.
 */
import { readGain } from './store.js';
import { c, bar, table, num, pct, money, spark } from './ui.js';

const DAY = 86400000;
const dayKey = (t) => new Date(t).toISOString().slice(0, 10);
// What a saved input token is worth, for the one-line $ estimate: Sonnet-class input.
const USD_PER_MTOK = 3;

export function summarize(rows, { days = null } = {}) {
  const since = days ? Date.now() - days * DAY : 0;
  const r = rows.filter((x) => x.t >= since);
  const tin = r.reduce((s, x) => s + x.in, 0);
  const tout = r.reduce((s, x) => s + x.out, 0);
  const byCmd = new Map();
  for (const x of r) {
    const k = x.cmd || '?';
    const e = byCmd.get(k) || { cmd: k, runs: 0, in: 0, out: 0 };
    e.runs++; e.in += x.in; e.out += x.out;
    byCmd.set(k, e);
  }
  const byDay = new Map();
  for (const x of r) {
    const k = dayKey(x.t);
    const e = byDay.get(k) || { day: k, runs: 0, in: 0, out: 0 };
    e.runs++; e.in += x.in; e.out += x.out;
    byDay.set(k, e);
  }
  return {
    runs: r.length, in: tin, out: tout, saved: tin - tout,
    pct: tin ? (tin - tout) / tin : 0,
    usd: ((tin - tout) / 1e6) * USD_PER_MTOK,
    commands: [...byCmd.values()].sort((a, b) => (b.in - b.out) - (a.in - a.out)),
    daily: [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day)),
    recent: r.slice(-25).reverse(),
  };
}

export function gain(args) {
  const rows = readGain();
  const days = args.days ? Number(args.days) : null;
  const s = summarize(rows, { days });
  if (args.json || args.format === 'json') {
    console.log(JSON.stringify(s, null, 2));
    return 0;
  }
  if (!s.runs) {
    console.log(`${c.bold('No filtered commands yet.')}

  Run ${c.acc('terse init')} to install the hook for your agent, restart it,
  then let it run a ${c.dim('git status')} or a test suite. Or try one by hand:

    ${c.acc('terse run git log -n 20')}
`);
    return 0;
  }
  console.log(`\n  ${c.bold('Terse — tokens your agent did not have to read')}${days ? c.dim(`  (last ${days}d)`) : ''}\n`);
  console.log(`  ${c.acc(num(s.saved))} tokens saved  ${c.dim('·')}  ${c.bold(pct(s.pct))} of shell output  ${c.dim('·')}  ${s.runs} runs  ${c.dim('·')}  ≈ ${money(s.usd)} at $${USD_PER_MTOK}/M input\n`);
  console.log(`  ${bar(s.pct, 40)} ${pct(s.pct)}\n`);

  if (args.graph || args.daily) {
    const last = s.daily.slice(-30);
    console.log(`  ${c.bold('Daily')}  ${spark(last.map((d) => d.in - d.out))}\n`);
    if (args.daily) {
      console.log(table(['day', 'runs', 'raw', 'sent', 'saved'],
        last.map((d) => [d.day, d.runs, num(d.in), num(d.out), `${num(d.in - d.out)} ${c.dim(pct(d.in ? (d.in - d.out) / d.in : 0))}`])));
      console.log();
    }
  }
  if (args.history) {
    console.log(table(['when', 'command', 'raw → sent', 'saved'],
      s.recent.map((x) => [new Date(x.t).toLocaleString(), x.cmd, `${num(x.in)} → ${num(x.out)}`,
        pct(x.in ? (x.in - x.out) / x.in : 0) + (x.exit ? c.red(` exit ${x.exit}`) : '')])));
    console.log();
    return 0;
  }
  console.log(table(['command', 'runs', 'raw', 'sent', 'saved'],
    s.commands.slice(0, 12).map((e) => [e.cmd, e.runs, num(e.in), num(e.out), `${num(e.in - e.out)} ${c.dim(pct(e.in ? (e.in - e.out) / e.in : 0))}`])));
  console.log(`\n  ${c.dim('terse gain --graph · --daily · --history · --json   ·   terse dashboard for the full view')}\n`);
  return 0;
}
