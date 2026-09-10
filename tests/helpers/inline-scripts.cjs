const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');

// Deliberately limited to this project's named, classic inline scripts, not a
// general HTML parser. Fail loudly when the packaging contract changes.
function readInlineScripts(html = readFileSync(join(__dirname, '../../index.html'), 'utf8')) {
  const scripts = [];
  const names = new Set();
  for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)) {
    const [, attributes, source] = match;
    const name = /\bdata-meridian-script\s*=\s*(["'])([a-z][a-z0-9-]*)\1/i.exec(attributes)?.[2];
    if (!name) throw new Error('Inline script is missing a valid data-meridian-script name');
    if (names.has(name)) throw new Error(`Duplicate inline script: ${name}`);
    if (/\s(?:src|type)\s*=/i.test(attributes)) {
      throw new Error(`Expected a classic inline script without src/type: ${name}`);
    }
    names.add(name);
    scripts.push({ name, source, filename: `index.html#${name}` });
  }
  if (!scripts.length) throw new Error('No inline scripts found');
  return scripts;
}

function loadScripts(names, { scripts = readInlineScripts(), globals = {} } = {}) {
  const requested = new Set(names);
  for (const name of requested) {
    if (!scripts.some(script => script.name === name)) throw new Error(`Missing inline script: ${name}`);
  }
  const context = vm.createContext({ ...globals });
  // Keep document order, not request order: this must match the browser.
  // Dependencies are explicit at call sites; never evaluate the app by default.
  for (const script of scripts) {
    if (requested.has(script.name)) vm.runInContext(script.source, context, { filename: script.filename });
  }
  return context;
}

module.exports = { readInlineScripts, loadScripts };
