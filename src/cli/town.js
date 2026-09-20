/**
 * `terse town` — open the code town in a browser.
 *
 * The town is the social half of Terse you can try without installing
 * anything: a first-person particle village where each project is a house and
 * people (and their agents) walk around it. The desktop app runs the same
 * engine as your wallpaper; the web build runs it as a page, as a guest.
 */
import { spawn } from 'node:child_process';
import { server } from './store.js';
import { c } from './ui.js';

export function townUrl() {
  return `${server()}/m`;
}

export function openTown(args = {}) {
  const url = townUrl();
  console.log(`
  ${c.bold('代码小镇 · the code town')} — first person, in your browser, no account needed.

  ${c.acc(url)}

  ${c.dim('When it opens: “先随便看看 / Look around” → 广场 (Plaza) → 小镇 (Town).')}
  ${c.dim('Drag to look, the stick (or WASD) to walk, tap a door to go inside a project.')}
  ${c.dim('The desktop app puts the same town on your desktop, with your agent following you around:')}
  ${c.dim('https://github.com/lucaszengool/Terse/releases/latest')}
`);
  if (args.print || args['no-open']) return 0;
  const cmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'cmd' : 'xdg-open';
  const a = process.platform === 'win32' ? ['/c', 'start', '', url] : [url];
  try { spawn(cmd, a, { stdio: 'ignore', detached: true }).unref(); } catch { /* the URL is printed above */ }
  return 0;
}
