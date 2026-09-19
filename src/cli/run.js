/**
 * `terse run` — run a command, hand the agent the filtered output.
 *
 *   terse run git status              manual use: the rest of argv is the command
 *   terse run -c 'git log -n 20'      what the hook writes: one shell string, quoted
 *
 * The exit code is the command's own, so `&&` chains and CI behave the same.
 * TERSE_RAW=1 turns filtering off for one call without uninstalling anything.
 */
import { spawnSync } from 'node:child_process';
import { countTokens } from '../core/tokenizer.js';
import { filter, cap, route, words } from './filters.js';
import { appendGain, saveRecall, config } from './store.js';

/* The same shell the agent would have used: $SHELL (Git Bash sets it on
   Windows, and the hook quotes for it), cmd.exe only when there is none. */
function shell() {
  const sh = process.env.TERSE_SHELL || process.env.SHELL;
  if (sh) return { file: sh, args: (c) => ['-c', c] };
  if (process.platform === 'win32') return { file: process.env.ComSpec || 'cmd.exe', args: (c) => ['/d', '/s', '/c', c] };
  return { file: '/bin/sh', args: (c) => ['-c', c] };
}

export function runCommand(cmd, { raw = process.env.TERSE_RAW === '1' } = {}) {
  const sh = shell();
  const t0 = Date.now();
  const r = spawnSync(sh.file, sh.args(cmd), {
    stdio: ['inherit', 'pipe', 'pipe'],
    maxBuffer: 256 * 1024 * 1024,
    env: { ...process.env, TERSE_WRAPPED: '1' },
    windowsVerbatimArguments: process.platform === 'win32',
  });
  const ms = Date.now() - t0;
  if (r.error) {
    process.stderr.write(`terse: could not run: ${r.error.message}\n`);
    return 127;
  }
  const exit = r.status === null ? 128 + (r.signal === 'SIGINT' ? 2 : 15) : r.status;
  const out = (r.stdout || Buffer.alloc(0)).toString('utf8');
  const err = (r.stderr || Buffer.alloc(0)).toString('utf8');
  const combined = err && out ? `${out}${out.endsWith('\n') ? '' : '\n'}${err}` : out || err;

  if (raw || !route(cmd)) {
    process.stdout.write(combined);
    return exit;
  }

  const f = filter(cmd, combined, exit);
  const capped = cap(f.text, config().maxLines);
  let text = capped.text;
  // Failed, or cut: keep the whole thing one command away.
  if ((exit !== 0 || capped.cut > 0) && combined.length > text.length) {
    text += `\n[full output: terse recall ${saveRecall(combined)}]`;
  }
  const before = countTokens(combined);
  const after = countTokens(text);
  try {
    appendGain({
      t: Date.now(), cmd: words(cmd).slice(0, 2).join(' '), filter: f.filter,
      in: before, out: after, ms, exit, cwd: process.cwd(),
    });
  } catch { /* a read-only home must not break the command */ }
  process.stdout.write(text.endsWith('\n') || !text ? text : `${text}\n`);
  return exit;
}
