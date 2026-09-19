/**
 * Output filters — what `terse run` does to a command's output before an agent
 * reads it.
 *
 * Every filter obeys three rules:
 *   1. Errors survive. A line that says something failed is never dropped.
 *   2. Nothing is invented. Filters delete and regroup; they never paraphrase.
 *   3. The full text is one command away. When a run fails or is cut, the raw
 *      output is kept and the filtered one ends with `terse recall <id>`.
 *
 * Filters are pure (text in, text out) so they are tested without a shell.
 */

// eslint-disable-next-line no-control-regex
const ANSI = /\x1b\[[0-9;?]*[A-Za-z]|\x1b\][^\x07]*\x07|\r(?!\n)/g;
export const stripAnsi = (s) => s.replace(ANSI, '');

const ERRORISH = /\b(error|errors|fail|failed|failing|failure|fatal|panic|panicked|exception|traceback|assert|assertion|expected|received|denied|refused|not ok)\b|[✗✕×✘]|^E\s|^\s*at .+:\d+|^\s*(FAIL|FAILED)\b/i;

/** Collapse runs of identical lines into one line with a count. */
export function dedupe(lines) {
  const out = [];
  for (const line of lines) {
    const last = out[out.length - 1];
    if (last && last.text === line) last.n++;
    else out.push({ text: line, n: 1 });
  }
  return out.map((l) => (l.n > 1 ? `${l.text}  (×${l.n})` : l.text));
}

/** Blank-line runs → one blank line; trailing blanks gone. */
function squeeze(lines) {
  const out = [];
  for (const l of lines) {
    if (!l.trim() && (!out.length || !out[out.length - 1].trim())) continue;
    out.push(l);
  }
  while (out.length && !out[out.length - 1].trim()) out.pop();
  return out;
}

const clipLine = (l, n = 400) => (l.length > n ? `${l.slice(0, n)}… (+${l.length - n} chars)` : l);

/** The generic pass every filter ends with. */
export function generic(text) {
  return squeeze(dedupe(stripAnsi(text).split('\n').map((l) => clipLine(l.replace(/\s+$/, ''))))).join('\n');
}

/** Keep head and tail, cut the middle. Returns { text, cut } where cut = lines removed. */
export function cap(text, maxLines = 200) {
  const lines = text.split('\n');
  if (lines.length <= maxLines) return { text, cut: 0 };
  const head = Math.ceil(maxLines * 0.4);
  const tail = maxLines - head;
  // Error lines in the middle are worth more than whatever sits at the edges.
  const middle = lines.slice(head, lines.length - tail);
  const errs = middle.filter((l) => ERRORISH.test(l)).slice(0, 40);
  const cut = middle.length - errs.length;
  return {
    text: [
      ...lines.slice(0, head),
      `… ${cut} lines hidden${errs.length ? `, ${errs.length} error lines kept below` : ''} …`,
      ...errs,
      ...lines.slice(lines.length - tail),
    ].join('\n'),
    cut,
  };
}

// ── git ─────────────────────────────────────────────────────────────────────

function gitStatus(text) {
  const out = [];
  let section = null;
  const groups = {};
  for (const raw of stripAnsi(text).split('\n')) {
    const line = raw.replace(/\s+$/, '');
    if (/^\s*\(use "git /.test(line) || /^\s*\(commit or discard/.test(line)) continue;
    if (/^On branch |^HEAD detached|^Your branch/.test(line)) { out.push(line); continue; }
    if (/^Changes to be committed:/.test(line)) { section = 'staged'; continue; }
    if (/^Changes not staged for commit:/.test(line)) { section = 'modified'; continue; }
    if (/^Untracked files:/.test(line)) { section = 'untracked'; continue; }
    if (/^Unmerged paths:/.test(line)) { section = 'conflict'; continue; }
    if (/^nothing to commit|^no changes added/.test(line)) { out.push(line); continue; }
    if (section && /^\s+\S/.test(line)) {
      (groups[section] ||= []).push(line.trim().replace(/^(modified|new file|deleted|renamed|both modified):\s+/, (m, k) => `${k[0]} `));
      continue;
    }
    if (line.trim()) out.push(line);
  }
  for (const [k, items] of Object.entries(groups)) {
    const shown = items.slice(0, 60);
    out.push(`${k} (${items.length}): ${shown.join(', ')}${items.length > shown.length ? `, … +${items.length - shown.length}` : ''}`);
  }
  return out.join('\n');
}

function gitLog(text) {
  const t = stripAnsi(text);
  if (!/^commit [0-9a-f]{7,}/m.test(t)) return generic(t);   // already --oneline or custom format
  const out = [];
  for (const block of t.split(/^(?=commit [0-9a-f]{7,})/m)) {
    const hash = (block.match(/^commit ([0-9a-f]{7,})/) || [])[1];
    if (!hash) continue;
    const author = ((block.match(/^Author:\s+(.+?)\s*</m) || [])[1] || '').trim();
    const date = ((block.match(/^Date:\s+(.+)$/m) || [])[1] || '').trim().split(' ').slice(1, 5).join(' ');
    const subject = (block.split('\n').find((l, i) => i > 0 && /^ {4}\S/.test(l)) || '').trim();
    out.push(`${hash.slice(0, 8)} ${subject}  — ${author}, ${date}`);
  }
  return out.join('\n');
}

function gitDiff(text) {
  const out = [];
  for (const line of stripAnsi(text).split('\n')) {
    if (/^index [0-9a-f]+\.\.[0-9a-f]+/.test(line)) continue;
    if (/^diff --git a\/(.+) b\//.test(line)) { out.push(`── ${line.replace(/^diff --git a\/(.+) b\/.+$/, '$1')}`); continue; }
    if (/^(---|\+\+\+) (a|b)\//.test(line) || /^(---|\+\+\+) \/dev\/null/.test(line)) continue;
    out.push(clipLine(line));
  }
  return squeeze(out).join('\n');
}

/** push/pull/fetch/clone/commit: progress noise out, the result in. */
function gitQuiet(text) {
  const keep = [];
  for (const raw of stripAnsi(text).split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    if (/^(remote: )?(Enumerating|Counting|Compressing|Writing|Receiving|Resolving|Delta compression|Total \d+|Unpacking|Updating files|Checking out)/.test(line)) continue;
    if (/^remote:\s*$/.test(line)) continue;
    keep.push(line);
  }
  return dedupe(keep).join('\n') || 'ok';
}

// ── tests ───────────────────────────────────────────────────────────────────

const PASSLINE = /^\s*(✓|✔|√|ok \d+|PASS\b|test .+ \.\.\. ok$|.+ PASSED|\[\s*OK\s*\]|--- PASS|=== RUN|\s*✓)/;
const SUMMARY = /(\b\d+\s+(passed|failed|skipped|passing|failing|pending|tests?|suites?)\b)|^(Tests?|Test Suites|Suites|Snapshots|Time|Duration|Ran \d+|FAILED|OK\b|test result:|# (tests|pass|fail|suites|duration))|^(ok|FAIL)\s+\S+\s+[\d.]+s/i;

/** Failures in full, passes collapsed to a count. */
export function tests(text, exit) {
  const lines = stripAnsi(text).split('\n').map((l) => l.replace(/\s+$/, ''));
  let passed = 0;
  const out = [];
  let inFailure = 0;
  for (const line of lines) {
    if (ERRORISH.test(line) && !PASSLINE.test(line)) { out.push(line); inFailure = 12; continue; }
    if (SUMMARY.test(line)) { out.push(line); continue; }
    if (PASSLINE.test(line)) { passed++; inFailure = 0; continue; }
    // Context under a failure: the diff, the stack, the file:line.
    if (inFailure > 0 && line.trim()) { out.push(line); inFailure--; }
  }
  const head = passed ? [`(${passed} passing lines collapsed)`] : [];
  const body = dedupe(squeeze(out));
  if (!body.length) return exit === 0 ? [...head, 'ok'].join('\n') : generic(text);
  return [...head, ...body].join('\n');
}

// ── files / listings ────────────────────────────────────────────────────────

function lsLong(text) {
  const out = [];
  for (const line of stripAnsi(text).split('\n')) {
    if (/^total \d+/.test(line)) continue;
    // drwxr-xr-x  5 user staff  160 Sep 20 10:00 name
    const m = line.match(/^([dl\-cbps])[rwxsStT\-@+.]{9,}\S*\s+\d+\s+\S+\s+\S+\s+(\d+[\d,.]*[KMGB]?)\s+\S+\s+\S+\s+\S+\s+(.+)$/);
    if (!m) { if (line.trim()) out.push(line); continue; }
    const [, kind, size, name] = m;
    if (name === '.' || name === '..') continue;
    out.push(kind === 'd' ? `${name}/` : kind === 'l' ? name : `${name}  ${humanSize(size)}`);
  }
  return out.join('\n');
}
function humanSize(s) {
  const n = Number(String(s).replace(/,/g, ''));
  if (!Number.isFinite(n)) return s;
  if (n < 1024) return `${n}B`;
  if (n < 1048576) return `${(n / 1024).toFixed(1)}K`;
  return `${(n / 1048576).toFixed(1)}M`;
}

/** find / fd / rg --files: one line per directory instead of one per file. */
export function paths(text) {
  const lines = stripAnsi(text).split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length < 30) return lines.join('\n');
  const dirs = new Map();
  for (const l of lines) {
    const i = l.lastIndexOf('/');
    const d = i >= 0 ? l.slice(0, i) || '/' : '.';
    const f = i >= 0 ? l.slice(i + 1) : l;
    if (!dirs.has(d)) dirs.set(d, []);
    dirs.get(d).push(f);
  }
  const out = [`${lines.length} paths in ${dirs.size} directories`];
  for (const [d, fs] of dirs) {
    const shown = fs.slice(0, 25);
    out.push(`${d}/ (${fs.length}): ${shown.join(', ')}${fs.length > shown.length ? `, … +${fs.length - shown.length}` : ''}`);
  }
  return out.join('\n');
}

/** grep / rg: group matches by file, clip long lines. */
export function grep(text) {
  const lines = stripAnsi(text).split('\n').filter(Boolean);
  if (lines.length < 20) return lines.map((l) => clipLine(l, 240)).join('\n');
  const files = new Map();
  const loose = [];
  for (const l of lines) {
    const m = l.match(/^([^:\s][^:]*):(\d+):(.*)$/) || l.match(/^([^:\s][^:]*):(.*)$/);
    if (!m) { loose.push(l); continue; }
    const [file, a, b] = [m[1], m[2], m[3]];
    if (!files.has(file)) files.set(file, []);
    files.get(file).push(b === undefined ? a.trim() : `${a}: ${b.trim()}`);
  }
  const out = [`${lines.length} matches in ${files.size} files`];
  for (const [f, ms] of files) {
    out.push(`${f} (${ms.length})`);
    for (const m of ms.slice(0, 12)) out.push(`  ${clipLine(m, 200)}`);
    if (ms.length > 12) out.push(`  … +${ms.length - 12} more`);
  }
  return [...out, ...loose].join('\n');
}

// ── builds & package managers ───────────────────────────────────────────────

/** Keep warnings, errors and the verdict; drop per-crate/per-package progress. */
function build(text) {
  const out = [];
  for (const raw of stripAnsi(text).split('\n')) {
    const line = raw.replace(/\s+$/, '');
    if (/^\s*(Compiling|Checking|Downloading|Downloaded|Fresh|Blocking|Updating|Locking|Adding|Documenting)\s/.test(line)) continue;
    if (/^\s*(npm (http|timing|sill|verb)|⸨|[⠁-⣿]\s)/.test(line)) continue;
    if (/^\s*(Progress|Resolving|Fetching|Linking|Building fresh)\b.*\d/.test(line)) continue;
    if (/^(added|removed|changed|up to date|audited) .*packages?/.test(line.trim())) { out.push(line.trim()); continue; }
    out.push(line);
  }
  return squeeze(dedupe(out)).join('\n') || 'ok';
}

function dockerPs(text) {
  const lines = stripAnsi(text).split('\n').filter(Boolean);
  if (!/^CONTAINER ID/.test(lines[0] || '')) return generic(text);
  const hdr = lines[0];
  const col = (name) => hdr.indexOf(name);
  const cols = ['IMAGE', 'STATUS', 'NAMES'].map((n) => [n, col(n)]).filter(([, i]) => i >= 0);
  const starts = ['CONTAINER ID', 'IMAGE', 'COMMAND', 'CREATED', 'STATUS', 'PORTS', 'NAMES'].map(col).filter((i) => i >= 0).sort((a, b) => a - b);
  const cut = (row, i) => {
    const next = starts.find((s) => s > i);
    return row.slice(i, next === undefined ? undefined : next).trim();
  };
  return lines.slice(1).map((r) => cols.map(([, i]) => cut(r, i)).join('  ')).join('\n');
}

// ── routing ─────────────────────────────────────────────────────────────────

/** First words of a command, ignoring env assignments and common prefixes. */
export function words(cmd) {
  const w = String(cmd).trim().split(/\s+/);
  while (w.length && /^[A-Z_][A-Z0-9_]*=/.test(w[0])) w.shift();
  while (w.length && ['sudo', 'time', 'npx', 'pnpx', 'bunx', 'exec'].includes(w[0])) w.shift();
  if (['pnpm', 'yarn', 'bun', 'uv'].includes(w[0]) && ['exec', 'dlx', 'run'].includes(w[1]) && w[2] && !['test', 'build', 'lint'].includes(w[2])) w.splice(0, 2);
  return w.map((x) => (x.startsWith('./') ? x : x.replace(/^.*\//, '')));
}

const TEST_RUNNERS = new Set(['jest', 'vitest', 'pytest', 'mocha', 'ava', 'tap', 'playwright', 'rspec', 'phpunit']);

/** Which filter a command gets. Returns a name, or null when it is passed through. */
export function route(cmd) {
  const [a, b, c] = words(cmd);
  if (!a) return null;
  if (a === 'git') {
    if (b === 'status') return 'git-status';
    if (b === 'log') return 'git-log';
    if (b === 'diff' || b === 'show') return 'git-diff';
    if (['push', 'pull', 'fetch', 'clone', 'commit', 'add', 'checkout', 'switch', 'merge', 'rebase', 'stash'].includes(b)) return 'git-quiet';
    return 'generic';
  }
  if (TEST_RUNNERS.has(a)) return 'tests';
  if ((a === 'python' || a === 'python3') && b === '-m' && c === 'pytest') return 'tests';
  if (['npm', 'pnpm', 'yarn', 'bun'].includes(a) && (b === 'test' || b === 't' || (b === 'run' && /test/.test(c || '')))) return 'tests';
  if (['cargo', 'go', 'deno', 'dotnet', 'mvn', 'gradle', './gradlew', 'swift'].includes(a) && b === 'test') return 'tests';
  if (a === 'node' && b === '--test') return 'tests';
  if (a === 'make' && /test|check/.test(b || '')) return 'tests';
  // Only verbs that finish. `npm start`, `cargo run`, `vite` (dev server) never
  // return, and a filter that buffers until exit would hide them forever.
  if (['npm', 'pnpm', 'yarn', 'bun'].includes(a) && ['install', 'i', 'ci', 'add', 'remove', 'rm', 'update', 'up', 'audit', 'outdated', 'ls', 'list', 'build'].includes(b)) return 'build';
  if (['npm', 'pnpm', 'yarn', 'bun'].includes(a) && b === 'run' && /^(build|lint|typecheck|check)/.test(c || '')) return 'build';
  if (['pip', 'pip3', 'uv', 'poetry', 'bundle', 'composer'].includes(a) && ['install', 'sync', 'add', 'update', 'lock', 'list'].includes(b)) return 'build';
  if (['cargo', 'go'].includes(a) && ['build', 'check', 'clippy', 'vet', 'install', 'fmt', 'mod'].includes(b)) return 'build';
  if (['swift', 'dotnet', 'mvn', 'gradle', './gradlew'].includes(a) && ['build', 'compile', 'package', 'assemble'].includes(b)) return 'build';
  if (['tsc', 'eslint', 'ruff', 'mypy', 'xcodebuild'].includes(a) && !/--watch|-w\b/.test(String(cmd))) return 'build';
  if (a === 'make' || a === 'cmake') return 'build';
  if (a === 'ls' && /-\w*l/.test(b || '')) return 'ls';
  if (['find', 'fd'].includes(a) || (a === 'rg' && b === '--files') || (a === 'git' && b === 'ls-files')) return 'paths';
  if (['grep', 'rg', 'ag', 'ack'].includes(a)) return 'grep';
  if (a === 'docker' && (b === 'ps' || (b === 'container' && c === 'ls'))) return 'docker-ps';
  // Never cat/head/tail/sed: an agent that is about to edit a file needs its
  // exact bytes, and "only whitespace changed" is still a changed file.
  if (a === 'docker' && ['logs', 'images', 'compose'].includes(b)) return 'generic';
  if (a === 'kubectl' && ['get', 'logs', 'describe'].includes(b)) return 'generic';
  if (a === 'tree' || (a === 'gh' && ['pr', 'issue', 'run'].includes(b))) return 'generic';
  return null;
}

const FILTERS = {
  'git-status': gitStatus,
  'git-log': gitLog,
  'git-diff': gitDiff,
  'git-quiet': gitQuiet,
  tests,
  build,
  ls: lsLong,
  paths,
  grep,
  'docker-ps': dockerPs,
  generic,
};

/** Filter one command's output. Unknown commands get the generic pass. */
export function filter(cmd, output, exit = 0) {
  const name = route(cmd) || 'generic';
  const fn = FILTERS[name] || generic;
  let text;
  try { text = fn(output, exit); } catch { text = generic(output); }
  // A filter that somehow made things longer is a filter that loses: send the generic pass.
  const g = generic(output);
  if (text.length > g.length) text = g;
  return { filter: name, text };
}
