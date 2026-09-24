// Copies the exact vehicle + rider assets SEND IT uses from a local, READ-ONLY
// Three-Wheel Tour checkout, applies lossless-shape meshopt compression, and
// writes provenance (source revision, paths, hashes). Never writes to the source.
// Usage: node scripts/import-vehicles.mjs [path-to-three-wheel-tour-checkout]
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { dedup, prune, quantize, meshopt } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readFileSync, writeFileSync, statSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';

const SRC = resolve(process.argv[2] ?? '../../slingmods-three-wheel-tour-rebuild');
const OUT = resolve('public/assets/vehicles');
if (!existsSync(join(SRC, 'public/assets'))) throw new Error(`Source checkout not found at ${SRC}`);
const rev = execSync('git rev-parse HEAD', { cwd: SRC }).toString().trim();
console.log('source', SRC, 'revision', rev);

const FILES = [
  { id: 'slingshot', src: 'public/assets/model02/slingshot-2026.glb', out: 'slingshot/slingshot-2026.glb', glb: true },
  { id: 'slingshot', src: 'public/assets/model02/rear-rig.json', out: 'slingshot/rear-rig.json' },
  { id: 'ryker', src: 'public/assets/ryker/complete/ryker-900-complete.glb', out: 'ryker/ryker-900-complete.glb', glb: true },
  { id: 'ryker', src: 'public/assets/ryker/rear-rig.json', out: 'ryker/rear-rig.json' },
  { id: 'spyder', src: 'public/assets/spyder/spyder-f3.glb', out: 'spyder/spyder-f3.glb', glb: true },
  { id: 'spyder', src: 'public/assets/spyder/manifest.json', out: 'spyder/manifest.json' },
  { id: 'rider', src: 'public/assets/drivers/biker/biker-rider.glb', out: 'rider/biker-rider.glb', glb: true },
  { id: 'rider', src: 'public/assets/drivers/biker/fit-slingshot.json', out: 'rider/fit-slingshot.json' },
  { id: 'rider', src: 'public/assets/drivers/biker/fit-ryker.json', out: 'rider/fit-ryker.json' },
  { id: 'rider', src: 'public/assets/drivers/biker/fit-spyder.json', out: 'rider/fit-spyder.json' },
  { id: 'rider', src: 'public/assets/drivers/biker/manifest.json', out: 'rider/manifest.json' },
];

const sha = (buf) => createHash('sha256').update(buf).digest('hex');
await MeshoptEncoder.ready;
await MeshoptDecoder.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });

const records = [];
for (const f of FILES) {
  const from = join(SRC, f.src);
  const to = join(OUT, f.out);
  mkdirSync(resolve(to, '..'), { recursive: true });
  const original = readFileSync(from);
  if (original.length < 1024 && original.toString().startsWith('version https://git-lfs')) throw new Error(`${f.src} is a Git LFS pointer, not the asset`);
  if (f.glb) {
    const doc = await io.readBinary(new Uint8Array(original));
    // keepLeaves: empty pivot nodes (rear_hub, shock_upper...) are part of the rig.
    await doc.transform(dedup(), prune({ keepLeaves: true, keepAttributes: true }), quantize(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
    writeFileSync(to, await io.writeBinary(doc));
  } else copyFileSync(from, to);
  const out = readFileSync(to);
  records.push({ vehicle: f.id, source: f.src, sourceSha256: sha(original), sourceBytes: original.length, runtime: `assets/vehicles/${f.out}`, runtimeSha256: sha(out), runtimeBytes: out.length, edit: f.glb ? 'dedup + prune(keepLeaves) + quantize + meshopt (no decimation)' : 'copied unchanged' });
  console.log(f.out, (original.length / 1e6).toFixed(1) + 'MB ->', (out.length / 1e6).toFixed(1) + 'MB');
}
writeFileSync(join(OUT, 'provenance.json'), JSON.stringify({ sourceRepository: 'DanielKinsner/slingmods-three-wheel-tour-rebuild', sourceRevision: rev, importedAt: new Date().toISOString(), note: 'Read-only import. Rider is an owner-purchased rigged character; vehicles per source manifests. Public redistribution rights not established by this import.', files: records }, null, 2));
console.log('wrote provenance.json');
