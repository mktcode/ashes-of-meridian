import { execFileSync } from 'node:child_process';
import { lstatSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
const owned = ['.tmp', 'dist', 'node_modules'];
export function trackedArtifacts(paths) {
  return paths.filter((path) => owned.some((dir) => path === dir || path.startsWith(`${dir}/`)));
}
export function checkRepository(root) {
  const tracked = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' })
    .split('\0')
    .filter(Boolean);
  const artifacts = trackedArtifacts(tracked);
  if (artifacts.length) throw Error(`Generated/scratch paths are tracked: ${artifacts.join(', ')}`);
  for (const dir of owned) {
    try {
      if (lstatSync(resolve(root, dir)).isSymbolicLink())
        throw Error(`Writable worktree directory is a symlink: ${dir}`);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    execFileSync('git', ['check-ignore', '-q', `${dir}/repository-hygiene-probe`], { cwd: root });
  }
  return tracked.length;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = fileURLToPath(new URL('../', import.meta.url));
  console.log(
    `Repository ownership checked (${checkRepository(root)} tracked files); no files removed.`,
  );
}
