/**
 * `terse room …` and `terse connect` — rooms from the terminal.
 *
 *   terse room create [--name "api refactor"] [--public --category coding]
 *   terse room join <CODE>            enter as yourself
 *   terse connect <CODE>              enter AND put your agent in the room
 *   terse room say "text"             speak as a person
 *   terse room read [-n 30]
 *   terse room watch                  live tail; also hands the E2E key to newcomers
 *   terse room members | list | use <CODE> | leave | close
 *   terse plaza [--category coding]   public rooms with someone online
 */
import * as rooms from './rooms.js';
import { setConfig } from './store.js';
import { init, AGENTS } from './init.js';
import { c } from './ui.js';

const time = (s) => {
  const d = new Date(String(s).replace(' ', 'T') + (String(s).endsWith('Z') ? '' : 'Z'));
  return Number.isFinite(d.getTime()) ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
};

export function line(m, you) {
  if (!m) return '';
  if (m.role === 'system') return c.dim(`  · ${m.body}`);
  const who = m.member_id === you ? 'you' : (m.name || 'someone');
  const tag = m.role === 'agent' ? c.cyan(` 🤖${m.meta?.agent?.kind ? ` ${m.meta.agent.kind}` : ''}`) : '';
  const body = m.locked ? c.dim('🔒 (sealed — waiting for this device to receive the room key)') : m.body || '';
  const file = m.meta?.file ? c.dim(` 📎 ${m.meta.file.name}`) : '';
  return `  ${c.dim(time(m.created_at))} ${c.bold(who)}${tag}  ${body}${file}`;
}

function need(code) {
  const r = rooms.current(code);
  if (!r) throw new Error(code ? `You are not in room ${code}. Join it: terse room join ${code}` : 'Not in a room. Create one (terse room create) or join one (terse room join <CODE>).');
  return r;
}

function roster(snap) {
  return snap.members.map((m) => {
    const dot = m.status === 'online' ? c.green('●') : m.status === 'away' ? c.yellow('●') : c.dim('○');
    return `  ${dot} ${m.name || 'someone'}${m.member_id === snap.you ? c.dim(' (you)') : ''}${m.agent ? c.cyan(` 🤖 ${m.agent.kind}`) : ''}`;
  }).join('\n');
}

async function watch(r) {
  console.log(c.dim(`  watching ${r.code} — Ctrl-C to stop. Type nothing here; use \`terse room say\` from another shell.\n`));
  let you = null;
  const beat = setInterval(() => rooms.presence(rooms.current(r.id) || r).catch(() => {}), 30000);
  try {
    for (;;) {
      try {
        await rooms.stream(r, (ev, room) => {
          if (ev.type === 'snapshot') {
            you = ev.you;
            console.log(`  ${c.bold(room.name || room.code)} ${c.dim(`· ${room.code}${room.e2e ? ' · 🔒 end-to-end' : ''}`)}`);
            console.log(roster(ev) + '\n');
            for (const m of ev.messages.slice(-15)) console.log(line(m, you));
          } else if (ev.type === 'message') console.log(line(ev.message, you));
          else if (ev.type === 'log') console.log(c.dim(`  ${ev.name || 'someone'} ▸ ${ev.text}`));
          else if (ev.type === 'closed') { console.log(c.yellow('  The owner closed this room.')); process.exit(0); }
        });
      } catch (e) {
        if (e.name === 'AbortError') break;
        console.error(c.dim(`  reconnecting (${e.message})…`));
      }
      await new Promise((res) => setTimeout(res, 2000));
    }
  } finally { clearInterval(beat); }
}

export async function room(args) {
  const [sub, ...rest] = args._;
  const code = args.room || null;
  switch (sub) {
    case 'create': case 'new': {
      if (args.as) setConfig({ name: args.as });
      const r = await rooms.create({
        name: args.name || rest.join(' ') || null,
        e2e: !args['no-e2e'],
        visibility: args.public ? 'public' : 'private',
        category: args.category || null,
      });
      console.log(`
  ${c.bold('Room created')}  ${c.acc(r.code)}${r.e2e ? c.dim('  · 🔒 end-to-end encrypted') : ''}${args.public ? c.dim('  · listed on the plaza') : ''}

  Share the code. Anyone can enter with it:
    ${c.acc(`terse connect ${r.code}`)}     ${c.dim('their agent joins (Claude Code, Codex, Cursor… via MCP)')}
    ${c.acc(`terse room join ${r.code}`)}   ${c.dim('they join as a person')}
    ${c.dim('or in the Terse app → Rooms → Join, or on the phone at terseai.org/m')}

  Then: ${c.acc('terse room watch')} to follow along, ${c.acc('terse room say "…"')} to talk.
`);
      return 0;
    }
    case 'join': {
      const want = rest[0] || args.code;
      if (!want) throw new Error('Which room? terse room join <CODE>');
      if (args.as) setConfig({ name: args.as });
      const r = await rooms.join(want);
      const { snap } = await rooms.snapshot(r);
      console.log(`\n  ${c.bold('Joined')} ${c.acc(r.code)}${r.name ? ` ${r.name}` : ''}${r.e2e ? c.dim(' · 🔒 end-to-end encrypted') : ''}\n\n${roster(snap)}\n`);
      for (const m of snap.messages.slice(-10)) console.log(line(m, snap.you));
      if (r.e2e && !rooms.current(r.id).secret) console.log(c.dim('\n  Waiting for a member to hand this device the room key — it happens automatically while anyone is online. `terse room watch` to wait.'));
      console.log();
      return 0;
    }
    case 'say': case 'send': {
      const r = need(code);
      const text = rest.join(' ').trim();
      if (!text) throw new Error('Nothing to say: terse room say "hello"');
      const hits = rooms.scanSecrets(text);
      if (hits.length && !args.force) throw new Error(`Not sent — looks like a secret (${hits.join(', ')}). Remove it, or pass --force if you are sure.`);
      await rooms.say(r, text, { toAgents: !!args.agents });
      console.log(c.dim(`  sent to ${r.code}`));
      return 0;
    }
    case 'read': case 'log': {
      const r = need(code);
      const { snap } = await rooms.snapshot(r);
      const list = await rooms.messages(rooms.current(r.id), Number(args.n || args.limit || 30));
      for (const m of list) console.log(line(m, snap.you));
      return 0;
    }
    case 'watch': case 'tail':
      await watch(need(code));
      return 0;
    case 'members': case 'who': {
      const r = need(code);
      const { room: fresh, snap } = await rooms.snapshot(r);
      console.log(`\n  ${c.bold(fresh.name || fresh.code)} ${c.dim(`· ${fresh.code}${fresh.e2e ? ' · 🔒' : ''}`)}\n${roster(snap)}\n`);
      return 0;
    }
    case 'list': case 'ls': case undefined: {
      const s = rooms.state();
      const local = Object.values(s.rooms);
      if (!local.length) { console.log('\n  Not in any room. terse room create · terse room join <CODE> · terse plaza\n'); return 0; }
      console.log();
      for (const r of local) console.log(`  ${r.id === s.active ? c.acc('▸') : ' '} ${c.bold(r.code)}  ${r.name || ''}${r.owner ? c.dim(' (owner)') : ''}${r.e2e ? c.dim(' 🔒') : ''}`);
      console.log(c.dim('\n  terse room use <CODE> to switch\n'));
      return 0;
    }
    case 'use': {
      const r = rooms.use(rest[0]);
      console.log(c.dim(`  now in ${r.code}`));
      return 0;
    }
    case 'name': {
      const r = need(code);
      const n = rest.join(' ').trim();
      if (!n) throw new Error('terse room name "Your Name"');
      setConfig({ name: n });
      await rooms.rename(r, n);
      console.log(c.dim(`  you are now "${n}" in every room`));
      return 0;
    }
    case 'leave': {
      const r = need(code || rest[0]);
      await rooms.leave(r);
      console.log(c.dim(`  left ${r.code} — the room stays open; rejoin any time with the code`));
      return 0;
    }
    case 'close': {
      const r = need(code || rest[0]);
      await rooms.close(r);
      console.log(c.dim(`  closed ${r.code} for everyone`));
      return 0;
    }
    default:
      throw new Error(`Unknown: terse room ${sub}. Try: create, join, say, read, watch, members, list, use, name, leave, close`);
  }
}

/** Enter a room and seat your agent in it — the one-liner a teammate runs. */
export async function connect(args) {
  const code = args._[0] || args.code;
  if (!code) throw new Error('terse connect <CODE>   (get a code from whoever made the room: terse room create)');
  if (args.as) setConfig({ name: args.as });
  const agent = args.agent || 'claude';
  if (!AGENTS[agent]) throw new Error(`Unknown agent ${agent}. Known: ${Object.keys(AGENTS).join(', ')}`);
  const r = await rooms.join(code);
  await rooms.connectAgent(r, { kind: agent === 'claude' ? 'claude-code' : agent }).catch((e) => {
    if (e.status === 403) console.log(c.yellow(`  ! ${e.message} — you are in as a person only.`));
    else throw e;
  });
  // Make sure the agent can reach the room: register the MCP server if it is not there yet.
  if (!args['no-init']) init({ agent, 'no-hook': !!args['no-hook'], _: [] });
  console.log(`
  ${c.bold('Connected')} ${c.acc(r.code)}${r.e2e ? c.dim(' · 🔒 end-to-end encrypted') : ''}

  Open (or restart) ${AGENTS[agent].label} and tell it what to do with the room, e.g.
    ${c.acc('"Check the Terse room and help the other agent review their PR."')}
    ${c.acc('"Tell the room what you changed in auth.ts, then wait for their reply."')}

  It uses the room_send / room_wait / room_read tools. You can follow along with ${c.acc('terse room watch')}.
  Agents pause after 8 messages in a row until a person says something — that is on purpose.
`);
  return 0;
}

export async function plaza(args) {
  const j = await rooms.plaza(args.category);
  if (!j.rooms.length) {
    console.log(`\n  No public rooms with anyone online right now.${args.category ? '' : ` Categories: ${j.categories.join(', ')}`}\n  Make one: ${c.acc('terse room create --public --category coding')}\n`);
    return 0;
  }
  console.log(`\n  ${c.bold('Plaza — public rooms with someone online')}\n`);
  for (const r of j.rooms) {
    console.log(`  ${c.green('●')} ${c.bold(r.name || 'untitled')}  ${c.dim(`${r.category || ''} · ${r.online}/${r.members} online${r.agents ? ` · ${r.agents} agents` : ''}`)}${r.code ? `  ${c.acc(r.code)}` : c.dim(`  terse knock ${r.id.slice(0, 8)}`)}`);
  }
  console.log(c.dim('\n  terse knock <id> asks the owner to let you in (from the app, the phone or the CLI).\n'));
  return 0;
}

export async function knock(args) {
  const want = String(args._[0] || '');
  if (!want) throw new Error('terse knock <room id>   (ids are listed by terse plaza)');
  let id = want;
  if (want.length < 36) {
    const hit = (await rooms.plaza()).rooms.find((r) => r.id.startsWith(want));
    if (!hit) throw new Error(`No public room starting with ${want} is online right now.`);
    id = hit.id;
  }
  process.stdout.write(c.dim('  knocked — waiting for the owner'));
  const r = await rooms.knock(id, { onWait: () => process.stdout.write(c.dim('.')) });
  console.log(`\n\n  ${c.bold('Let in')} ${c.acc(r.code)} ${r.name || ''} — ${c.acc('terse room watch')} to follow along.\n`);
  return 0;
}
