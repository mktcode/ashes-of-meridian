import { deflateRawSync } from 'node:zlib';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve, sep } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const output = resolve(root, 'release/ashes-of-meridian-prototype.zip');
const music = [
  'audio/music-ratchet-theory.mp3',
  'audio/music-last-light-relay.mp3',
  'audio/music-breach-protocol.mp3',
  'audio/music-black-channel.mp3',
  'audio/music-sporewake.mp3',
  'audio/music-rootmind.mp3'
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

const paths = [
  'index.html',
  ...(await filesBelow('styles')),
  ...(await filesBelow('dist', path => path.endsWith('.js'))),
  ...music,
  ...(await filesBelow('assets/portraits', path => path.endsWith('.webp')))
].sort();

if (new Set(paths).size !== paths.length) throw new Error('Duplicate path in itch.io package');
const entries = await Promise.all(paths.map(async name => ({ name, data: await readFile(resolve(root, name)) })));
const packaged = new Set(paths);
const html = entries.find(entry => entry.name === 'index.html').data.toString('utf8');
for (const [, target] of html.matchAll(/(?:src|href)=["']\.\/([^"']+)["']/g)) {
  if (!packaged.has(target)) throw new Error(`index.html references an unpackaged file: ${target}`);
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
