import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export async function buildCrowdPackage() {
  const root = import.meta.dirname;
  rmSync(resolve(root, 'dist'), { recursive: true, force: true });
  execFileSync(
    process.execPath,
    [resolve(root, '../../node_modules/typescript/bin/tsc'), '-p', resolve(root, 'tsconfig.json')],
    { stdio: 'inherit' },
  );
  const shared = {
    entryPoints: [resolve(root, 'src/index.ts')],
    bundle: true,
    target: 'es2022',
    sourcemap: true,
    legalComments: 'none',
  };
  await build({
    ...shared,
    format: 'esm',
    platform: 'node',
    outfile: resolve(root, 'dist/index.js'),
  });
  await build({
    ...shared,
    format: 'iife',
    platform: 'browser',
    globalName: 'MeridianCrowd',
    outfile: resolve(root, 'dist/crowd.global.js'),
  });
  const delivery = resolve(root, '../../dist/crowd-simulation');
  rmSync(delivery, { recursive: true, force: true });
  mkdirSync(resolve(delivery, 'dist'), { recursive: true });
  cpSync(resolve(root, 'demo'), resolve(delivery, 'demo'), { recursive: true });
  cpSync(resolve(root, 'dist/crowd.global.js'), resolve(delivery, 'dist/crowd.global.js'));
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  await buildCrowdPackage();
