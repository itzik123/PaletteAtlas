import { defineConfig } from 'vite';

// Relative asset paths, so the built site works wherever it is served: at the root of a local
// preview or of Cloudflare Pages, and under /PaletteAtlas/ on GitHub Pages once the repo is public.
export default defineConfig({ base: './' });
