/**
 * Keeps the translated docs from silently rotting.
 *
 * A translation goes stale the quiet way: someone adds a FAQ entry, a table row
 * or a screenshot to the English file and the Chinese one keeps rendering
 * perfectly — just missing a section nobody notices for months. These assert
 * STRUCTURE, not wording, so an edit to either side of a pair fails here until
 * the other side gets the same edit.
 *
 * They also check every relative link, because a translated file sits at the
 * same depth as its source and it is easy to copy a `../` that no longer points
 * anywhere.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** every translated file and the English original it must track */
const PAIRS = [
  ['README.md', 'README.zh-CN.md'],
  ['docs/FAQ.md', 'docs/FAQ.zh-CN.md'],
  ['docs/COMPARISON.md', 'docs/COMPARISON.zh-CN.md'],
];

const read = f => readFileSync(join(ROOT, f), 'utf8');

/** the countable shape of a document — everything except the prose itself */
function shape(src) {
  return {
    headings: (src.match(/^#{2,3} /gm) || []).length,
    tableRows: (src.match(/^\|/gm) || []).length,
    codeFences: (src.match(/^```/gm) || []).length,
    details: (src.match(/<details>/g) || []).length,
    images: (src.match(/<img /g) || []).length,
  };
}

for (const [en, zh] of PAIRS) {
  test(`${zh} mirrors the structure of ${en}`, () => {
    const a = shape(read(en));
    const b = shape(read(zh));
    for (const key of Object.keys(a)) {
      assert.equal(
        b[key], a[key],
        `${zh} has ${b[key]} ${key}, ${en} has ${a[key]} — one was edited without the other`,
      );
    }
  });

  test(`${en} and ${zh} link to each other`, () => {
    // The switch is the only way a reader changes language: GitHub does no
    // content negotiation for markdown and strips any script that could.
    const bare = f => f.replace(/^docs\//, '');
    assert.match(read(en), new RegExp(`href="${bare(zh)}"`), `${en} has no link to ${zh}`);
    assert.match(read(zh), new RegExp(`href="${bare(en)}"`), `${zh} has no link to ${en}`);
  });
}

for (const file of PAIRS.flat()) {
  test(`${file} has no broken relative links`, () => {
    const src = read(file);
    const base = dirname(join(ROOT, file));
    const targets = new Set([
      ...(src.match(/\]\(([^)#:][^)#]*)\)/g) || []).map(m => m.slice(2, -1)),
      ...(src.match(/href="([^"#:][^"#]*)"/g) || []).map(m => m.slice(6, -1)),
      ...(src.match(/<img src="([^"]+)"/g) || []).map(m => m.slice(10, -1)),
    ]);
    const broken = [...targets]
      .filter(t => !/^(https?:|mailto:)/.test(t))
      .filter(t => !existsSync(normalize(join(base, t))));
    assert.deepEqual(broken, [], `${file} points at files that do not exist`);
  });
}

test('in-page links in the Chinese README resolve to a real anchor', () => {
  // Chinese headings do not slugify to the English anchors the nav uses, so the
  // translated file carries explicit <a id="..."> targets. If one is renamed
  // away the link silently scrolls nowhere.
  const src = read('README.zh-CN.md');
  const ids = new Set([...src.matchAll(/<a id="([^"]+)"/g)].map(m => m[1]));
  const links = [...src.matchAll(/\]\(#([^)]+)\)/g)].map(m => m[1]);
  assert.ok(links.length > 0, 'expected the nav to link within the page');
  assert.deepEqual(links.filter(l => !ids.has(l)), [], 'anchor targets missing');
});
