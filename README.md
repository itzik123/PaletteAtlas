# Palette Atlas

Turn any image into a continuous color strip, and find paintings with a similar color scheme.

A static site with no server, in three parts:

- **Studio**: upload an image, pick an axis and get a strip you can export as a poster or a phone wallpaper.
- **Atlas**: a gallery of public-domain paintings with their strips, a "career barcode" for each artist, and search by color scheme.
- **Lab**: an interactive explanation of the HNSW index behind the search.

Your images never leave your computer.

> Status: early development.

## Development

Requires Node.js 24+ and pnpm.

```bash
pnpm install
pnpm build
pnpm test
```
