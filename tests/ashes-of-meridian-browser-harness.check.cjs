const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mkdir, mkdtemp, readdir, rm } = require('node:fs/promises');
const { resolve, join } = require('node:path');
const root = resolve(__dirname, '..');

async function fixture(run) {
  const parent = join(root, '.tmp', 'browser-harness-tests');
  await mkdir(parent, { recursive: true });
  const directory = await mkdtemp(join(parent, 'case-'));
  try {
    await run(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test('browser harness owns isolated scratch and restores the caller after success', async () => {
  const { withBrowser } = await import('../scripts/browser/harness.mjs');
  await fixture(async (directory) => {
    const cwd = process.cwd(),
      temp = process.env.TMPDIR;
    let closed = 0;
    const result = await withBrowser(
      directory,
      async () => {
        assert.ok(process.cwd().startsWith(join(directory, '.tmp', 'browser-check-')));
        assert.notEqual(process.env.TMPDIR, temp);
        return 17;
      },
      {
        executablePath: '/fixture/chromium',
        launch: async (options) => {
          assert.equal(options.chromiumSandbox, true);
          assert.equal(options.headless, true);
          assert.equal(options.args, undefined, 'no security-relaxing flags');
          return {
            close: async () => {
              closed++;
            },
          };
        },
      },
    );
    assert.equal(result, 17);
    assert.equal(closed, 1);
    assert.equal(process.cwd(), cwd);
    assert.equal(process.env.TMPDIR, temp);
    assert.deepEqual(await readdir(join(directory, '.tmp')), []);
  });
});

test('browser harness supports explicit display/native-GL selection without relaxing security and rejects unknown options', async () => {
  const { withBrowser } = await import('../scripts/browser/harness.mjs');
  await fixture(async (directory) => {
    await withBrowser(directory, async () => {}, {
      executablePath: '/fixture/chromium',
      headless: false,
      angle: 'gl',
      launch: async (options) => {
        assert.equal(options.headless, false);
        assert.equal(options.chromiumSandbox, true);
        assert.deepEqual(options.args, ['--use-gl=angle', '--use-angle=gl']);
        return { close: async () => {} };
      },
    });
    for (const options of [{ angle: 'unsupported' }, { headless: 'false' }])
      await assert.rejects(
        withBrowser(directory, async () => {}, options),
        /Invalid browser/,
      );
  });
});

for (const mode of ['failure', 'timeout', 'launch'])
  test(`browser harness releases its scratch after ${mode}`, async () => {
    const { withBrowser } = await import('../scripts/browser/harness.mjs');
    await fixture(async (directory) => {
      const cwd = process.cwd(),
        temp = process.env.TMPDIR;
      let closed = 0;
      await assert.rejects(
        withBrowser(
          directory,
          async () => {
            if (mode === 'failure') throw Error('case failed');
            return new Promise(() => {});
          },
          {
            executablePath: '/fixture/chromium',
            timeoutMs: 20,
            launch: async () => {
              if (mode === 'launch') throw Error('launch failed');
              return {
                close: async () => {
                  closed++;
                },
              };
            },
          },
        ),
        /case failed|time budget|launch failed/,
      );
      assert.equal(closed, mode === 'launch' ? 0 : 1);
      assert.equal(process.cwd(), cwd);
      assert.equal(process.env.TMPDIR, temp);
      assert.deepEqual(await readdir(join(directory, '.tmp')), []);
    });
  });

test('an explicit missing Chromium path fails rather than silently selecting another browser', async () => {
  const { findChromium } = await import('../scripts/browser/harness.mjs');
  await assert.rejects(
    findChromium(join(root, '.tmp', 'nonexistent-chromium')),
    /Chromium not found/,
  );
});
