/** The dashboard page. One self-contained document: no CDN, no fonts, no trackers. */
export const PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Terse Dashboard</title>
<style>
:root{--bg:#0a0a0a;--panel:#141414;--line:#262626;--fg:#ededed;--dim:#8a8a8a;--acc:#c6d82c;--acc2:#7fb3ff;--bad:#ff6b6b;--ok:#5dd39e;color-scheme:dark}
@media (prefers-color-scheme:light){:root{--bg:#f6f6f3;--panel:#fff;--line:#e4e4de;--fg:#161616;--dim:#6b6b66;--acc:#7c8a00;--acc2:#2f6fd6;--bad:#c62828;--ok:#1b8a5a;color-scheme:light}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);font:14px/1.45 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif}
header{display:flex;align-items:center;gap:12px;padding:18px 24px;border-bottom:1px solid var(--line);flex-wrap:wrap}
header b{font-size:16px;letter-spacing:.02em}
header .dot{width:10px;height:10px;border-radius:50%;background:var(--acc)}
header .sp{flex:1}
.seg{display:inline-flex;border:1px solid var(--line);border-radius:8px;overflow:hidden}
.seg button{background:none;border:0;color:var(--dim);padding:6px 12px;font:inherit;cursor:pointer}
.seg button.on{background:var(--acc);color:#0a0a0a}
main{display:grid;grid-template-columns:minmax(0,2fr) minmax(300px,1fr);gap:16px;padding:16px 24px 40px;max-width:1400px;margin:0 auto}
@media (max-width:900px){main{grid-template-columns:1fr;padding:12px 16px}}
.kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
@media (max-width:640px){.kpis{grid-template-columns:repeat(2,minmax(0,1fr))}}
.card{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:14px 16px;min-width:0}
.kpi .v{font-size:26px;font-weight:650;font-variant-numeric:tabular-nums;margin-top:4px}
.kpi .l{color:var(--dim);font-size:12px;text-transform:uppercase;letter-spacing:.06em}
.kpi .s{color:var(--dim);font-size:12px;margin-top:2px}
h2{font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:var(--dim);margin:0 0 10px;font-weight:600}
.col{display:flex;flex-direction:column;gap:16px;min-width:0}
table{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums}
td,th{padding:6px 4px;border-bottom:1px solid var(--line);text-align:right;white-space:nowrap}
th{color:var(--dim);font-weight:500;font-size:12px}
td:first-child,th:first-child{text-align:left;white-space:normal;word-break:break-all}
.two{display:grid;grid-template-columns:1fr 1fr;gap:16px}
@media (max-width:640px){.two{grid-template-columns:1fr}}
.barrow{display:grid;grid-template-columns:110px 1fr 70px;gap:8px;align-items:center;margin:5px 0;font-size:13px}
.barrow .t{height:8px;background:var(--line);border-radius:4px;overflow:hidden}
.barrow .t i{display:block;height:100%;background:var(--acc)}
.barrow span:last-child{text-align:right;color:var(--dim);font-variant-numeric:tabular-nums}
svg text{fill:var(--dim);font-size:10px}
.room .msgs{height:420px;overflow:auto;display:flex;flex-direction:column;gap:8px;padding-right:4px}
.msg{font-size:13px}
.msg .who{font-weight:600}
.msg .who.agent{color:var(--acc2)}
.msg .at{color:var(--dim);font-size:11px;margin-left:6px}
.msg .b{white-space:pre-wrap;word-break:break-word;margin-top:2px}
.msg.sys{color:var(--dim);font-size:12px;font-style:italic}
.members{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px}
.pill{border:1px solid var(--line);border-radius:999px;padding:2px 10px;font-size:12px}
.pill.on::before{content:"● ";color:var(--ok)}
form{display:flex;gap:8px;margin-top:10px}
input[type=text]{flex:1;min-width:0;background:var(--bg);border:1px solid var(--line);color:var(--fg);border-radius:8px;padding:8px 10px;font:inherit}
button.go{background:var(--acc);color:#0a0a0a;border:0;border-radius:8px;padding:8px 14px;font:inherit;font-weight:600;cursor:pointer}
label.chk{display:flex;gap:6px;align-items:center;color:var(--dim);font-size:12px;margin-top:6px}
.muted{color:var(--dim)}
.err{color:var(--bad);font-size:12px;min-height:16px;margin-top:4px}
.live{display:flex;gap:8px;align-items:center;font-size:13px;padding:4px 0}
.live .sp{flex:1}
.live i{width:8px;height:8px;border-radius:50%;background:var(--ok);flex:none}
.warn{border-color:var(--acc);font-size:13px}
</style>
</head>
<body>
<header>
  <span class="dot"></span><b>Terse</b><span class="muted">local dashboard · nothing leaves this machine except room messages</span>
  <span class="sp"></span>
  <div class="seg" id="days"><button data-d="1">24h</button><button data-d="7" class="on">7d</button><button data-d="30">30d</button></div>
</header>
<main>
  <div class="col">
    <div class="kpis">
      <div class="card kpi"><div class="l">Spent</div><div class="v" id="k-cost">–</div><div class="s" id="k-calls"></div></div>
      <div class="card kpi"><div class="l">Burn rate</div><div class="v" id="k-burn">–</div><div class="s">last hour</div></div>
      <div class="card kpi"><div class="l">Cache hit</div><div class="v" id="k-cache">–</div><div class="s" id="k-cache-s">of prompt tokens</div></div>
      <div class="card kpi"><div class="l">Filtered away</div><div class="v" id="k-saved">–</div><div class="s" id="k-saved-s">tokens of shell output</div></div>
    </div>
    <div class="card" id="warn" hidden></div>
    <div class="card"><h2>Cost by day</h2><div id="daily"></div></div>
    <div class="card" id="livecard" hidden><h2>Live now</h2><div id="live"></div></div>
    <div class="two">
      <div class="card"><h2>By agent</h2><table id="t-agent"></table></div>
      <div class="card"><h2>By model</h2><table id="t-model"></table></div>
    </div>
    <div class="card"><h2>By project</h2><table id="t-project"></table></div>
    <div class="card"><h2>What <code>terse run</code> filtered</h2><div id="gain"></div></div>
  </div>
  <div class="col">
    <div class="card room" id="room"><h2>Room</h2><div id="roombody" class="muted">Loading…</div></div>
  </div>
</main>
<script>
const T = new URLSearchParams(location.search).get('t');
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num = (n) => { const a = Math.abs(n); return a >= 1e9 ? (n/1e9).toFixed(2)+'B' : a >= 1e6 ? (n/1e6).toFixed(2)+'M' : a >= 1e4 ? (n/1e3).toFixed(1)+'K' : Math.round(n).toLocaleString(); };
const money = (x) => x >= 100 ? '$' + x.toFixed(0) : '$' + x.toFixed(2);
const pct = (x) => (x * 100).toFixed(1) + '%';
async function api(path, body) {
  const r = await fetch('/api/' + path, { method: body ? 'POST' : 'GET', headers: { 'x-terse-token': T, ...(body ? { 'content-type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error || r.status);
  return j;
}
let days = 7;
document.querySelectorAll('#days button').forEach((b) => b.onclick = () => {
  days = +b.dataset.d; document.querySelectorAll('#days button').forEach((x) => x.classList.toggle('on', x === b)); load();
});
const cacheHit = (g) => { const d = g.input + g.cacheWrite + g.cacheRead; return d ? g.cacheRead / d : 0; };
function tbl(el, rows) {
  el.innerHTML = '<tr><th></th><th>calls</th><th>cache</th><th>cost</th></tr>' + (rows.length ? rows.map((g) =>
    '<tr><td>' + esc(g.key) + '</td><td>' + num(g.calls) + '</td><td>' + pct(cacheHit(g)) + '</td><td>' + money(g.cost) + '</td></tr>').join('') : '<tr><td class="muted" colspan="4">No activity</td></tr>');
}
function bars(daily) {
  if (!daily.length) return '<div class="muted">No Claude Code or Codex activity in this period.</div>';
  const W = 640, H = 150, pad = 22, bw = (W - pad) / daily.length;
  const max = Math.max(...daily.map((d) => d.cost), 0.01);
  let s = '<svg viewBox="0 0 ' + W + ' ' + (H + 18) + '" width="100%" role="img" aria-label="Cost by day">';
  daily.forEach((d, i) => {
    const h = Math.max(1, (d.cost / max) * (H - 16));
    s += '<rect x="' + (pad + i * bw + bw * .15) + '" y="' + (H - h) + '" width="' + (bw * .7) + '" height="' + h + '" rx="2" fill="var(--acc)"><title>' + d.key + ' · ' + money(d.cost) + ' · cache ' + pct(cacheHit(d)) + '</title></rect>';
    if (daily.length <= 14 || i % Math.ceil(daily.length / 10) === 0) s += '<text x="' + (pad + i * bw + bw / 2) + '" y="' + (H + 13) + '" text-anchor="middle">' + d.key.slice(5) + '</text>';
  });
  s += '<text x="0" y="10">' + money(max) + '</text></svg>';
  return s;
}
async function load() {
  let j;
  try { j = await api('summary?days=' + days); } catch (e) { return; }
  const u = j.usage, g = j.gain;
  $('#k-cost').textContent = money(u.total.cost);
  $('#k-calls').textContent = num(u.total.calls) + ' API calls';
  $('#k-burn').textContent = money(u.burnPerHour) + '/h';
  $('#k-cache').textContent = pct(u.total.cacheHit);
  $('#k-saved').textContent = num(g.saved);
  $('#k-saved-s').textContent = g.runs ? pct(g.pct) + ' of shell output · ' + g.runs + ' runs' : 'run terse init to start';
  $('#daily').innerHTML = bars(u.daily);
  tbl($('#t-agent'), u.byAgent); tbl($('#t-model'), u.byModel); tbl($('#t-project'), u.byProject);
  $('#livecard').hidden = !u.live.length;
  $('#live').innerHTML = u.live.map((l) => '<div class="live"><i></i><b>' + esc(l.agent) + '</b> ' + esc(l.model) + ' <span class="muted">' + esc(l.project) + '</span> <span class="sp"></span>' + money(l.cost) + ' · cache ' + pct(l.cacheHit) + '</div>').join('');
  const w = $('#warn');
  w.hidden = !(u.total.calls > 50 && u.total.cacheHit < 0.5);
  if (!w.hidden) { w.className = 'card warn'; w.textContent = 'Cache hit is ' + pct(u.total.cacheHit) + '. Something changes your prompt prefix between calls — reordered tools, a timestamp in the system prompt, MCP servers toggling. Fixing that usually saves more than any compression.'; }
  const top = g.commands.slice(0, 10), max = Math.max(1, ...top.map((c) => c.in - c.out));
  $('#gain').innerHTML = top.length ? top.map((c) => '<div class="barrow"><span>' + esc(c.cmd) + '</span><span class="t"><i style="width:' + ((c.in - c.out) / max * 100).toFixed(1) + '%"></i></span><span>' + num(c.in - c.out) + ' · ' + pct(c.in ? (c.in - c.out) / c.in : 0) + '</span></div>').join('')
    : '<div class="muted">Nothing yet. <code>terse init</code> installs the hook; then your agent\\'s <code>git status</code>, test runs and builds come back filtered.</div>';
}
let lastIds = '';
async function room() {
  let j;
  try { j = await api('room'); } catch (e) { $('#roombody').innerHTML = '<div class="err">' + esc(e.message) + '</div>'; return; }
  const b = $('#roombody');
  if (!j.room) {
    if (b.dataset.mode === 'none') return;
    b.dataset.mode = 'none';
    b.innerHTML = '<p>Rooms are where you and your teammates\\' agents work together. Create one and share the code, or join with a code.</p>' +
      '<form id="fjoin"><input type="text" id="code" placeholder="Room code" autocomplete="off"><button class="go">Join</button></form>' +
      '<form id="fnew"><input type="text" id="rname" placeholder="New room name (optional)"><button class="go">Create</button></form><div class="err" id="rerr"></div>';
    $('#fjoin').onsubmit = async (e) => { e.preventDefault(); try { await api('join', { code: $('#code').value }); b.dataset.mode = ''; room(); } catch (x) { $('#rerr').textContent = x.message; } };
    $('#fnew').onsubmit = async (e) => { e.preventDefault(); try { await api('create', { name: $('#rname').value }); b.dataset.mode = ''; room(); } catch (x) { $('#rerr').textContent = x.message; } };
    return;
  }
  if (b.dataset.mode !== 'room') {
    b.dataset.mode = 'room';
    b.innerHTML = '<div id="rhead"></div><div class="members" id="members"></div><div class="msgs" id="msgs"></div>' +
      '<form id="fsay"><input type="text" id="say" placeholder="Say something…" autocomplete="off"><button class="go">Send</button></form>' +
      '<label class="chk"><input type="checkbox" id="toag"> address the agents in the room</label><div class="err" id="serr"></div>';
    $('#fsay').onsubmit = async (e) => {
      e.preventDefault(); const v = $('#say').value.trim(); if (!v) return;
      try { await api('say', { text: v, to_agents: $('#toag').checked }); $('#say').value = ''; $('#serr').textContent = ''; room(); } catch (x) { $('#serr').textContent = x.message; }
    };
  }
  $('#rhead').innerHTML = '<b>' + esc(j.room.name || j.room.code) + '</b> <span class="muted">· ' + esc(j.room.code) + (j.room.e2e ? ' · 🔒 end-to-end' : '') + (j.room.locked ? ' · waiting for the key' : '') + '</span>';
  $('#members').innerHTML = j.members.map((m) => '<span class="pill' + (m.status === 'online' ? ' on' : '') + '">' + esc(m.name || 'someone') + (m.member_id === j.you ? ' (you)' : '') + (m.agent ? ' 🤖 ' + esc(m.agent.kind) : '') + '</span>').join('');
  const ids = j.messages.map((m) => m.id).join();
  if (ids === lastIds) return;
  lastIds = ids;
  const box = $('#msgs'); const atEnd = box.scrollHeight - box.scrollTop - box.clientHeight < 40;
  box.innerHTML = j.messages.map((m) => m.role === 'system' ? '<div class="msg sys">' + esc(m.body) + '</div>' :
    '<div class="msg"><span class="who' + (m.role === 'agent' ? ' agent' : '') + '">' + esc(m.member_id === j.you ? 'you' : (m.name || 'someone')) + (m.role === 'agent' ? ' 🤖' : '') + '</span><span class="at">' + esc(String(m.created_at).slice(11, 16)) + '</span><div class="b">' + (m.locked ? '🔒 sealed' : esc(m.body)) + '</div></div>').join('') || '<div class="muted">No messages yet.</div>';
  if (atEnd) box.scrollTop = box.scrollHeight;
}
load(); room();
setInterval(load, 30000); setInterval(room, 4000);
</script>
</body>
</html>`;
