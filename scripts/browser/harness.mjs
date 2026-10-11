import { access, mkdir, mkdtemp, rm, lstat } from 'node:fs/promises';
import { constants } from 'node:fs';
import { resolve, join } from 'node:path';

export async function findChromium(override = process.env.CHROMIUM_PATH) {
  const candidates = override
    ? [resolve(override)]
    : ['/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome'];
  for (const candidate of candidates) {
    try {
      await access(candidate, constants.X_OK);
      return candidate;
    } catch {
      /* Try the next installed browser. */
    }
  }
  throw Error(
    'Chromium not found; set CHROMIUM_PATH to an executable. No browser is downloaded automatically.',
  );
}

// Serial CLI operation: temporary environment/cwd changes belong to this invocation.
export async function withBrowser(root, run, { launch, executablePath, timeoutMs = 30000 } = {}) {
  const temporary = resolve(root, '.tmp');
  await mkdir(temporary, { recursive: true });
  if ((await lstat(temporary)).isSymbolicLink())
    throw Error('Browser scratch must not be a shared symlink.');
  const scratch = await mkdtemp(join(temporary, 'browser-check-'));
  const cwd = process.cwd(),
    keys = ['TMPDIR', 'TMP', 'TEMP'],
    saved = keys.map((key) => process.env[key]);
  let browser, timer;
  try {
    const chosen = executablePath ? resolve(executablePath) : await findChromium();
    process.chdir(scratch);
    const temp =
      process.platform === 'linux' && scratch.length > 55 ? `/proc/${process.pid}/cwd` : scratch;
    for (const key of keys) process.env[key] = temp;
    let start = launch;
    if (!start) {
      const { chromium } = await import('playwright-core');
      start = (options) => chromium.launch(options);
    }
    browser = await start({
      executablePath: chosen,
      headless: true,
      chromiumSandbox: true,
      timeout: timeoutMs,
    });
    return await Promise.race([
      Promise.resolve().then(() => run(browser)),
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(Error('Browser check exceeded its time budget')),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
    try {
      await browser?.close();
    } finally {
      process.chdir(cwd);
      keys.forEach((key, i) => {
        if (saved[i] === undefined) delete process.env[key];
        else process.env[key] = saved[i];
      });
      await rm(scratch, { recursive: true, force: true });
    }
  }
}
