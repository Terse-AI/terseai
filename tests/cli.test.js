/**
 * The `terse` CLI: filters, the hook's rewrite rule, room crypto and the MCP
 * handshake. Nothing here touches the network or your real home directory.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

process.env.TERSE_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'terse-test-'));

const { filter, route, tests: testFilter, cap } = await import('../src/cli/filters.js');
const { rewrite } = await import('../src/cli/hook.js');
const { seal, unseal, keyIdOf, scanSecrets } = await import('../src/cli/rooms.js');
const { parseArgs } = await import('../src/cli/index.js');
const { costOf } = await import('../src/cli/usage.js');

const BIN = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'bin', 'terse.js');

test('git log collapses to one line per commit', () => {
  const raw = Array.from({ length: 5 }, (_, i) =>
    `commit ${'abcdef0123456789'.slice(0, 8)}${i}${'0'.repeat(31)}\nAuthor: Ada <ada@example.com>\nDate:   Mon Sep 1 10:00:00 2026 +0000\n\n    fix: thing ${i}\n\n    longer body that nobody needs\n`).join('\n');
  const out = filter('git log', raw).text;
  assert.equal(out.split('\n').length, 5);
  assert.match(out, /fix: thing 3/);
  assert.ok(out.length < raw.length / 2);
});

test('test runners keep failures and collapse passes', () => {
  const raw = [...Array.from({ length: 40 }, (_, i) => `  ✓ passes case ${i}`),
    '  ✗ rejects a bad token', '    Expected: 401', '    Received: 200', '    at auth.test.js:42:7',
    'Tests: 1 failed, 40 passed, 41 total'].join('\n');
  const out = testFilter(raw, 1);
  assert.match(out, /rejects a bad token/);
  assert.match(out, /Received: 200/);
  assert.match(out, /1 failed, 40 passed/);
  assert.doesNotMatch(out, /passes case 7/);
});

test('cap keeps error lines from the cut middle', () => {
  const lines = Array.from({ length: 500 }, (_, i) => (i === 250 ? 'fatal: the one line that matters' : `line ${i}`));
  const { text, cut } = cap(lines.join('\n'), 100);
  assert.ok(cut > 0);
  assert.match(text, /the one line that matters/);
});

test('never filters commands whose exact bytes matter or that never exit', () => {
  for (const c of ['cat src/index.js', 'head -n 5 x', 'npm start', 'npm run dev', 'cargo run', 'vite', 'tsc --watch']) {
    assert.equal(route(c), null, c);
  }
  for (const c of ['git status', 'npm test', 'pytest -x', 'cargo build', 'rg foo']) assert.ok(route(c), c);
});

test('the hook rewrites plain commands and leaves shell plumbing alone', () => {
  assert.equal(rewrite('git status'), "terse run -c 'git status'");
  assert.equal(rewrite("git commit -m 'it''s'"), `terse run -c 'git commit -m '\\''it'\\'''\\''s'\\'''`);
  for (const c of ['git status | head', 'npm test && echo ok', 'ls > out.txt', 'echo $(date)', 'terse gain', 'cat x']) {
    assert.equal(rewrite(c), null, c);
  }
});

test('room messages seal with the app\'s scheme and only open in the same room', async () => {
  const key = Buffer.alloc(32, 7).toString('base64url');
  const sealed = await seal('room-a', key, 'hello 👋');
  assert.match(sealed, /^e1:/);
  assert.equal(await unseal('room-a', key, sealed), 'hello 👋');
  assert.equal(await unseal('room-b', key, sealed), null, 'room id is bound as associated data');
  assert.equal(await unseal('room-a', null, sealed), null);
  assert.equal(await unseal('room-a', key, 'plain'), 'plain');
  assert.equal((await keyIdOf(key)).length, 16);
});

test('secret scan catches real key shapes, not ordinary talk about tokens', () => {
  assert.ok(scanSecrets('use sk-ant-api03-abcdefghijklmnopqrstuvwx').length);
  assert.ok(scanSecrets('api_key = "q8Zr2VxT0pLmN4kB7wYs1dFh"').length);
  assert.equal(scanSecrets('we cut 40% of tokens; the token budget is 8000').length, 0);
});

test('costs follow the model family', () => {
  const u = { input: 1e6, output: 0, cacheWrite: 0, cacheRead: 0 };
  assert.equal(costOf(u, 'claude-opus-5'), 5);
  assert.equal(costOf(u, 'claude-sonnet-5'), 2);
  assert.equal(costOf(u, 'claude-opus-4-1-20250805'), 15);
});

test('argument parsing', () => {
  const a = parseArgs(['join', 'K7M2QXP', '--as', 'Ada', '-n', '20', '--json'], { boolean: ['json'] });
  assert.deepEqual(a._, ['join', 'K7M2QXP']);
  assert.equal(a.as, 'Ada');
  assert.equal(a.n, '20');
  assert.equal(a.json, true);
});

test('the MCP server answers initialize and lists the room tools', () => {
  const input = [
    { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18' } },
    { jsonrpc: '2.0', method: 'notifications/initialized' },
    { jsonrpc: '2.0', id: 2, method: 'tools/list' },
    { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'room_read', arguments: {} } },
  ].map((m) => JSON.stringify(m)).join('\n') + '\n';
  const r = spawnSync(process.execPath, [BIN, 'mcp'], { input, encoding: 'utf8', env: process.env, timeout: 15000 });
  const out = r.stdout.trim().split('\n').map((l) => JSON.parse(l));
  assert.equal(out[0].result.serverInfo.name, 'terse');
  const names = out[1].result.tools.map((t) => t.name);
  for (const n of ['room_join', 'room_send', 'room_read', 'room_wait', 'terse_gain']) assert.ok(names.includes(n), n);
  assert.equal(out[2].result.isError, true, 'no room yet → a tool error the agent can act on');
  assert.match(out[2].result.content[0].text, /room_join/);
});

test('terse run keeps the exit code and records the saving', () => {
  const r = spawnSync(process.execPath, [BIN, 'run', '-c', 'git --version'], { encoding: 'utf8', env: process.env });
  assert.equal(r.status, 0);
  const f = spawnSync(process.execPath, [BIN, 'run', '-c', 'git definitely-not-a-command'], { encoding: 'utf8', env: process.env });
  assert.notEqual(f.status, 0);
});
