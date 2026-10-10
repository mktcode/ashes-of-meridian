import { lstat, mkdir, mkdtemp } from 'node:fs/promises';
import { dirname, relative, resolve, sep } from 'node:path';

// Output directories are new per invocation: never overwrite an earlier capture.
export async function prepareItchCapturePaths(root, requested) {
  const temporary = resolve(root, '.tmp');
  const release = resolve(root, 'release/itch-media');
  const output = requested === undefined ? undefined : resolve(root, requested);
  if (output !== undefined && ![temporary, release].some(base => output === base || output.startsWith(base + sep)))
    throw Error('--output must be inside this worktree\'s .tmp/ or release/itch-media/');
  // Lexical containment alone is insufficient if an existing parent is a symlink.
  for (const target of [temporary, ...(output === undefined ? [] : [output])]) {
    let current = resolve(root);
    for (const part of relative(current, target).split(sep)) {
      current = resolve(current, part);
      let info;
      try { info = await lstat(current); } catch (error) {
        if (error.code === 'ENOENT') break;
        throw error;
      }
      if (info.isSymbolicLink()) throw Error('Capture output and scratch must not use symlink directories');
    }
  }
  await mkdir(temporary, { recursive: true });
  let directory;
  if (output === undefined) directory = await mkdtemp(resolve(temporary, 'itch-media-'));
  else {
    await mkdir(dirname(output), { recursive: true });
    await mkdir(output); // EEXIST protects both previous captures and existing files.
    directory = output;
  }
  const scratch = await mkdtemp(resolve(temporary, 'itch-capture-runtime-'));
  return { output: directory, scratch };
}

// Playwright cannot encode WebP directly. Keep lossless PNG only in memory,
// then use Chromium's canvas encoder; never disguise a PNG as a .webp file.
export async function webpScreenshot(page) {
  const png = await page.screenshot({ type: 'png', animations: 'disabled' });
  const encoded = await page.evaluate(async base64 => {
    const image = new Image(); image.src = `data:image/png;base64,${base64}`; await image.decode();
    const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
    const context = canvas.getContext('2d');
    if (!context) throw Error('Canvas encoder unavailable');
    context.drawImage(image, 0, 0);
    const data = canvas.toDataURL('image/webp', .8);
    if (!data.startsWith('data:image/webp;base64,')) throw Error('WebP encoder unavailable');
    return data.slice('data:image/webp;base64,'.length);
  }, png.toString('base64'));
  const image = Buffer.from(encoded, 'base64');
  if (image.length < 12 || image.toString('ascii', 0, 4) !== 'RIFF' || image.toString('ascii', 8, 12) !== 'WEBP')
    throw Error('Invalid WebP encoder output');
  return image;
}
