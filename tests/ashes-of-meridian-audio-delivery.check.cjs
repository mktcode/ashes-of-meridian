// Static Docker allowlist contract and a real ZIP check; no Docker/browser/game run.
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');
const { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync } = require('node:fs');
const { join } = require('node:path');
const { inflateRawSync } = require('node:zlib');
const { AUDIO_SCRIPTS, loadScripts } = require('./helpers/game-scripts.cjs');
const root = join(__dirname, '..');

function runtimeAudio() {
  const context = loadScripts(AUDIO_SCRIPTS);
  const { music, shot, voices } = vm.runInContext(`({music:BATTLE_MUSIC_URLS,shot:INFANTRY_SHOT_URL,
    voices:Object.values(VOICE_LINES).flatMap(line=>line.audio?[line.audio]:[])})`, context);
  assert.ok(music.length > 0, 'battle playlist must not be empty');
  assert.equal(new Set(music).size, music.length, 'battle playlist contains duplicate recordings');
  const files = [...music, shot].map(url => {
    assert.match(url, /^\.\/audio\/[a-z0-9-]+\.(mp3|wav)$/);
    return url.slice(2);
  });
  const voiceFiles = [...new Set(voices)].map(url => {
    assert.match(url, /^\.\/audio\/voices\/[a-z0-9-]+\.mp3$/);
    return url.slice(2);
  });
  assert.equal(new Set(files).size, files.length, 'runtime audio paths must be unique');
  return { files, voices: voiceFiles };
}

function assertDockerAudio(files, dockerfile, dockerignore) {
  const copied = [];
  let voiceCopies = 0;
  for (const raw of dockerfile.replace(/\\\r?\n/g, ' ').split(/\r?\n/)) {
    const line = raw.trim();
    if (!/^COPY\s/i.test(line)) continue;
    const tokens = line.replace(/^COPY\s+/i, '').split(/\s+/), destination = tokens.pop();
    if (!tokens.some(token => token.startsWith('audio/'))) continue;
    if (tokens.includes('audio/voices/')) {
      assert.deepEqual(tokens, ['audio/voices/'], 'voice COPY must be explicit');
      assert.equal(destination, '/site/audio/voices/', 'voice COPY destination');
      voiceCopies++;
    } else {
      for (const source of tokens) assert.match(source, /^audio\/[a-z0-9-]+\.(mp3|wav)$/, 'audio COPY must use explicit files');
      assert.equal(destination, '/site/audio/', 'audio COPY destination');
      copied.push(...tokens);
    }
  }
  assert.deepEqual(copied.sort(), [...files].sort(), 'Docker audio COPY list must match runtime');
  assert.equal(voiceCopies, 1, 'Docker requires one explicit voice directory COPY');

  // Deliberately protect the current explicit allowlist, not emulate Docker glob semantics.
  const rules = dockerignore.split(/\r?\n/).map(line => line.trim()).filter(line => line && !line.startsWith('#'));
  assert.equal(rules[0], '*', 'Docker context must start with the deny-all rule');
  assert.ok(rules.slice(1).every(rule => rule.startsWith('!')), 'unexpected Docker exclusion rule; review context semantics');
  assert.ok(rules.slice(1).every(rule => !/[*?\[]/.test(rule.slice(1)) || rule.includes('/')),
    'root-wide Docker wildcard requires explicit review');
  const audioRules = rules.filter(rule => rule.startsWith('!audio'));
  assert.deepEqual(audioRules.sort(), ['!audio/', ...files.map(file => `!${file}`), '!audio/voices/', '!audio/voices/**'].sort(),
    'Docker audio allowlist must match runtime');
}

function zipAudioEntries(zip) {
  const end = zip.length - 22;
  assert.equal(zip.readUInt32LE(end), 0x06054b50, 'expected comment-free ZIP end record');
  const count = zip.readUInt16LE(end + 10), audio = new Map();
  let cursor = zip.readUInt32LE(end + 16);
  for (let i = 0; i < count; i++) {
    assert.equal(zip.readUInt32LE(cursor), 0x02014b50, 'ZIP central entry');
    const nameSize = zip.readUInt16LE(cursor + 28), extraSize = zip.readUInt16LE(cursor + 30), commentSize = zip.readUInt16LE(cursor + 32),
      name = zip.subarray(cursor + 46, cursor + 46 + nameSize).toString('utf8');
    if (name.startsWith('audio/')) {
      assert.equal(audio.has(name), false, `duplicate ZIP audio entry: ${name}`);
      assert.equal(zip.readUInt16LE(cursor + 10), 8, 'audio uses ZIP deflate');
      const local = zip.readUInt32LE(cursor + 42), size = zip.readUInt32LE(cursor + 20);
      assert.equal(zip.readUInt32LE(local), 0x04034b50, 'ZIP local entry');
      const start = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28),
        data = inflateRawSync(zip.subarray(start, start + size));
      assert.equal(data.length, zip.readUInt32LE(cursor + 24), 'ZIP uncompressed audio size');
      audio.set(name, data);
    }
    cursor += 46 + nameSize + extraSize + commentSize;
  }
  assert.equal(cursor, end, 'ZIP central directory ends at the end record');
  return audio;
}

const sampleFiles = ['audio/music-test.mp3', 'audio/sfx-test.wav'];
const sampleDocker = 'COPY audio/music-test.mp3 audio/sfx-test.wav /site/audio/\nCOPY audio/voices/ /site/audio/voices/\n';
const sampleIgnore = '*\n!audio/\n!audio/music-test.mp3\n!audio/sfx-test.wav\n!audio/voices/\n!audio/voices/**\n';

test('Docker audio COPY and context declarations match the built runtime catalogue', () => {
  const { files, voices } = runtimeAudio();
  assertDockerAudio(files, readFileSync(join(root, 'Dockerfile'), 'utf8'), readFileSync(join(root, '.dockerignore'), 'utf8'));
  const voiceInventory = readdirSync(join(root, 'audio/voices'), { withFileTypes: true }).map(entry => {
    assert.ok(entry.isFile(), `unexpected voice directory entry: ${entry.name}`);
    return `audio/voices/${entry.name}`;
  });
  assert.deepEqual(voiceInventory.sort(), [...voices].sort(), 'Docker voice directory must contain exactly catalogue recordings');
  for (const file of [...files, ...voices]) assert.ok(readFileSync(join(root, file)).length > 0, `empty runtime recording: ${file}`);
});

test('delivery guard detects missing, extra and duplicate Docker recordings and wrong destinations', () => {
  assertDockerAudio(sampleFiles, sampleDocker, sampleIgnore);
  for (const invalid of [
    sampleDocker.replace('audio/music-test.mp3 ', ''),
    sampleDocker.replace('audio/sfx-test.wav ', 'audio/sfx-test.wav audio/draft.mp3 '),
    sampleDocker.replace('audio/sfx-test.wav ', 'audio/sfx-test.wav audio/sfx-test.wav ')
  ]) assert.throws(() => assertDockerAudio(sampleFiles, invalid, sampleIgnore), /COPY list must match runtime/);
  assert.throws(() => assertDockerAudio(sampleFiles, sampleDocker.replace('/site/audio/', '/wrong/'), sampleIgnore), /COPY destination/);
  assert.throws(() => assertDockerAudio(sampleFiles, sampleDocker.replace('COPY audio/voices/ /site/audio/voices/\n', ''), sampleIgnore), /voice directory COPY/);
});

test('delivery guard detects missing parent/file/voice allowances and unsupported broad rules', () => {
  for (const line of ['!audio/', '!audio/music-test.mp3', '!audio/voices/', '!audio/voices/**'])
    assert.throws(() => assertDockerAudio(sampleFiles, sampleDocker, sampleIgnore.replace(`${line}\n`, '')), /allowlist must match runtime/);
  for (const extra of ['!audio/**\n', '!audio/draft.mp3\n'])
    assert.throws(() => assertDockerAudio(sampleFiles, sampleDocker, sampleIgnore + extra), /allowlist must match runtime/);
  assert.throws(() => assertDockerAudio(sampleFiles, sampleDocker, sampleIgnore + 'audio/music-test.mp3\n'), /exclusion rule/);
  assert.throws(() => assertDockerAudio(sampleFiles, sampleDocker, sampleIgnore + '!**\n'), /root-wide/);
});

test('real ZIP contains exactly runtime recordings, unchanged byte for byte', { timeout: 30000 }, t => {
  const { files, voices } = runtimeAudio(), base = join(root, '.tmp/audio-delivery');
  mkdirSync(base, { recursive: true });
  const directory = mkdtempSync(join(base, 'package-')), output = join(directory, 'runtime.zip');
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  execFileSync(process.execPath, ['scripts/build-zip.mjs', output], { cwd: root, timeout: 20000,
    env: { ...process.env, TMPDIR: directory, TMP: directory, TEMP: directory } });
  const packaged = zipAudioEntries(readFileSync(output)), expected = [...files, ...voices];
  assert.deepEqual([...packaged.keys()].sort(), expected.sort(), 'ZIP audio entries must match runtime');
  for (const file of expected) assert.ok(packaged.get(file).equals(readFileSync(join(root, file))), `ZIP changed recording bytes: ${file}`);
});
