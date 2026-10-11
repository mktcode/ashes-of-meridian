const test = require('node:test');
const assert = require('node:assert/strict');
const { mkdirSync, mkdtempSync, writeFileSync, rmSync } = require('node:fs');
const { join } = require('node:path');

const checker = import('../scripts/check-doc-links.mjs');

test('local Markdown targets include images and references but exclude code, comments and remote URLs', async () => {
  const { localTargets } = await checker;
  assert.deepEqual(localTargets([
    '[file](docs/a.md#section)', '![image](assets/a.webp)',
    '[query](index.html?mode=1#top)', '[space](<docs/a%20b.md> "title")',
    '[ref]: docs/reference.md "title"', '[root](/README.md)',
    '[web](https://example.com/a)', '[mail](mailto:a@example.com)',
    '[cdn](//example.com/a)', '[anchor](#top)',
    '`[inline](missing.md)`', '<!-- [comment](missing.md) -->',
    '```md', '[example](missing.md)', '```',
    '~~~md', '[example](missing.md)', '~~~'
  ].join('\n')), ['docs/a.md', 'assets/a.webp', 'index.html', 'docs/a b.md', '/README.md', 'docs/reference.md']);
});

test('link checker resolves from each document and rejects missing or outside targets', async t => {
  const { checkDocLinks } = await checker;
  const scratch = join(__dirname, '../.tmp/doc-links');
  mkdirSync(scratch, { recursive: true });
  const root = mkdtempSync(join(scratch, 'fixture-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, 'docs/nested'), { recursive: true });
  writeFileSync(join(root, 'README.md'), '[docs](docs/)');
  writeFileSync(join(root, 'AGENTS.md'), '[readme](/README.md)');
  writeFileSync(join(root, 'docs/nested/a.md'), '[readme](../../README.md#not-validated)');
  assert.deepEqual(checkDocLinks(root), { files: 3, errors: [] });
  writeFileSync(join(root, 'docs/nested/a.md'), '[missing](missing.md)\n[outside](../../../outside.md)');
  assert.deepEqual(checkDocLinks(root).errors, [
    'docs/nested/a.md: missing target: missing.md',
    'docs/nested/a.md: target outside repository: ../../../outside.md'
  ]);
  writeFileSync(join(root, 'docs/nested/a.md'), '[bad](bad%ZZ.md)');
  assert.match(checkDocLinks(root).errors[0], /URI malformed/);
});
