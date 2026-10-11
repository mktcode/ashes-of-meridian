import js from '@eslint/js';
import globals from 'globals';
import { readFileSync } from 'node:fs';
const files = JSON.parse(readFileSync(new URL('./scripts/tooling-files.json', import.meta.url)));
export default [
  { ignores: ['dist/**', '.tmp/**', 'node_modules/**'] },
  { ...js.configs.recommended, files, languageOptions: { globals: globals.node } },
  {
    files: [
      'scripts/browser/smoke.mjs',
      'scripts/diagnostics/browser.mjs',
      'scripts/diagnostics/capture.mjs',
    ],
    languageOptions: { globals: globals.browser },
  },
];
