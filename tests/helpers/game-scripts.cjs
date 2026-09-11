const { readFileSync, realpathSync } = require('node:fs');
const { join, relative, isAbsolute, sep } = require('node:path');
const vm = require('node:vm');

const projectRoot = join(__dirname, '../..');
const SIMULATION_SCRIPTS = Object.freeze([
  'simulation-game',
  'simulation-movement',
  'simulation-economy',
  'simulation-combat',
  'simulation-runtime'
]);
const UI_SCRIPTS = Object.freeze(['ui-core', 'ui-screens', 'ui-actions', 'ui-input', 'ui-presentation']);

// Deliberately not a general HTML parser. Only the project's named classic
// scripts with quoted attributes and synchronous document order are supported.
function attributesOf(text) {
  const attributes = new Map();
  while (text.trim()) {
    const match = /^\s+([a-z][a-z0-9-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'))?/i.exec(text);
    if (!match) throw new Error('Invalid script attributes: expected quoted values');
    const name = match[1].toLowerCase();
    if (attributes.has(name)) throw new Error(`Duplicate script attribute: ${name}`);
    if (!['data-meridian-script', 'src'].includes(name)) {
      throw new Error(`Unsupported script attribute: ${name}; expected synchronous classic script`);
    }
    attributes.set(name, match[2] ?? match[3]);
    text = text.slice(match[0].length);
  }
  return attributes;
}

function readScripts(html, { rootDir = projectRoot } = {}) {
  if (html === undefined) html = readFileSync(join(rootDir, 'index.html'), 'utf8');
  if (/<base\b/i.test(html)) throw new Error('Unsupported base element: script paths are relative to index.html');
  const scripts = [], names = new Set();
  for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)) {
    const attributes = attributesOf(match[1]);
    const name = attributes.get('data-meridian-script');
    if (!name || !/^[a-z][a-z0-9-]*$/.test(name)) throw new Error('Script is missing a valid data-meridian-script name');
    if (names.has(name)) throw new Error(`Duplicate script: ${name}`);
    let source = match[2], filename = `index.html#${name}`;
    if (attributes.has('src')) {
      const src = attributes.get('src');
      // No URLs, traversal, encoding, query strings or absolute paths. This is
      // a local source loader, never a network fetcher or browser-policy shim.
      if (!src || !/^(?:\.\/)?(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]+\.js$/.test(src)) {
        throw new Error(`Invalid local script path for ${name}: ${src}`);
      }
      if (source.trim()) throw new Error(`External script must not contain inline code: ${name}`);
      const root = realpathSync(rootDir);
      let file;
      try { file = realpathSync(join(root, src)); }
      catch (error) { throw new Error(`Cannot read script ${name} (${src}): ${error.message}`, { cause: error }); }
      const path = relative(root, file);
      if (path === '..' || path.startsWith(`..${sep}`) || isAbsolute(path)) {
        throw new Error(`Script path escapes source root: ${name}`);
      }
      source = readFileSync(file, 'utf8');
      filename = src.replace(/^\.\//, '');
    }
    names.add(name);
    scripts.push({ name, source, filename });
  }
  if (!scripts.length) throw new Error('No scripts found');
  return scripts;
}

function loadScripts(names, { scripts = readScripts(), globals = {} } = {}) {
  const requested = new Set(names);
  for (const name of requested) {
    if (!scripts.some(script => script.name === name)) throw new Error(`Missing script: ${name}`);
  }
  const context = vm.createContext({ ...globals });
  // Match the browser, not request order. Dependencies remain explicit at call
  // sites; reading a script never executes it and the app is not auto-loaded.
  for (const script of scripts) {
    if (requested.has(script.name)) vm.runInContext(script.source, context, { filename: script.filename });
  }
  return context;
}

module.exports = { SIMULATION_SCRIPTS, UI_SCRIPTS, readScripts, loadScripts };
