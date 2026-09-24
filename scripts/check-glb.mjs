import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
for (const f of process.argv.slice(2)) {
  const d = await io.read(f); const r = d.getRoot();
  const skinned = r.listNodes().filter((n) => n.getSkin()).map((n) => n.getName());
  console.log(f, 'nodes', r.listNodes().length, 'meshes', r.listMeshes().length, 'skins', r.listSkins().length, 'skinnedNodes', skinned.join(','), 'ext', r.listExtensionsUsed().map((e) => e.extensionName).join(','));
}
