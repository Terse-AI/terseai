/**
 * `terse hook <agent>` — the auto-rewrite hook.
 *
 * The agent calls this before every shell command with the tool call on stdin.
 * If Terse has a filter for the command, the command comes back rewritten to
 * `terse run -c '<the same command>'`; otherwise the hook prints nothing and the
 * command runs untouched.
 *
 * What it deliberately does NOT do: approve anything. The rewritten command goes
 * through the agent's normal permission flow, exactly like the original would.
 */
import { route, words } from './filters.js';
import { config } from './store.js';

/** POSIX single-quote a string: 'it'\''s' */
export const shq = (s) => `'${String(s).replace(/'/g, `'\\''`)}'`;

/* Anything the shell itself interprets — pipes, redirects, chains, substitution,
   heredocs — is left alone. The agent built that pipeline on purpose, and output
   that is already being piped into grep/head is already small. */
const SHELLY = /[|;&<>`]|\$\(|\n/;

/** The rewritten command, or null when this one should run as-is. */
export function rewrite(cmd) {
  if (typeof cmd !== 'string') return null;
  const c = cmd.trim();
  if (!c || SHELLY.test(c)) return null;
  const first = words(c)[0];
  if (!first || first === 'terse') return null;
  if (config().exclude.includes(first)) return null;
  if (!route(c)) return null;
  // POSIX quoting everywhere: on Windows the agents' shell tool is Git Bash.
  return `terse run -c ${shq(c)}`;
}

function readStdin() {
  return new Promise((resolve) => {
    let buf = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (d) => { buf += d; });
    process.stdin.on('end', () => resolve(buf));
    process.stdin.on('error', () => resolve(buf));
  });
}

/* Each agent names the shell tool differently; the payload shape is the same
   PreToolUse contract (Claude Code, Codex and Factory Droid share it). */
const SHELL_TOOLS = new Set(['Bash', 'shell', 'Shell', 'Execute', 'exec_command', 'local_shell']);

export async function hook(agent = 'claude') {
  let input;
  try { input = JSON.parse(await readStdin() || '{}'); } catch { return 0; }
  if (process.env.TERSE_RAW === '1') return 0;
  const tool = input.tool_name;
  if (tool && !SHELL_TOOLS.has(tool)) return 0;
  const ti = input.tool_input || {};
  const key = typeof ti.command === 'string' ? 'command' : typeof ti.cmd === 'string' ? 'cmd' : null;
  if (!key) return 0;
  const next = rewrite(ti[key]);
  if (!next) return 0;
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      updatedInput: { ...ti, [key]: next },
    },
  }));
  return 0;
}
