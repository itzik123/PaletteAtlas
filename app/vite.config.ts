import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import { linkPreviews } from './link-previews.ts';

/** Where GitHub Pages serves the site, the address its link previews name their pictures by. */
const SITE_URL = 'https://itzik123.github.io/PaletteAtlas/';

// Relative asset paths, so the built site works wherever it is served: at the root of a local
// preview, and under /PaletteAtlas/ on GitHub Pages.
// The site's pages: the Studio, the Atlas, a page for each of the Atlas's paintings and for each
// artist's Career Barcode, and the Lab. The benchmark page stays out of the build: it is for development only.
export default defineConfig({
  base: './',
  plugins: [linkPreviews(SITE_URL)],
  build: {
    rollupOptions: {
      input: {
        studio: resolve(import.meta.dirname, 'index.html'),
        atlas: resolve(import.meta.dirname, 'atlas.html'),
        painting: resolve(import.meta.dirname, 'painting.html'),
        artist: resolve(import.meta.dirname, 'artist.html'),
        lab: resolve(import.meta.dirname, 'lab.html'),
      },
    },
  },
});
