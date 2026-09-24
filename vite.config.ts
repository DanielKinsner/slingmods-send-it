import { defineConfig } from 'vite';

// Relative base: the same build runs at a site root or nested at /arcade/send-it/.
// SEND_IT_BASE can pin an absolute base for hosts that need one.
export default defineConfig({
  base: process.env.SEND_IT_BASE ?? './',
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 2500,
    outDir: process.env.SEND_IT_OUT ?? 'dist',
  },
  server: { port: 5190, strictPort: true },
});
