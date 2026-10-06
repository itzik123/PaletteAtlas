import { resolve } from 'node:path';
import { defineConfig } from 'vite';

// Relative asset paths, so the built site works wherever it is served: at the root of a local
// preview or of Cloudflare Pages, and under /PaletteAtlas/ on GitHub Pages once the repo is public.
// The site's pages: the Studio, the Atlas, and a page for each of the Atlas's paintings. The
// benchmark and mockup pages stay out of the build: they are for development only.
export default defineConfig({
  base: './',
  build: {
    rollupOptions: {
      input: {
        studio: resolve(import.meta.dirname, 'index.html'),
        atlas: resolve(import.meta.dirname, 'atlas.html'),
        painting: resolve(import.meta.dirname, 'painting.html'),
      },
    },
  },
});
