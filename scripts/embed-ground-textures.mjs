import { readFileSync, writeFileSync } from 'node:fs';

// Preserve maintained PNG bytes; no resize, conversion or runtime file fetch.
const root = new URL('../', import.meta.url);
const assets = new URL('src/renderer/assets.js', root);
const textures = {
  ground: 'assets/textures/texture-ground-dirt-base.png',
  rockClusters: 'assets/textures/texture-ground-rock-clusters.png',
  desertShrubs: 'assets/textures/texture-ground-desert-shrubs.png'
};
const dataUrl = file => `data:image/png;base64,${readFileSync(new URL(file, root)).toString('base64')}`;
let source = readFileSync(assets, 'utf8');
const payload = "data:image\\/(?:webp|png);base64,[A-Za-z0-9+/=]+";
for (const key of Object.keys(textures).slice(1))
  source = source.replace(new RegExp(`\\n\\s*${key}:\\s*'${payload}',?`), '');
const ground = new RegExp(`(ground:\\s*')${payload}('),?`);
if (!ground.test(source)) throw Error('Expected exactly one embedded ground texture.');
const extras = Object.entries(textures).slice(1)
  .map(([key, file]) => `      ${key}: '${dataUrl(file)}'`)
  .join(',\n');
source = source.replace(ground, `$1${dataUrl(textures.ground)}$2,\n${extras},`);
writeFileSync(assets, source);
console.log(`Embedded ${Object.values(textures).join(', ')}. Run npm run build to update delivery.`);
