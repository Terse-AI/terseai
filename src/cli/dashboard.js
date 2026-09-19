/**
 * `terse dashboard` — the app's Overview, in your browser, from the CLI.
 *
 * A local page on 127.0.0.1 with: agent spend and burn rate, cache efficiency,
 * cost by day / agent / model / project, what the output filters saved, and a
 * live view of your current room with a composer.
 *
 * Only this machine can reach it, and every API call must carry the random
 * token printed with the URL, so another site open in your browser cannot talk
 * to it (no CORS headers, token checked on every request).
 */
import http from 'node:http';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { readGain } from './store.js';
import { summarize } from './gain.js';
import { collect, report } from './usage.js';
import * as rooms from './rooms.js';
import { PAGE } from './dashboard-page.js';

function openBrowser(url) {
  const cmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'cmd' : 'xdg-open';
  const args = process.platform === 'win32' ? ['/c', 'start', '', url] : [url];
  try { spawn(cmd, args, { stdio: 'ignore', detached: true }).unref(); } catch { /* print the URL instead */ }
}

async function body(req) {
  let s = '';
  for await (const ch of req) { s += ch; if (s.length > 20000) break; }
  try { return JSON.parse(s || '{}'); } catch { return {}; }
}

export async function dashboard(args) {
  const token = crypto.randomBytes(12).toString('base64url');
  const port = Number(args.port || 47830);
  let cache = { t: 0, days: 0, data: null };

  const api = {
    async summary(q) {
      const days = Math.max(1, Math.min(90, Number(q.get('days') || 7)));
      if (!cache.data || cache.days !== days || Date.now() - cache.t > 15000) {
        cache = { t: Date.now(), days, data: report(collect({ days }), { days }) };
      }
      return { usage: cache.data, gain: summarize(readGain(), { days }) };
    },
    async room() {
      const r = rooms.current();
      if (!r) return { room: null, joined: Object.values(rooms.state().rooms).map((x) => ({ code: x.code, name: x.name })) };
      const { room, snap } = await rooms.snapshot(r);
      return { room: { code: room.code, name: room.name, e2e: room.e2e, locked: room.e2e && !room.secret }, you: snap.you, members: snap.members, messages: snap.messages.slice(-60) };
    },
    async say(_q, b) {
      const r = rooms.current();
      if (!r) throw new Error('Not in a room');
      const text = String(b.text || '').trim();
      if (!text) throw new Error('Empty');
      const hits = rooms.scanSecrets(text);
      if (hits.length) throw new Error(`Looks like a secret (${hits.join(', ')}) — not sent`);
      await rooms.say(r, text, { toAgents: !!b.to_agents });
      return { ok: true };
    },
    async join(_q, b) {
      await rooms.join(String(b.code || ''));
      return { ok: true };
    },
    async create(_q, b) {
      const r = await rooms.create({ name: b.name || null });
      return { ok: true, code: r.code };
    },
  };

  const srv = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const send = (code, type, data) => {
      res.writeHead(code, { 'content-type': type, 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer' });
      res.end(data);
    };
    if (url.pathname === '/' && req.method === 'GET') {
      if (url.searchParams.get('t') !== token) return send(403, 'text/plain', 'Open the URL printed by `terse dashboard`.');
      return send(200, 'text/html; charset=utf-8', PAGE);
    }
    const m = url.pathname.match(/^\/api\/(\w+)$/);
    if (!m || !api[m[1]]) return send(404, 'text/plain', 'not found');
    if (req.headers['x-terse-token'] !== token) return send(403, 'application/json', '{"error":"bad token"}');
    if (req.method === 'POST' && !String(req.headers['content-type'] || '').startsWith('application/json')) return send(415, 'application/json', '{"error":"json only"}');
    try {
      const out = await api[m[1]](url.searchParams, req.method === 'POST' ? await body(req) : {});
      send(200, 'application/json', JSON.stringify(out));
    } catch (e) {
      send(400, 'application/json', JSON.stringify({ error: e.message }));
    }
  });

  await new Promise((resolve, reject) => {
    srv.once('error', (e) => (e.code === 'EADDRINUSE' ? srv.listen(0, '127.0.0.1', resolve) : reject(e)));
    srv.listen(port, '127.0.0.1', resolve);
  });
  const url = `http://127.0.0.1:${srv.address().port}/?t=${token}`;
  console.log(`\n  Terse dashboard → ${url}\n  (local only · Ctrl-C to stop)\n`);
  if (!args['no-open']) openBrowser(url);
  return new Promise(() => {});
}
