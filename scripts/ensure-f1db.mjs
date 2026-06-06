import { existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const meta = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'data', 'meta.json');

if (!existsSync(meta)) {
  execSync('node scripts/build-f1db.mjs', { stdio: 'inherit' });
}
