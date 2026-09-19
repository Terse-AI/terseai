/**
 * `terse usage` — what your agents actually spent, read from their own logs.
 *
 *   Claude Code   ~/.claude/projects/<project>/<session>.jsonl   (exact usage per API response)
 *   Codex         ~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl   (token_count events)
 *
 * Nothing is uploaded. This is the same data the Terse app's Overview reads —
 * tokens, cost, cache efficiency, burn rate — shown in the terminal.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { c, table, num, pct, money, spark, bar } from './ui.js';

const DAY = 86400000;

/* $ per million tokens: [input, output, cache write (5m), cache read].
   Anthropic first-party rates; matched by prefix, longest first. */
const PRICES = [
  ['claude-fable-5', [10, 50, 12.5, 0.25]],
  ['claude-mythos-5', [10, 50, 12.5, 1]],
  ['claude-opus-5', [5, 25, 6.25, 0.5]],
  ['claude-opus-4-8', [5, 25, 6.25, 0.5]],
  ['claude-opus-4-7', [5, 25, 6.25, 0.5]],
  ['claude-opus-4-6', [5, 25, 6.25, 0.5]],
  ['claude-opus-4-5', [5, 25, 6.25, 0.5]],
  ['claude-opus-4', [15, 75, 18.75, 1.5]],
  ['claude-sonnet-5', [2, 10, 2.5, 0.2]],
  ['claude-sonnet-4', [3, 15, 3.75, 0.3]],
  ['claude-3-7-sonnet', [3, 15, 3.75, 0.3]],
  ['claude-haiku-4-5', [1, 5, 1.25, 0.1]],
  ['claude-3-5-haiku', [0.8, 4, 1, 0.08]],
  ['gpt-5', [1.25, 10, 0, 0.125]],
  ['o3', [2, 8, 0, 0.5]],
  ['o4-mini', [1.1, 4.4, 0, 0.275]],
  ['gpt-4.1', [2, 8, 0, 0.5]],
];
export function priceOf(model) {
  const m = String(model || '');
  const hit = PRICES.find(([k]) => m.startsWith(k));
  return hit ? hit[1] : [3, 15, 3.75, 0.3];
}
export function costOf(u, model) {
  const [i, o, w, r] = priceOf(model);
  return (u.input * i + u.output * o + u.cacheWrite * w + u.cacheRead * r) / 1e6;
}

function walk(dir, test, out = [], depth = 0) {
  let ents;
  try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of ents) {
    const f = path.join(dir, e.name);
    if (e.isDirectory() && depth < 5) walk(f, test, out, depth + 1);
    else if (e.isFile() && test(e.name)) out.push(f);
  }
  return out;
}

const lines = (file) => {
  try { return fs.readFileSync(file, 'utf8').split('\n'); } catch { return []; }
};

/** One row per billed API response. */
export function claudeEvents(since, home = os.homedir()) {
  const root = path.join(process.env.CLAUDE_CONFIG_DIR || path.join(home, '.claude'), 'projects');
  const seen = new Set();
  const out = [];
  for (const file of walk(root, (n) => n.endsWith('.jsonl'))) {
    let st;
    try { st = fs.statSync(file); } catch { continue; }
    if (st.mtimeMs < since) continue;
    const project = path.basename(path.dirname(file)).replace(/^-/, '/').replace(/-/g, '/');
    const session = path.basename(file, '.jsonl');
    for (const line of lines(file)) {
      if (!line.includes('"usage"')) continue;
      let j;
      try { j = JSON.parse(line); } catch { continue; }
      const m = j.message;
      if (!m || !m.usage || j.type !== 'assistant') continue;
      // Streaming writes the same response several times; bill it once.
      const key = `${m.id || ''}:${j.requestId || ''}`;
      if (m.id && seen.has(key)) continue;
      seen.add(key);
      const t = Date.parse(j.timestamp);
      if (!Number.isFinite(t) || t < since) continue;
      const u = m.usage;
      out.push({
        agent: 'claude-code', t, model: m.model || 'unknown', project: j.cwd || project, session,
        input: u.input_tokens || 0, output: u.output_tokens || 0,
        cacheWrite: u.cache_creation_input_tokens || 0, cacheRead: u.cache_read_input_tokens || 0,
      });
    }
  }
  return out;
}

/** Codex writes running totals; a session's usage is the delta between events. */
export function codexEvents(since, home = os.homedir()) {
  const root = path.join(process.env.CODEX_HOME || path.join(home, '.codex'), 'sessions');
  const out = [];
  for (const file of walk(root, (n) => /^rollout-.*\.jsonl$/.test(n))) {
    let st;
    try { st = fs.statSync(file); } catch { continue; }
    if (st.mtimeMs < since) continue;
    let model = 'gpt-5';
    let cwd = '';
    let prev = { input: 0, cached: 0, output: 0 };
    for (const line of lines(file)) {
      let j;
      try { j = JSON.parse(line); } catch { continue; }
      const p = j.payload || {};
      if (j.type === 'turn_context' || j.type === 'session_meta') {
        if (p.model) model = p.model;
        if (p.cwd) cwd = p.cwd;
      }
      const info = p.type === 'token_count' ? p.info : null;
      const tot = info && info.total_token_usage;
      if (!tot) continue;
      const cur = { input: tot.input_tokens || 0, cached: tot.cached_input_tokens || 0, output: (tot.output_tokens || 0) + (tot.reasoning_output_tokens || 0) };
      const d = { input: cur.input - prev.input, cached: cur.cached - prev.cached, output: cur.output - prev.output };
      prev = cur;
      const t = Date.parse(j.timestamp);
      if (!Number.isFinite(t) || t < since || (d.input <= 0 && d.output <= 0)) continue;
      // OpenAI's input_tokens already includes the cached part — bill it once.
      out.push({
        agent: 'codex', t, model, project: cwd, session: path.basename(file, '.jsonl'),
        input: Math.max(0, d.input - d.cached), output: Math.max(0, d.output), cacheWrite: 0, cacheRead: Math.max(0, d.cached),
      });
    }
  }
  return out;
}

export function collect({ days = 7 } = {}) {
  const since = Date.now() - days * DAY;
  return [...claudeEvents(since), ...codexEvents(since)].sort((a, b) => a.t - b.t);
}

function group(events, keyFn) {
  const m = new Map();
  for (const e of events) {
    const k = keyFn(e);
    const g = m.get(k) || { key: k, calls: 0, input: 0, output: 0, cacheWrite: 0, cacheRead: 0, cost: 0 };
    g.calls++;
    g.input += e.input; g.output += e.output; g.cacheWrite += e.cacheWrite; g.cacheRead += e.cacheRead;
    g.cost += costOf(e, e.model);
    m.set(k, g);
  }
  return [...m.values()];
}

/** Share of prompt tokens served from cache — the number that decides most bills. */
export const cacheHit = (g) => {
  const denom = g.input + g.cacheWrite + g.cacheRead;
  return denom ? g.cacheRead / denom : 0;
};

export function report(events, { days = 7 } = {}) {
  const [total] = group(events, () => 'all');
  const t = total || { calls: 0, input: 0, output: 0, cacheWrite: 0, cacheRead: 0, cost: 0 };
  const hour = events.filter((e) => e.t > Date.now() - 3600000);
  const [lastHour] = group(hour, () => 'h');
  const daily = group(events, (e) => new Date(e.t).toISOString().slice(0, 10)).sort((a, b) => a.key.localeCompare(b.key));
  // Which sessions are live right now: a response in the last five minutes.
  const live = group(events.filter((e) => e.t > Date.now() - 300000), (e) => `${e.agent}|${e.session}|${e.project}|${e.model}`);
  return {
    days, total: { ...t, cacheHit: cacheHit(t) },
    burnPerHour: lastHour ? lastHour.cost : 0,
    byAgent: group(events, (e) => e.agent).sort((a, b) => b.cost - a.cost),
    byModel: group(events, (e) => e.model).sort((a, b) => b.cost - a.cost),
    byProject: group(events, (e) => e.project || '?').sort((a, b) => b.cost - a.cost).slice(0, 15),
    daily,
    live: live.map((g) => {
      const [agent, session, project, model] = g.key.split('|');
      return { agent, session, project, model, calls: g.calls, cost: g.cost, cacheHit: cacheHit(g) };
    }),
  };
}

export function usage(args) {
  const days = Number(args.days || 7);
  const r = report(collect({ days }), { days });
  if (args.json) { console.log(JSON.stringify(r, null, 2)); return 0; }
  if (!r.total.calls) {
    console.log(`\n  No Claude Code or Codex activity in the last ${days} days on this machine.\n`);
    return 0;
  }
  const t = r.total;
  console.log(`\n  ${c.bold(`Terse — agent spend, last ${days}d`)}  ${c.dim('(read from local transcripts; nothing uploaded)')}\n`);
  console.log(`  ${c.acc(money(t.cost))} spent  ${c.dim('·')}  ${num(t.calls)} API calls  ${c.dim('·')}  burn ${money(r.burnPerHour)}/h (last hour)`);
  console.log(`  cache hit ${bar(t.cacheHit, 24)} ${pct(t.cacheHit)}   ${c.dim(`in ${num(t.input)} · write ${num(t.cacheWrite)} · read ${num(t.cacheRead)} · out ${num(t.output)}`)}\n`);
  console.log(`  ${c.bold('Daily')} ${spark(r.daily.map((d) => d.cost))}  ${c.dim(r.daily.map((d) => money(d.cost)).slice(-7).join(' · '))}\n`);
  const rows = (gs) => gs.map((g) => [g.key.length > 48 ? `…${g.key.slice(-47)}` : g.key, num(g.calls), num(g.input + g.cacheWrite + g.cacheRead), num(g.output), pct(cacheHit(g)), money(g.cost)]);
  const head = ['', 'calls', 'prompt', 'output', 'cache', 'cost'];
  console.log(table(['agent', ...head.slice(1)], rows(r.byAgent)));
  console.log();
  console.log(table(['model', ...head.slice(1)], rows(r.byModel)));
  console.log();
  console.log(table(['project', ...head.slice(1)], rows(r.byProject.slice(0, 8))));
  if (r.live.length) {
    console.log(`\n  ${c.bold('Live now')} ${c.dim('(a response in the last 5 min)')}`);
    for (const l of r.live) console.log(`  ${c.green('●')} ${l.agent}  ${l.model}  ${c.dim(l.project)}  ${money(l.cost)}  cache ${pct(l.cacheHit)}`);
  }
  if (t.cacheHit < 0.5 && t.calls > 50) {
    console.log(`\n  ${c.yellow('!')} Cache hit is ${pct(t.cacheHit)}. Something is changing your prompt prefix between calls —`);
    console.log(`    reordered tools, a timestamp in the system prompt, or MCP servers toggling. Fixing that usually beats any compression.`);
  }
  console.log(`\n  ${c.dim('terse usage --days 30 · --json   ·   terse dashboard for charts')}\n`);
  return 0;
}
