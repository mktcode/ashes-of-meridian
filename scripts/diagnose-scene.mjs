import { readFile, writeFile, mkdir, lstat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { parseArgs } from 'node:util';
import { resolveRecipe } from './diagnostics/recipe.mjs';
import { captureCase } from './diagnostics/capture.mjs';

const root = resolve(import.meta.dirname, '..');
const { values } = parseArgs({
  options: {
    recipe: { type: 'string' },
    case: { type: 'string' },
    duration: { type: 'string' },
    output: { type: 'string' },
    'require-hardware': { type: 'boolean' },
    headed: { type: 'boolean' },
    angle: { type: 'string' },
    help: { type: 'boolean', short: 'h' },
  },
});
if (values.help) {
  console.log(
    'Usage: npm run diagnose:scene -- [--recipe scripts/diagnostics/recipes/dense-army.json] [--case day-paused] [--duration 5] [--output .tmp/my-diagnosis] [--require-hardware] [--angle gl] [--headed]\nReal-time, bounded Chromium cases; one JSON per case + index.json. Duration in seconds (1–20). Installed Chromium required (CHROMIUM_PATH optional). Output must be a new direct child directory of this worktree’s .tmp/.',
  );
} else {
  if (values.angle !== undefined && values.angle !== 'gl') throw Error('--angle must be gl');
  const input = JSON.parse(
    await readFile(
      resolve(values.recipe ?? resolve(root, 'scripts/diagnostics/recipes/dense-army.json')),
      'utf8',
    ),
  );
  const recipe = resolveRecipe(input, {
    caseName: values.case,
    durationMs: values.duration === undefined ? undefined : Number(values.duration) * 1000,
  });
  const temporary = resolve(root, '.tmp');
  const output = resolve(
    values.output ?? resolve(temporary, `diagnostic-${Date.now()}-${randomUUID().slice(0, 8)}`),
  );
  if (dirname(output) !== temporary)
    throw Error('--output must be a direct child directory of this worktree’s .tmp/');
  await mkdir(temporary, { recursive: true });
  if ((await lstat(temporary)).isSymbolicLink())
    throw Error('Diagnostic output must not use shared scratch');
  await mkdir(output); // Exclusive: never overwrite an earlier run or follow an output symlink.
  const index = {
    schema: 1,
    recipe: input,
    options: {
      case: values.case ?? null,
      durationMs: recipe.durationMs,
      requireHardware: values['require-hardware'] ?? false,
      headed: values.headed ?? false,
      angle: values.angle ?? 'default',
    },
    results: [],
  };
  for (const scenario of recipe.cases) {
    console.log(
      `Measuring ${scenario.name}: ${recipe.warmupMs} ms paused warmup + ${recipe.durationMs} ms real time`,
    );
    const result = await captureCase(root, recipe, scenario, {
      requireHardware: values['require-hardware'],
      onProgress: (stage) => console.log(`  ${stage}`),
      headless: !values.headed,
      angle: values.angle,
    });
    const file = `${scenario.name}.json`;
    await writeFile(resolve(output, file), JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
    index.results.push({
      case: scenario.name,
      file,
      backend: result.environment.backend,
      gpuStatus: result.diagnostic.gpu.status,
      summary: result.diagnostic.recording.summary,
    });
    console.log(
      `${scenario.name}: ${result.diagnostic.recording.summary.rendered} renders; ${result.environment.backend}; GPU timer ${result.diagnostic.gpu.status}`,
    );
    if (result.environment.backend !== 'hardware-reported')
      console.warn('No device-FPS conclusion: software or unidentified graphics backend.');
  }
  await writeFile(resolve(output, 'index.json'), JSON.stringify(index, null, 2) + '\n', {
    flag: 'wx',
  });
  console.log(output);
}
