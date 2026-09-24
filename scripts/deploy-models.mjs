// Deploys the licensed vehicle/rider GLBs to the separate model-host Vercel site
// (https://slingmods-send-it-models.vercel.app). The GLBs are git-ignored, so the
// game's Git-triggered builds load them from there via VITE_MODEL_BASE.
//
// Usage: npm run import-vehicles && npm run deploy:models
import { cpSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const src = join(root, 'public/assets/vehicles');
const host = join(root, 'model-host');
const dst = join(host, 'assets/vehicles');

if (!existsSync(src)) {
  console.error('No public/assets/vehicles — run `npm run import-vehicles` first.');
  process.exit(1);
}
let n = 0;
for (const dir of readdirSync(src)) {
  for (const f of readdirSync(join(src, dir)).filter((x) => x.endsWith('.glb'))) {
    mkdirSync(join(dst, dir), { recursive: true });
    cpSync(join(src, dir, f), join(dst, dir, f));
    n++;
  }
}
console.log(`Copied ${n} GLBs into model-host/. Deploying…`);
execSync('vercel deploy --prod --yes', { cwd: host, stdio: 'inherit' });
