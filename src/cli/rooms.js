/**
 * Terse Rooms client — the same rooms the Terse app and phone use.
 *
 * A room is a place people and their agents talk. You enter with a 7-letter
 * code; the code IS the credential, so no account and no friendship is needed.
 * The relay (terseai.org) carries messages and enforces the loop breaker: after
 * 8 agent messages in a row with no person speaking (4 in public rooms), agent
 * posts are refused until a human says anything.
 *
 * Private rooms are end-to-end encrypted by default, with the exact scheme the
 * app uses, so a CLI user and an app user can sit in one encrypted room:
 *   - messages are "e1:" + base64url(iv | AES-256-GCM(text)), room id as AAD
 *   - each device has an ECDH P-256 pair; a member who holds the room key seals
 *     it to a newcomer's public key (ECDH → HKDF-SHA256, salt = room id,
 *     info = "terse-room-key-v1") and the relay only ever sees that blob.
 */
import { webcrypto as wc } from 'node:crypto';
import { p, readJSON, writeJSON, server, identity, displayName } from './store.js';

const subtle = wc.subtle;
const ECDH = { name: 'ECDH', namedCurve: 'P-256' };
const te = (s) => new TextEncoder().encode(s);
const b64u = (bytes) => Buffer.from(bytes).toString('base64url');
const unb64u = (s) => new Uint8Array(Buffer.from(String(s), 'base64url'));
const cat = (a, b) => { const o = new Uint8Array(a.length + b.length); o.set(a, 0); o.set(b, a.length); return o; };

// ── local state ─────────────────────────────────────────────────────────────

const ROOMS = () => p('rooms.json');
export function state() { return readJSON(ROOMS(), { active: null, rooms: {} }); }
function save(s) { writeJSON(ROOMS(), s); }

/** The room a command acts on: --room CODE, or the one you last entered. */
export function current(codeOrId) {
  const s = state();
  const want = codeOrId ? String(codeOrId).toUpperCase() : s.active;
  const r = Object.values(s.rooms).find((x) => x.id === want || x.code === want || x.id === codeOrId);
  return r || null;
}
function remember(room, patch = {}) {
  const s = state();
  const old = s.rooms[room.id] || {};
  const next = { ...old, ...room, ...patch };
  /* Several processes share this file (the MCP server, `room watch`, the
     dashboard). One that read the record before another saved the room key
     must not write it back without the key — a lost key cannot be recovered.
     Only a room that actually re-keyed drops it. */
  if (!next.secret && old.secret && !next.dropSecret) next.secret = old.secret;
  delete next.dropSecret;
  s.rooms[room.id] = next;
  s.active = room.id;
  save(s);
  return next;
}
function forget(id) {
  const s = state();
  delete s.rooms[id];
  if (s.active === id) s.active = Object.keys(s.rooms)[0] || null;
  save(s);
}
export function use(codeOrId) {
  const r = current(codeOrId);
  if (!r) throw new Error(`Not in a room called ${codeOrId}. Join it first: terse room join <CODE>`);
  const s = state();
  s.active = r.id;
  save(s);
  return r;
}

// ── HTTP ────────────────────────────────────────────────────────────────────

const BASE = () => `${server()}/api/cloud/rooms`;

export async function call(pathname, { method = 'GET', body, key } = {}) {
  const headers = { 'x-terse-identity': identity(), accept: 'application/json' };
  if (key) headers['x-terse-room-key'] = key;
  if (body !== undefined) headers['content-type'] = 'application/json';
  let res;
  try {
    res = await fetch(BASE() + pathname, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch (e) {
    throw new Error(`Could not reach ${server()} (${e.cause?.code || e.message})`);
  }
  let j = {};
  try { j = await res.json(); } catch { /* empty body */ }
  if (!res.ok) {
    const err = new Error(j.error || `HTTP ${res.status}`);
    err.status = res.status;
    err.body = j;
    throw err;
  }
  return j;
}
const roomCall = (r, sub, opts = {}) => call(`/${r.id}${sub}`, { ...opts, key: r.key });

// ── crypto ──────────────────────────────────────────────────────────────────

async function keypair() {
  const file = p('keypair.json');
  const stored = readJSON(file, null);
  if (stored && stored.pub && stored.priv) {
    return { pub: stored.pub, priv: await subtle.importKey('jwk', stored.priv, ECDH, false, ['deriveBits']) };
  }
  const pair = await subtle.generateKey(ECDH, true, ['deriveBits']);
  const [jwk, raw] = await Promise.all([subtle.exportKey('jwk', pair.privateKey), subtle.exportKey('raw', pair.publicKey)]);
  const rec = { priv: jwk, pub: b64u(new Uint8Array(raw)) };
  writeJSON(file, rec);
  return { pub: rec.pub, priv: pair.privateKey };
}
export async function keyIdOf(k) {
  return b64u(new Uint8Array(await subtle.digest('SHA-256', unb64u(k)))).slice(0, 16);
}
async function aes(k) { return subtle.importKey('raw', unb64u(k), 'AES-GCM', false, ['encrypt', 'decrypt']); }

export async function seal(roomId, secret, text) {
  const iv = wc.getRandomValues(new Uint8Array(12));
  const ct = await subtle.encrypt({ name: 'AES-GCM', iv, additionalData: te(roomId) }, await aes(secret), te(String(text)));
  return `e1:${b64u(cat(iv, new Uint8Array(ct)))}`;
}
/** Plaintext; the input unchanged when it was never sealed; null when this device cannot open it. */
export async function unseal(roomId, secret, s) {
  if (typeof s !== 'string' || !s.startsWith('e1:')) return s;
  if (!secret) return null;
  try {
    const b = unb64u(s.slice(3));
    const pt = await subtle.decrypt({ name: 'AES-GCM', iv: b.slice(0, 12), additionalData: te(roomId) }, await aes(secret), b.slice(12));
    return new TextDecoder().decode(pt);
  } catch { return null; }
}
async function pairKey(roomId, theirPub) {
  const kp = await keypair();
  const pub = await subtle.importKey('raw', unb64u(theirPub), ECDH, false, []);
  const bits = await subtle.deriveBits({ name: 'ECDH', public: pub }, kp.priv, 256);
  const hk = await subtle.importKey('raw', bits, 'HKDF', false, ['deriveKey']);
  return subtle.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt: te(roomId), info: te('terse-room-key-v1') },
    hk, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
async function wrapFor(roomId, secret, theirPub) {
  const wk = await pairKey(roomId, theirPub);
  const iv = wc.getRandomValues(new Uint8Array(12));
  const ct = await subtle.encrypt({ name: 'AES-GCM', iv }, wk, unb64u(secret));
  return b64u(cat(iv, new Uint8Array(ct)));
}
async function unwrapFrom(roomId, fromPub, blob) {
  const wk = await pairKey(roomId, fromPub);
  const b = unb64u(blob);
  return b64u(new Uint8Array(await subtle.decrypt({ name: 'AES-GCM', iv: b.slice(0, 12) }, wk, b.slice(12))));
}

/**
 * The key duties, the same ones the app's room window runs: publish this
 * device's public key; make the room key if nobody has; pick up a share
 * addressed to me; hand the key to members who published a key but lack it.
 * Returns the local room record, with `secret` when this device holds the key.
 */
export async function keyDuty(r, snap) {
  const s = snap || await roomCall(r, '');
  const room = s.room;
  const me = (s.members || []).find((m) => m.member_id === s.you);
  const kp = await keypair();
  if (!me || me.pubkey !== kp.pub) await roomCall(r, '/pubkey', { method: 'POST', body: { pubkey: kp.pub } }).catch(() => {});
  let secret = r.secret || (current(r.id) || {}).secret || null;
  let dropSecret = false;
  const patch = { e2e: !!room.e2e, key_id: room.key_id || null, name: room.name || r.name || null };
  if (!room.e2e) return remember({ ...r, ...patch });
  if (secret && room.key_id && (await keyIdOf(secret)) !== room.key_id) { secret = null; dropSecret = true; }   // the room re-keyed

  const keyed = async (k) => {
    try { await roomCall(r, '/keyed', { method: 'POST', body: { key_id: await keyIdOf(k) } }); return true; }
    catch (e) { if (/stale key/.test(e.message)) return false; throw e; }
  };
  if (!secret && !room.key_id) {                        // nobody has made one: make it
    const k = b64u(wc.getRandomValues(new Uint8Array(32)));
    // Saved before the relay hears of it: a key the room adopts but nobody kept is gone for good.
    remember({ ...r, secret: k });
    if (await keyed(k)) secret = k;
    else dropSecret = true;
  } else if (!secret) {                                 // pick up a share addressed to me
    const list = s.keyshares || (await roomCall(r, '/keyshares')).keyshares || [];
    for (const share of list) {
      try {
        const k = await unwrapFrom(room.id, share.from_pub, share.blob);
        if ((await keyIdOf(k)) !== room.key_id) continue;   // not the room's key: refuse it
        secret = k;
        await keyed(k).catch(() => {});
        break;
      } catch { /* sealed for an older key of mine */ }
    }
  } else if (me && !me.keyed) {
    await keyed(secret).catch(() => {});
  }
  if (secret) {                                         // hand it on
    for (const m of s.members || []) {
      if (m.member_id === s.you || !m.pubkey || m.keyed) continue;
      try {
        const blob = await wrapFor(room.id, secret, m.pubkey);
        await roomCall(r, '/keyshares', { method: 'POST', body: { to: m.member_id, from_pub: kp.pub, blob } });
      } catch { /* they'll get it from the next member who looks */ }
    }
  }
  return remember({ ...r, ...patch, secret, dropSecret });
}

async function outgoing(r, text) {
  if (!r.e2e) return text;
  // A share may be waiting for us since we last looked — pick it up before giving up.
  for (let i = 0; i < 4 && !r.secret; i++) {
    if (i) await new Promise((res) => setTimeout(res, 2500));
    r = await keyDuty(r).catch(() => r);
  }
  if (!r.secret) throw new Error("🔒 This room is end-to-end encrypted and this device doesn't hold its key yet. It is handed over automatically when anyone in the room is online — run `terse room watch` for a moment, then try again.");
  return seal(r.id, r.secret, text);
}

/** A message as a person (or agent) should see it. */
export async function open(r, m) {
  if (!m || m.role === 'system') return m;
  const body = await unseal(r.id, r.secret, m.body);
  const out = { ...m, body: body === null ? '' : body };
  if (body === null) out.locked = true;
  if (m.meta && m.meta.file) {
    const name = await unseal(r.id, r.secret, m.meta.file.name);
    out.meta = { ...m.meta, file: { ...m.meta.file, name: name === null ? 'file' : name } };
  }
  return out;
}

// ── lifecycle ───────────────────────────────────────────────────────────────

export async function create({ name, e2e = true, visibility = 'private', category = null } = {}) {
  const j = await call('', {
    method: 'POST',
    body: { name, member_name: displayName(), identity: identity(), e2e: e2e && visibility !== 'public', visibility, category },
  });
  const r = remember({ id: j.room.id, code: j.room.code, key: j.key, name: j.room.name, owner: true, e2e: !!j.room.e2e });
  return keyDuty(r);
}

export async function join(code, { name } = {}) {
  const j = await call('/join', { method: 'POST', body: { code: String(code).trim().toUpperCase(), name: name || displayName(), identity: identity() } });
  const r = remember({ id: j.room.id, code: j.room.code, key: j.key, name: j.room.name, owner: !!j.owner, member_id: j.member_id, e2e: !!j.room.e2e });
  return keyDuty(r);
}

export async function snapshot(r) {
  const s = await roomCall(r, '');
  const fresh = await keyDuty(r, s);
  s.messages = await Promise.all((s.messages || []).map((m) => open(fresh, m)));
  return { room: fresh, snap: s };
}

export async function say(r, text, { toAgents = false } = {}) {
  const body = await outgoing(r, text);
  return roomCall(r, '/messages', { method: 'POST', body: { body, to_agents: toAgents || undefined } });
}

/** Agent speech — only after the agent is connected, and subject to the loop breaker. */
export async function agentSay(r, text, { inReplyTo } = {}) {
  const body = await outgoing(r, text);
  return roomCall(r, '/agent/messages', { method: 'POST', body: { body, in_reply_to: inReplyTo } });
}
export async function connectAgent(r, { kind = 'agent', label = null, on = true } = {}) {
  return roomCall(r, '/agent', { method: 'POST', body: { on, kind, label } });
}

export async function messages(r, limit = 20) {
  const j = await roomCall(r, `/messages?limit=${Math.max(1, Math.min(100, limit))}`);
  return Promise.all((j.messages || []).map((m) => open(r, m)));
}

export const presence = (r, status = 'online') => roomCall(r, '/presence', { method: 'POST', body: { status } });
export const rename = (r, name) => roomCall(r, '/name', { method: 'POST', body: { name } });

export async function leave(r) {
  await roomCall(r, '/leave', { method: 'POST' }).catch((e) => { if (e.status !== 401 && e.status !== 404) throw e; });
  forget(r.id);
}
export async function close(r) {
  await roomCall(r, '/close', { method: 'POST' });
  forget(r.id);
}

export const plaza = (category) => call(`/public${category ? `?category=${encodeURIComponent(category)}` : ''}`);
export const mine = () => call('/mine');

/** Ask to enter a public room; resolves with the room once the owner lets you in. */
export async function knock(roomId, { timeoutMs = 10 * 60000, onWait } = {}) {
  const j = await call(`/${roomId}/knock`, { method: 'POST', body: { name: displayName() } });
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    const k = await call(`/knock/${j.knock.id}`);
    if (k.status === 'approved' && k.key) {
      const r = remember({ id: k.room.id, code: k.room.code, key: k.key, name: k.room.name, owner: false, member_id: k.member_id, e2e: !!k.room.e2e });
      return keyDuty(r);
    }
    if (k.status === 'denied') throw new Error('The owner declined your request.');
    if (onWait) onWait();
    await new Promise((res) => setTimeout(res, 3000));
  }
  throw new Error('Nobody answered. Try again later.');
}

/**
 * Live events (SSE). Calls onEvent for every event with messages already
 * opened; resolves when the stream ends or `signal` aborts. EventSource cannot
 * send headers, so the key rides in the query string like the app's.
 */
export async function stream(r, onEvent, { signal } = {}) {
  const url = `${BASE()}/${r.id}/stream?key=${encodeURIComponent(r.key)}&identity=${encodeURIComponent(identity())}`;
  const res = await fetch(url, { headers: { accept: 'text/event-stream' }, signal });
  if (!res.ok || !res.body) throw new Error(`stream: HTTP ${res.status}`);
  const dec = new TextDecoder();
  let buf = '';
  let room = r;
  for await (const chunk of res.body) {
    buf += dec.decode(chunk, { stream: true });
    let i;
    while ((i = buf.indexOf('\n\n')) >= 0) {
      const frame = buf.slice(0, i);
      buf = buf.slice(i + 2);
      const data = frame.split('\n').filter((l) => l.startsWith('data:')).map((l) => l.slice(5).trim()).join('\n');
      if (!data) continue;
      let ev;
      try { ev = JSON.parse(data); } catch { continue; }
      if (ev.type === 'snapshot' || ev.type === 'roster' || ev.type === 'keyshare' || ev.type === 'room') {
        try { room = await keyDuty(room, ev.type === 'snapshot' ? ev : undefined); } catch { /* retried on the next event */ }
      }
      if (ev.type === 'snapshot') ev.messages = await Promise.all((ev.messages || []).map((m) => open(room, m)));
      if (ev.type === 'message') ev.message = await open(room, ev.message);
      if (ev.type === 'log' && typeof ev.text === 'string') ev.text = (await unseal(room.id, room.secret, ev.text)) ?? '🔒';
      await onEvent(ev, room);
    }
  }
}

// ── safety ──────────────────────────────────────────────────────────────────

/* Only formats with a clear prefix, plus "key/secret/token = <long random>".
   Better to miss an oddly encoded key than to block every message that talks
   about code — an owner who gets false alarms turns the whole thing off. */
const SECRET_RULES = [
  ['AWS access key', /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/],
  ['Stripe key', /\b[rs]k_(?:live|test)_[0-9A-Za-z]{16,}/],
  ['Anthropic key', /\bsk-ant-[A-Za-z0-9_-]{20,}/],
  ['OpenAI key', /\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{32,}/],
  ['GitHub token', /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{30,}|\bgithub_pat_[A-Za-z0-9_]{40,}/],
  ['Slack token', /\bxox[abprs]-[A-Za-z0-9-]{10,}/],
  ['Google API key', /\bAIza[0-9A-Za-z_-]{35}/],
  ['GitLab token', /\bglpat-[A-Za-z0-9_-]{20,}/],
  ['npm token', /\bnpm_[A-Za-z0-9]{36}/],
  ['Terse team token', /\btct_[A-Za-z0-9_-]{16,}/],
  ['private key', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
];
const ASSIGN = /\b(?:api[_-]?key|secret|token|passw(?:or)?d|private[_-]?key|access[_-]?key)\b["']?\s*[:=]\s*["']?([A-Za-z0-9_\-/+=.]{20,})/gi;
function entropy(s) {
  const f = {};
  for (const ch of s) f[ch] = (f[ch] || 0) + 1;
  return Object.values(f).reduce((h, n) => h - (n / s.length) * Math.log2(n / s.length), 0);
}
export function scanSecrets(text) {
  const hits = SECRET_RULES.filter(([, re]) => re.test(text)).map(([n]) => n);
  for (const m of String(text).matchAll(ASSIGN)) {
    const v = m[1];
    if (/\d/.test(v) && /[a-z]/i.test(v) && entropy(v) >= 3.5) { hits.push('key/secret/token assignment'); break; }
  }
  return hits;
}
