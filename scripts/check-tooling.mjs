import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const files = JSON.parse(readFileSync(new URL('./tooling-files.json', import.meta.url)));
const [mode, option] = process.argv.slice(2);
if (
  !['lint', 'format'].includes(mode) ||
  (option !== undefined && !(mode === 'format' && option === '--write')) ||
  process.argv.length > 4
)
  throw Error('Usage: node scripts/check-tooling.mjs lint|format [--write]');
const bin = mode === 'lint' ? 'eslint/bin/eslint.js' : 'prettier/bin/prettier.cjs';
const args = mode === 'lint' ? files : [option === '--write' ? '--write' : '--check', ...files];
const result = spawnSync(
  process.execPath,
  [fileURLToPath(new URL(`../node_modules/${bin}`, import.meta.url)), ...args],
  { cwd: root, stdio: 'inherit' },
);
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
