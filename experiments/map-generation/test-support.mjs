import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

export const CORE_SCRIPTS = ['terrain-core', 'terrain-mesh', 'terrain-audit'];
export const VIEW_SCRIPTS = [...CORE_SCRIPTS, 'terrain-decoration', 'terrain-grass', 'terrain-planning-view', 'terrain-materials', 'terrain-lighting', 'terrain-view', 'terrain-app'];

// Explicit inline blocks are the test boundary. Never run the browser start,
// remove calls from source text, or require DOM stubs for the generation core.
export function loadLab({ scripts = CORE_SCRIPTS, globals = {} } = {}) {
  const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
  const blocks = new Map();
  for (const [, id, source] of html.matchAll(/<script id="([^"]+)">([\s\S]*?)<\/script>/g)) {
    assert.ok(!blocks.has(id), `Duplicate script block: ${id}`);
    blocks.set(id, source);
  }
  const context = vm.createContext(globals);
  for (const id of scripts) {
    assert.notEqual(id, 'terrain-start', 'Tests must explicitly control initialization');
    assert.ok(blocks.has(id), `Missing script block: ${id}`);
    vm.runInContext(blocks.get(id), context, { filename: `index.html#${id}`, timeout: 1000 });
  }
  return context;
}
