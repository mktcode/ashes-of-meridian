import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const root = import.meta.dirname;
rmSync(resolve(root, 'dist'), { recursive: true, force: true });
execFileSync(process.execPath, [resolve(root, '../../node_modules/typescript/bin/tsc'), '-p', resolve(root, 'tsconfig.json')], { stdio: 'inherit' });
const options = { bundle: true, target: 'es2022', sourcemap: true, legalComments: 'none' };
for (const name of ['index', 'crowd']) await build({ ...options, entryPoints: [resolve(root, `src/${name}.ts`)],
  format: 'esm', platform: 'neutral', outfile: resolve(root, `dist/${name}.js`) });
await build({ ...options, entryPoints: [resolve(root, 'src/index.ts')], format: 'iife', platform: 'browser',
  globalName: 'MeridianLandscape', outfile: resolve(root, 'dist/landscape.global.js') });
await build({ ...options, entryPoints: [resolve(root, 'demo/session.js')], format: 'esm', platform: 'node',
  outfile: resolve(root, 'dist/session.js') });
await build({ ...options, entryPoints: [resolve(root, 'demo/app.js')], format: 'iife', platform: 'browser',
  loader: { '.zip': 'binary' }, outfile: resolve(root, 'dist/terrain-demo.global.js') });
const delivery = resolve(root, '../../dist/landscape');
rmSync(delivery, { recursive: true, force: true });
mkdirSync(resolve(delivery, 'dist'), { recursive: true });
// Mirror package-relative URLs in the delivered standalone demo.
mkdirSync(resolve(delivery, 'demo'), { recursive: true });
for (const file of ['index.html', 'terrain.js']) cpSync(resolve(root, `demo/${file}`), resolve(delivery, `demo/${file}`));
for (const file of ['landscape.global.js', 'terrain-demo.global.js']) cpSync(resolve(root, `dist/${file}`), resolve(delivery, `dist/${file}`));
