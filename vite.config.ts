import { defineConfig, type Plugin } from 'vite';
import { mkdirSync, writeFileSync } from 'node:fs';

// Dev-only: POST a data URL to /__shot?name=foo to save docs/screens/foo.jpg.
// Used to keep real gameplay frames as evidence. Never part of a build.
function screenshotSink(): Plugin {
  return {
    name: 'send-it-screenshot-sink',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__shot', (req, res) => {
        const name = (new URL(req.url ?? '', 'http://x').searchParams.get('name') ?? 'shot').replace(/[^a-z0-9-_]/gi, '');
        let body = '';
        req.on('data', (c) => (body += c));
        req.on('end', () => {
          const m = body.match(/^data:image\/(png|jpeg);base64,(.+)$/);
          if (!m) {
            res.statusCode = 400;
            return res.end('expected a data URL');
          }
          mkdirSync('docs/screens', { recursive: true });
          const file = `docs/screens/${name}.${m[1] === 'png' ? 'png' : 'jpg'}`;
          writeFileSync(file, Buffer.from(m[2], 'base64'));
          res.end(file);
        });
      });
    },
  };
}

// Relative base: the same build runs at a site root or nested at /arcade/send-it/.
// SEND_IT_BASE can pin an absolute base for hosts that need one.
export default defineConfig({
  base: process.env.SEND_IT_BASE ?? './',
  plugins: [screenshotSink()],
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 3200,
    outDir: process.env.SEND_IT_OUT ?? 'dist',
  },
  server: { port: 5190, strictPort: true },
});
