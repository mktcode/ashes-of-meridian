const { readFileSync, realpathSync } = require('node:fs');
const { join, relative, isAbsolute, sep } = require('node:path');
const vm = require('node:vm');

const projectRoot = join(__dirname, '../..');
const RENDERER_SCRIPTS = Object.freeze([
  'renderer-materials',
  'renderer-assets',
  'heavy-assets',
  'renderer-geometry',
  'renderer-terrain-models',
  'renderer-desert-landscape',
  'renderer-desert-terrain',
  'renderer-alien-terrain',
  'renderer-mothership-terrain',
  'renderer-landscape',
  'renderer-platform-terrain',
  'renderer-upland',
  'renderer-ecology',
  'renderer-world-variation',
  'renderer-westmark-terrain',
  'renderer-model-kit',
  'renderer-heavy-mesh',
  'model-faction-0-building-barracks',
  'model-faction-0-building-factory',
  'model-faction-0-building-hangar',
  'model-faction-0-building-hq',
  'model-faction-0-building-depot',
  'model-faction-0-building-refinery',
  'model-faction-0-building-turret',
  'model-faction-1-building-hq',
  'model-faction-1-building-barracks',
  'model-faction-1-building-depot',
  'model-faction-1-building-refinery',
  'model-faction-1-building-factory',
  'model-faction-1-building-hangar',
  'model-faction-1-building-turret',
  'model-faction-2-building-hq',
  'model-faction-2-building-barracks',
  'model-faction-2-building-depot',
  'model-faction-2-building-refinery',
  'model-faction-2-building-factory',
  'model-faction-2-building-hangar',
  'model-faction-2-building-turret',
  'model-faction-0-unit-worker',
  'model-faction-0-unit-rifle',
  'model-faction-0-unit-medic',
  'model-faction-0-unit-tank',
  'model-faction-0-unit-artillery',
  'model-faction-0-unit-air',
  'model-faction-0-unit-destroyer',
  'model-faction-0-unit-hero',
  'model-faction-1-unit-worker',
  'model-faction-1-unit-rifle',
  'model-faction-1-unit-medic',
  'model-faction-1-unit-tank',
  'model-faction-1-unit-artillery',
  'model-faction-1-unit-air',
  'model-faction-1-unit-destroyer',
  'model-faction-1-unit-hero',
  'model-faction-2-unit-worker',
  'model-faction-2-unit-rifle',
  'model-faction-2-unit-medic',
  'model-faction-2-unit-tank',
  'model-faction-2-unit-artillery',
  'model-faction-2-unit-air',
  'model-faction-2-unit-destroyer',
  'model-faction-2-unit-hero',
  'renderer-shaders',
  'renderer-menu-sky',
  'renderer-runtime',
  'renderer-model-thumbnails'
]);
const BATTLEFIELD_SCRIPTS = Object.freeze([
  'battlefield-surface',
  'battlefield-design',
  'battlefield-shared',
  'battlefield-ecology',
  'battlefield-variations',
  'battlefield-dynamic',
  'battlefield-platforms',
  'battlefield-deployment',
  'battlefield-catalog'
]);
const SIMULATION_SCRIPTS = Object.freeze([
  'simulation-game',
  'simulation-movement',
  'simulation-economy',
  'simulation-combat',
  'simulation-commands',
  'simulation-ai-rules',
  'simulation-ai-strategy',
  'simulation-ai',
  'simulation-runtime'
]);
const DIAGNOSTIC_SCRIPTS = Object.freeze(['diagnostics-recorder', 'diagnostics-gpu', 'diagnostics-browser']);
const AUDIO_SCRIPTS = Object.freeze(['voice-content', 'audio']);
const UI_SCRIPTS = Object.freeze(['ui-core', 'ui-templates', 'ui-model-thumbnail', 'ui-codex', 'ui-screens', 'ui-tutorial', 'ui-actions', 'ui-input', 'ui-presentation']);

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

// A test process consumes one build. Cache source/bytecode, never a VM context or game state.
// Explicit readScripts calls stay fresh for loader fixtures and alternate source roots.
let defaultScripts;
const compiledScripts = new WeakMap();
function loadScripts(names, { scripts = (defaultScripts ??= readScripts()), globals = {} } = {}) {
  const requested = new Set(names);
  for (const name of requested) {
    if (!scripts.some(script => script.name === name)) throw new Error(`Missing script: ${name}`);
  }
  const context = vm.createContext({ ...globals });
  // Match the browser, not request order. Dependencies remain explicit at call
  // sites; reading a script never executes it and the app is not auto-loaded.
  for (const script of scripts) {
    if (!requested.has(script.name)) continue;
    let cached = compiledScripts.get(script);
    if (!cached || cached.source !== script.source || cached.filename !== script.filename) {
      cached = { source: script.source, filename: script.filename,
        program: new vm.Script(script.source, { filename: script.filename }) };
      compiledScripts.set(script, cached);
    }
    cached.program.runInContext(context);
  }
  return context;
}

module.exports = { AUDIO_SCRIPTS, DIAGNOSTIC_SCRIPTS, BATTLEFIELD_SCRIPTS, RENDERER_SCRIPTS, SIMULATION_SCRIPTS, UI_SCRIPTS, readScripts, loadScripts };
