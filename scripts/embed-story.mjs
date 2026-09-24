import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

// The authored document is the sole source of story text; embed it for offline file:// play.
const root = resolve(import.meta.dirname, '..');
const story = readFileSync(resolve(root, 'docs/story.md'), 'utf8');
writeFileSync(resolve(root, 'src/ui/story-data.js'),
  `/* Generated from docs/story.md by npm run embed:story. Do not edit. */\nconst CODEX_STORY_MARKDOWN = ${JSON.stringify(story)};\n`);
