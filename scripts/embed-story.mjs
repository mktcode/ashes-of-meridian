import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

// The authored document is the sole source of story text; embed it for offline file:// play.
const root = resolve(import.meta.dirname, '..');
const story = readFileSync(resolve(root, 'docs/story.md'), 'utf8')
  // Editorial guidance and unrealized mission pitches belong in the design document, not the reader.
  .replace(/\n> \*\*Ashes of Meridian bleibt der Titel\.\*\*[^\n]*\n\n/, '\n')
  .replace(/\n\*In den Spielregeln und technischen Verträgen weiterhin[^\n]*\n/g, '')
  .replace(/\n## 10\. Missionsansätze[\s\S]*?(?=\n## 11\.)/, '')
  .replace('## 11. Was unbekannt bleiben darf', '## 10. Was unbekannt bleiben darf');
writeFileSync(resolve(root, 'src/ui/story-data.js'),
  `/* Generated from docs/story.md by npm run embed:story. Do not edit. */\nconst CODEX_STORY_MARKDOWN = ${JSON.stringify(story)};\n`);
