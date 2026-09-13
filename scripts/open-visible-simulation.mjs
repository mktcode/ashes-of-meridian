import { spawn } from 'node:child_process';

const page = new URL('../index.html', import.meta.url);
page.searchParams.set('simulation', 'ai-vs-ai');

if (process.argv.includes('--print')) {
  console.log(page.href);
  process.exit(0);
}

let command;
let args;
if (process.platform === 'darwin') {
  command = 'open';
  args = [page.href];
} else if (process.platform === 'win32') {
  command = 'cmd.exe';
  args = ['/d', '/s', '/c', 'start', '', page.href];
} else {
  command = 'xdg-open';
  args = [page.href];
}

const browser = spawn(command, args, { detached: true, stdio: 'ignore' });
browser.once('error', error => {
  console.error(`Could not open the default browser: ${error.message}`);
  process.exitCode = 1;
});
browser.once('spawn', () => {
  browser.unref();
  console.log('Visible AI simulation opened in the default browser. Close its window or tab to stop watching.');
});
