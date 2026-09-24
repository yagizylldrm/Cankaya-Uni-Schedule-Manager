import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const local = resolve(process.cwd(), process.platform === 'win32' ? '.venv/Scripts/python.exe' : '.venv/bin/python');
const candidates = existsSync(local) ? [local] : process.platform === 'win32' ? ['py', 'python'] : ['python3', 'python'];
for (const binary of candidates) {
  const result = spawnSync(binary, process.argv.slice(2), { stdio: 'inherit', shell: false });
  if (!result.error || result.error.code !== 'ENOENT') process.exit(result.status ?? 1);
}
console.error('Python bulunamadı. Proje bağımlılıklarını .venv ortamına kurun.');
process.exit(1);
