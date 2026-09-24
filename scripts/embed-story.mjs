import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Embed the English game text for offline file:// play; docs/story.md remains the German reference.
const root = resolve(import.meta.dirname, '..');
const story = readFileSync(resolve(root, 'src/ui/story.en.md'), 'utf8');
writeFileSync(resolve(root, 'src/ui/story-data.js'),
  `/* Generated from src/ui/story.en.md by npm run embed:story. Do not edit. */\nconst CODEX_STORY_MARKDOWN = ${JSON.stringify(story)};\n`);
