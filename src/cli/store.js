/**
 * Everything the CLI keeps on disk lives under one folder:
 *
 *   ~/.terse/cli/             (override with TERSE_HOME)
 *     config.json             exclude list, server URL, your display name
 *     identity.json           random install secret — who you are to the Rooms relay
 *     keypair.json            ECDH P-256 pair for end-to-end encrypted rooms (0600)
 *     rooms.json              rooms you are in: code, member key, room secret (0600)
 *     gain.jsonl              one line per `terse run` — what the savings dashboard reads
 *     recall/<id>.txt         full, unfiltered output of runs that failed or were cut
 *
 * The desktop app keeps its own state beside this in ~/.terse; the CLI never
 * writes the app's files.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

export const HOME = process.env.TERSE_HOME || path.join(os.homedir(), '.terse', 'cli');
export const p = (...parts) => path.join(HOME, ...parts);

export function ensureHome() {
  fs.mkdirSync(HOME, { recursive: true, mode: 0o700 });
}

export function readJSON(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}

/** Atomic write: a crash mid-write must never leave a half-written rooms.json. */
export function writeJSON(file, value, mode = 0o600) {
  ensureHome();
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2) + '\n', { mode });
  fs.renameSync(tmp, file);
}

const DEFAULTS = {
  server: 'https://www.terseai.org',
  exclude: [],          // command names the hook must never rewrite, e.g. ["curl"]
  name: null,           // your name in rooms
  maxLines: 200,        // longest filtered output before the middle is cut
};

export function config() {
  return { ...DEFAULTS, ...readJSON(p('config.json'), {}) };
}
export function setConfig(patch) {
  const next = { ...readJSON(p('config.json'), {}), ...patch };
  writeJSON(p('config.json'), next, 0o644);
  return { ...DEFAULTS, ...next };
}

export function server() {
  return (process.env.TERSE_SERVER || config().server).replace(/\/+$/, '');
}

/** The install identity. Random, never derived from anything about you. */
export function identity() {
  const file = p('identity.json');
  const got = readJSON(file, null);
  if (got && got.secret) return got.secret;
  const secret = crypto.randomBytes(24).toString('base64url');
  writeJSON(file, { secret, created_at: new Date().toISOString() });
  return secret;
}

export function displayName() {
  return process.env.TERSE_NAME || config().name || os.userInfo().username || 'someone';
}

// ── savings ledger ──────────────────────────────────────────────────────────

export function appendGain(row) {
  ensureHome();
  fs.appendFileSync(p('gain.jsonl'), JSON.stringify(row) + '\n');
}

export function readGain() {
  let txt = '';
  try { txt = fs.readFileSync(p('gain.jsonl'), 'utf8'); } catch { return []; }
  const out = [];
  for (const line of txt.split('\n')) {
    if (!line) continue;
    try { out.push(JSON.parse(line)); } catch { /* a torn last line from a killed run */ }
  }
  return out;
}

// ── recall: the full output behind a filtered one ───────────────────────────

const RECALL_KEEP = 200;

export function saveRecall(text) {
  const dir = p('recall');
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const id = crypto.randomBytes(6).toString('hex');
  fs.writeFileSync(path.join(dir, `${id}.txt`), text, { mode: 0o600 });
  // Keep the newest few hundred; recall is for "what did that just say", not an archive.
  try {
    const files = fs.readdirSync(dir)
      .map((f) => ({ f, t: fs.statSync(path.join(dir, f)).mtimeMs }))
      .sort((a, b) => b.t - a.t);
    for (const { f } of files.slice(RECALL_KEEP)) fs.rmSync(path.join(dir, f), { force: true });
  } catch { /* pruning is best effort */ }
  return id;
}

export function loadRecall(id) {
  if (!/^[0-9a-f]{12}$/.test(id || '')) return null;
  try { return fs.readFileSync(p('recall', `${id}.txt`), 'utf8'); } catch { return null; }
}
