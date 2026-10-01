import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { selectTests } from '../tests/helpers/test-suites.cjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const [suite = 'standard', ...options] = process.argv.slice(2);
if (options.some(option => option !== '--list')) throw Error('Only --list is supported; use node --test directly for name filters.');
const files = selectTests(suite, root);
if (!files.length) throw Error(`Empty test suite: ${suite}`);
if (options.includes('--list')) {
  console.log(files.join('\n'));
} else {
  const result = spawnSync(process.execPath,
    ['--max-old-space-size=128', '--test', '--test-concurrency=1', ...files],
    { cwd: root, stdio: 'inherit' });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
}
