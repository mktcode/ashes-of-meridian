import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
const owned = ['.tmp', 'dist', 'node_modules'];
export function trackedArtifacts(paths) {
  return paths.filter((path) => path.split('/').some((segment) => owned.includes(segment)));
}
export function checkRepository(root) {
  const tracked = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' })
    .split('\0')
    .filter(Boolean);
  const artifacts = trackedArtifacts(tracked);
  if (artifacts.length) throw Error(`Generated/scratch paths are tracked: ${artifacts.join(', ')}`);
  const scopes = [''];
  if (existsSync(resolve(root, 'packages'))) {
    for (const entry of readdirSync(resolve(root, 'packages'), { withFileTypes: true })) {
      if (entry.isSymbolicLink()) throw Error(`Package directory is a symlink: ${entry.name}`);
      if (entry.isDirectory()) scopes.push(`packages/${entry.name}/`);
    }
  }
  for (const scope of scopes)
    for (const name of owned) {
      const dir = scope + name;
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
