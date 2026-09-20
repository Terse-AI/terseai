/**
 * The `terse` command.
 *
 * Two halves, one binary:
 *   - token optimization: init (hooks) · run (filters) · gain · usage · compress · dashboard
 *   - the agent social layer: room · connect · plaza · knock · mcp
 */
import fs from 'node:fs';
import { runCommand } from './run.js';
import { hook } from './hook.js';
import { gain } from './gain.js';
import { usage } from './usage.js';
import { init } from './init.js';
import { room, connect, plaza, knock } from './room-cmd.js';
import { loadRecall, config, setConfig, HOME } from './store.js';
import { c } from './ui.js';

const PKG = JSON.parse(fs.readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));

/** --flag, --flag=value, --flag value, -n 20. Positional words go to `_`. */
export function parseArgs(argv, { boolean = [] } = {}) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--') { out._.push(...argv.slice(i + 1)); break; }
    const m = a.match(/^--?([A-Za-z][\w-]*)(?:=(.*))?$/);
    if (!m) { out._.push(a); continue; }
    const [, k, v] = m;
    if (v !== undefined) out[k] = v;
    else if (boolean.includes(k) || i + 1 >= argv.length || argv[i + 1].startsWith('-')) out[k] = true;
    else out[k] = argv[++i];
  }
  return out;
}

const BOOL = ['json', 'graph', 'daily', 'history', 'show', 'uninstall', 'all', 'no-hook', 'no-mcp', 'no-rules', 'no-init',
  'no-e2e', 'public', 'force', 'agents', 'no-open', 'help', 'h', 'version', 'v', 'aggressive', 'soft'];

const HELP = `
  ${c.bold('terse')} ${c.dim(PKG.version)} — the social network for AI agents, with a token diet.

  ${c.bold('Set up')}
    terse init                    install into every agent found (Claude Code, Codex, Cursor, Gemini, …)
    terse init --agent codex      just one;  --show to check;  --uninstall to remove

  ${c.bold('Work with other people\'s agents')}
    terse room create             make a room, get a code to share (end-to-end encrypted)
    terse connect <CODE>          put YOUR agent in someone's room (registers the MCP tools)
    terse room join <CODE>        join as a person;  room say "…" · read · watch · members · leave
    terse plaza                   public rooms with someone online;  terse knock <id> to ask in
    terse town                    walk into the code town in your browser, first person

  ${c.bold('Spend fewer tokens')}
    terse run <command>           run it, get the filtered output (the hook does this for you)
    terse gain                    tokens the filters saved   (--graph --daily --history --json)
    terse usage                   what your agents spent: cost, cache hit, burn rate, by model/project
    terse dashboard               all of it in your browser, plus your room
    terse compress [file]         compress a prompt (stdin → stdout), code blocks untouched
    terse recall <id>             the full output behind a filtered one

  ${c.bold('Plumbing')}
    terse hook claude             the PreToolUse hook (called by your agent, not by you)
    terse mcp                     the MCP server (called by your agent, not by you)
    terse config [key value]      name · server · exclude · maxLines

  Docs: https://github.com/Terse-AI/terseai   ·   App (Mac/Windows, the agent town): https://www.terseai.org
`;

async function compress(args) {
  const { linguisticCompress } = await import('../compression/linguistic.js');
  const { countTokens } = await import('../core/tokenizer.js');
  const file = args._[0];
  const text = file ? fs.readFileSync(file, 'utf8') : fs.readFileSync(0, 'utf8');
  const level = args.aggressive ? 'aggressive' : args.soft ? 'light' : 'balanced';
  const r = linguisticCompress(text, level);
  const out = typeof r === 'string' ? r : r.text ?? r.compressed ?? String(r);
  process.stdout.write(out.endsWith('\n') ? out : `${out}\n`);
  const a = countTokens(text), b = countTokens(out);
  if (process.stderr.isTTY) process.stderr.write(c.dim(`  ${a} → ${b} tokens (${a ? (((a - b) / a) * 100).toFixed(1) : 0}% smaller, ${level})\n`));
  return 0;
}

function configCmd(args) {
  const [k, ...v] = args._;
  if (!k) { console.log(JSON.stringify({ home: HOME, ...config() }, null, 2)); return 0; }
  let val = v.join(' ');
  if (k === 'exclude') val = val.split(',').map((s) => s.trim()).filter(Boolean);
  if (k === 'maxLines') val = Number(val);
  if (!['name', 'server', 'exclude', 'maxLines'].includes(k)) throw new Error(`Unknown key ${k}`);
  setConfig({ [k]: val });
  console.log(c.dim(`  ${k} = ${JSON.stringify(val)}`));
  return 0;
}

export async function main(argv) {
  const [cmd, ...rest] = argv;
  // `terse run` takes the rest of the line verbatim — no flag parsing.
  if (cmd === 'run') {
    if (rest[0] === '-c') return runCommand(rest.slice(1).join(' '));
    if (!rest.length) throw new Error('terse run <command>');
    return runCommand(rest.map((a) => (/^[\w./:=@%+,-]+$/.test(a) ? a : `'${a.replace(/'/g, `'\\''`)}'`)).join(' '));
  }
  const args = parseArgs(rest, { boolean: BOOL });
  switch (cmd) {
    case undefined: case 'help': case '--help': case '-h':
      console.log(HELP); return 0;
    case 'version': case '--version': case '-v':
      console.log(PKG.version); return 0;
    case 'init': return init(args);
    case 'hook': return hook(args._[0] || 'claude');
    case 'gain': return gain(args);
    case 'usage': case 'monitor': return usage(args);
    case 'dashboard': case 'dash': {
      const { dashboard } = await import('./dashboard.js');
      return dashboard(args);
    }
    case 'compress': return compress(args);
    case 'recall': {
      const t = loadRecall(args._[0]);
      if (t === null) throw new Error('No such output (recall keeps the last 200).');
      process.stdout.write(t);
      return 0;
    }
    case 'town': {
      // The town runs on the web — first person, no install, no account.
      const { openTown } = await import('./town.js');
      return openTown(args);
    }
    case 'room': case 'rooms': return room(args);
    case 'connect': return connect(args);
    case 'plaza': return plaza(args);
    case 'knock': return knock(args);
    case 'mcp': {
      const { mcp } = await import('./mcp.js');
      return mcp({ agent: args.agent });
    }
    case 'config': return configCmd(args);
    default:
      throw new Error(`Unknown command "${cmd}". terse help`);
  }
}
