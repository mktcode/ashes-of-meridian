import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Deliberately a file-target check, not a Markdown renderer or anchor validator.
export function localTargets(markdown) {
  const text = markdown
    .replace(/^[ \t]*(`{3,}|~{3,})[^\n]*\n[\s\S]*?^[ \t]*\1[^\n]*$/gm, '')
    .replace(/`+[^`\n]*`+/g, '')
    .replace(/<!--[\s\S]*?-->/g, '');
  const targets = [];
  const destination = '(?:<([^>\\n]+)>|([^\\s)]+))';
  for (const pattern of [
    new RegExp('!?\\[[^\\]\\n]*\\]\\(\\s*' + destination, 'g'),
    new RegExp('^ {0,3}\\[[^\\]\\n]+\\]:\\s*' + destination, 'gm'),
  ]) {
    for (const match of text.matchAll(pattern)) {
      const target = match[1] ?? match[2];
      if (/^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(target)) continue;
      const path = target.split(/[?#]/, 1)[0];
      if (path) targets.push(decodeURIComponent(path));
    }
  }
  return targets;
}

export function checkDocLinks(root) {
  const files = ['README.md', 'AGENTS.md'];
  function collect(directory) {
    for (const entry of readdirSync(resolve(root, directory), { withFileTypes: true })) {
      const path = `${directory}/${entry.name}`;
      if (entry.isDirectory()) collect(path);
      else if (entry.isFile() && entry.name.endsWith('.md')) files.push(path);
    }
  }
  collect('docs');
  const errors = [];
  for (const file of files) {
    let targets;
    try {
      targets = localTargets(readFileSync(resolve(root, file), 'utf8'));
    } catch (error) {
      errors.push(`${file}: ${error.message}`);
      continue;
    }
    for (const target of targets) {
      const resolved = target.startsWith('/')
        ? resolve(root, `.${target}`)
        : resolve(root, dirname(file), target);
      const path = relative(root, resolved);
      if (path === '..' || path.startsWith('../')) {
        errors.push(`${file}: target outside repository: ${target}`);
        continue;
      }
      try {
        statSync(resolved);
      } catch {
        errors.push(`${file}: missing target: ${target}`);
      }
    }
  }
  return { files: files.length, errors };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = checkDocLinks(fileURLToPath(new URL('../', import.meta.url)));
  if (result.errors.length) {
    console.error(result.errors.join('\n'));
    process.exitCode = 1;
  } else {
    console.log(
      `Local file targets checked in ${result.files} Markdown files (fragments not checked).`,
    );
  }
}
