import { deflateRawSync } from 'node:zlib';
import { runInNewContext } from 'node:vm';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, posix, relative, resolve, sep } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const output = resolve(root, process.argv[2] || 'release/ashes-of-meridian-prototype.zip');
// Evaluate the built, data-only catalogue: voice paths have one authoritative source.
const voiceSource = await readFile(resolve(root, 'dist/src/voice-content.js'), 'utf8');
const voiceAudio = runInNewContext(`${voiceSource}\nObject.values(VOICE_LINES).flatMap(line => line.audio ? [line.audio] : [])`);
if (voiceAudio.some(url => !/^\.\/audio\/voices\/[a-z0-9-]+\.mp3$/.test(url)))
  throw new Error('Voice catalogue has an unsupported local audio path');
const runtimeAudio = [
  'audio/music-ratchet-theory.mp3',
  'audio/music-last-light-relay.mp3',
  'audio/music-breach-protocol.mp3',
  'audio/music-black-channel.mp3',
  'audio/music-sporewake.mp3',
  'audio/music-rootmind.mp3',
  'audio/sfx-infantry-shot.wav',
  ...new Set(voiceAudio.map(url => url.slice(2)))
];

async function filesBelow(directory, accept = () => true) {
  const files = [];
  async function visit(current) {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const path = resolve(current, entry.name);
      if (entry.isDirectory()) await visit(path);
      else if (entry.isFile() && accept(path)) files.push(relative(root, path).split(sep).join('/'));
    }
  }
  await visit(resolve(root, directory));
  return files;
}

function localCssTargets(name, css) {
  const targets = [];
  for (const match of css.matchAll(/url\(\s*(?:"([^"]+)"|'([^']+)'|([^)'"\s]+))\s*\)/g)) {
    const target = match[1] || match[2] || match[3];
    if (/^(?:#|data:|https?:)/.test(target)) continue;
    const fileTarget = target.split(/[?#]/, 1)[0];
    if (!fileTarget || posix.isAbsolute(fileTarget)) throw new Error(`${name} has an unsupported asset URL: ${target}`);
    const packagedTarget = posix.normalize(posix.join(posix.dirname(name), fileTarget));
    if (packagedTarget.startsWith('../')) throw new Error(`${name} references an asset outside the package: ${target}`);
    targets.push(packagedTarget);
  }
  return targets;
}

const stylePaths = await filesBelow('styles');
const styleSources = await Promise.all(stylePaths.map(async name => ({
  name,
  css: await readFile(resolve(root, name), 'utf8')
})));
const cssAssets = [...new Set(styleSources.flatMap(({ name, css }) => localCssTargets(name, css)))];
const paths = [
  'index.html',
  ...stylePaths,
  ...(await filesBelow('dist', path => path.endsWith('.js'))),
  ...runtimeAudio,
  'assets/fonts/aldrich/OFL.txt',
  ...(await filesBelow('assets/ui', path => path.endsWith('.webp'))).filter(path => !cssAssets.includes(path)),
  ...cssAssets
].sort();

if (new Set(paths).size !== paths.length) throw new Error('Duplicate path in itch.io package');
const entries = await Promise.all(paths.map(async name => ({ name, data: await readFile(resolve(root, name)) })));
const packaged = new Set(paths);
const html = entries.find(entry => entry.name === 'index.html').data.toString('utf8');
for (const [, target] of html.matchAll(/(?:src|href)=["']\.\/([^"']+)["']/g)) {
  if (!packaged.has(target)) throw new Error(`index.html references an unpackaged file: ${target}`);
}
for (const { name, css } of styleSources) {
  for (const target of localCssTargets(name, css)) {
    if (!packaged.has(target)) throw new Error(`${name} references an unpackaged file: ${target}`);
  }
}

const crcTable = Array.from({ length: 256 }, (_, value) => {
  let crc = value;
  for (let bit = 0; bit < 8; bit++) crc = (crc & 1) ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
  return crc >>> 0;
});
function crc32(data) {
  let crc = 0xffffffff;
  for (const byte of data) crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 0xff];
  return (crc ^ 0xffffffff) >>> 0;
}
function header(size) { return Buffer.alloc(size); }

// Fixed timestamps and sorted paths make identical source builds byte-for-byte reproducible.
const localParts = [], centralParts = [];
let offset = 0;
for (const entry of entries) {
  const name = Buffer.from(entry.name, 'utf8'), compressed = deflateRawSync(entry.data, { level: 9 }), crc = crc32(entry.data),
    local = header(30), central = header(46), flags = 0x0800;
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4); local.writeUInt16LE(flags, 6); local.writeUInt16LE(8, 8);
  local.writeUInt32LE(crc, 14); local.writeUInt32LE(compressed.length, 18); local.writeUInt32LE(entry.data.length, 22);
  local.writeUInt16LE(name.length, 26);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(flags, 8); central.writeUInt16LE(8, 10);
  central.writeUInt32LE(crc, 16); central.writeUInt32LE(compressed.length, 20); central.writeUInt32LE(entry.data.length, 24);
  central.writeUInt16LE(name.length, 28); central.writeUInt32LE(0x81a40000, 38); central.writeUInt32LE(offset, 42);
  localParts.push(local, name, compressed); centralParts.push(central, name);
  offset += local.length + name.length + compressed.length;
}
const central = Buffer.concat(centralParts), end = header(22);
end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
end.writeUInt32LE(central.length, 12); end.writeUInt32LE(offset, 16);
await mkdir(dirname(output), { recursive: true });
await writeFile(output, Buffer.concat([...localParts, central, end]));
const bytes = (await readFile(output)).length;
console.log(`Created ${relative(root, output)} (${entries.length} files, ${(bytes / 1024 / 1024).toFixed(2)} MiB)`);
