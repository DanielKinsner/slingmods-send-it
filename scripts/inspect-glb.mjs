// Inspect a GLB: node tree with world bounds, materials, textures, extensions.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { getBounds } from '@gltf-transform/functions';
const file = process.argv[2];
const depthMax = Number(process.argv[3] ?? 4);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(file);
const root = doc.getRoot();
console.log('extensionsUsed', root.listExtensionsUsed().map((e) => e.extensionName));
console.log('meshes', root.listMeshes().length, 'materials', root.listMaterials().length, 'textures', root.listTextures().length, 'skins', root.listSkins().length, 'anims', root.listAnimations().length);
let tris = 0;
for (const m of root.listMeshes()) for (const p of m.listPrimitives()) { const i = p.getIndices(); tris += (i ? i.getCount() : p.getAttribute('POSITION').getCount()) / 3; }
console.log('triangles', Math.round(tris));
const scene = root.getDefaultScene() ?? root.listScenes()[0];
const b = getBounds(scene);
console.log('scene bounds min', b.min.map((v) => v.toFixed(3)), 'max', b.max.map((v) => v.toFixed(3)));
function walk(n, d) {
  if (d > depthMax) return;
  const bb = getBounds(n);
  const size = bb.max.map((v, i) => (v - bb.min[i]).toFixed(2));
  const c = bb.max.map((v, i) => ((v + bb.min[i]) / 2).toFixed(2));
  console.log(`${'  '.repeat(d)}${n.getName() || '(node)'}${n.getMesh() ? ' [mesh ' + n.getMesh().listPrimitives().map((p) => p.getMaterial()?.getName()).join(',') + ']' : ''} t=${n.getTranslation().map((v) => v.toFixed(2))} size=${size} center=${c} kids=${n.listChildren().length}`);
  for (const k of n.listChildren()) walk(k, d + 1);
}
for (const n of scene.listChildren()) walk(n, 0);
console.log('materials:', root.listMaterials().map((m) => `${m.getName()}(${m.getBaseColorFactor().map((v) => v.toFixed(2)).join(',')} r${m.getRoughnessFactor().toFixed(2)} m${m.getMetallicFactor().toFixed(2)}${m.getBaseColorTexture() ? ' tex' : ''})`).join(' | '));
