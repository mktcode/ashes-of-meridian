import { readFileSync, writeFileSync } from 'node:fs';

// Preserve the maintained PNG bytes; no resize, conversion or runtime file fetch.
const image = new URL('../texture-floor-dirt.png', import.meta.url);
const assets = new URL('../src/renderer/assets.js', import.meta.url);
const source = readFileSync(assets, 'utf8');
const ground = /(?<=ground:\s*')data:image\/(?:webp|png);base64,[A-Za-z0-9+/=]+(?=')/g;
if ([...source.matchAll(ground)].length !== 1) throw Error('Expected exactly one embedded ground texture.');
const url = `data:image/png;base64,${readFileSync(image).toString('base64')}`;
writeFileSync(assets, source.replace(ground, url));
console.log('Embedded texture-floor-dirt.png. Run npm run build to update delivery.');
