// Serves dist/ at /arcade/send-it/ (and 404s elsewhere) to prove the build
// works when nested under an existing site. Usage: node scripts/serve-nested.mjs [port]
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
const PORT = Number(process.argv[2] ?? 5191);
const ROOT = join(fileURLToPath(new URL('..', import.meta.url)), 'dist');
const PREFIX = '/arcade/send-it/';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.glb': 'model/gltf-binary', '.json': 'application/json', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.woff2': 'font/woff2', '.wasm': 'application/wasm' };
createServer(async (req, res) => {
  const url = decodeURIComponent((req.url ?? '/').split('?')[0]);
  if (url === '/arcade/send-it') { res.writeHead(301, { Location: PREFIX }); return res.end(); }
  if (!url.startsWith(PREFIX)) { res.writeHead(404); return res.end('not the game (outside /arcade/send-it/)'); }
  let p = normalize(join(ROOT, url.slice(PREFIX.length)));
  if (!p.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  try { if ((await stat(p)).isDirectory()) p = join(p, 'index.html'); const body = await readFile(p); res.writeHead(200, { 'Content-Type': TYPES[extname(p)] ?? 'application/octet-stream' }); res.end(body); }
  catch { console.log('404', url); res.writeHead(404); res.end('missing'); }
}).listen(PORT, () => console.log(`nested build at http://localhost:${PORT}${PREFIX}`));
