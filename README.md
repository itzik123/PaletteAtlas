# Palette Atlas

Turn any image into a strip of color, and find paintings with a similar color scheme.

![The Studio: the Mona Lisa becomes a strip of color, read by color, along a Hilbert curve and from the center out, each stripe uncovering the pixels it came from](docs/studio.gif)

A static site with no server, in three parts:

- **Studio**: drop in an image, pick a path through it and get its strip. Point at the strip to see where each stripe came from, and save it as a poster or a phone wallpaper.
- **Atlas** (coming): a gallery of public-domain paintings with their strips, a "career barcode" for each artist, and search by color scheme.
- **Lab** (coming): an interactive explanation of the HNSW index behind the search.

Your images never leave your computer.

> Status: v0.1, the Studio. **Try it: [palette-atlas.pages.dev](https://palette-atlas.pages.dev)**

## How a strip is read

Each ray-traced render below becomes a strip of 128 colors, read four ways (top to bottom): left to right, from the center out, along a Hilbert curve, and by color. Every segment is the average of its pixels' light, the color they blend into from a distance.

<table>
<tr>
<td><img src="benchmark/cube.webp" width="240" alt="Cube render"></td>
<td><img src="benchmark/strips/cube-columns.png" width="448" alt="Cube, read left to right"><br><img src="benchmark/strips/cube-radial.png" width="448" alt="Cube, read from the center out"><br><img src="benchmark/strips/cube-hilbert.png" width="448" alt="Cube, read along a Hilbert curve"><br><img src="benchmark/strips/cube-color.png" width="448" alt="Cube, read by color"></td>
</tr>
<tr>
<td><img src="benchmark/chess.webp" width="240" alt="Chess render"></td>
<td><img src="benchmark/strips/chess-columns.png" width="448" alt="Chess, read left to right"><br><img src="benchmark/strips/chess-radial.png" width="448" alt="Chess, read from the center out"><br><img src="benchmark/strips/chess-hilbert.png" width="448" alt="Chess, read along a Hilbert curve"><br><img src="benchmark/strips/chess-color.png" width="448" alt="Chess, read by color"></td>
</tr>
<tr>
<td><img src="benchmark/galaxy.webp" width="240" alt="Galaxy render"></td>
<td><img src="benchmark/strips/galaxy-columns.png" width="448" alt="Galaxy, read left to right"><br><img src="benchmark/strips/galaxy-radial.png" width="448" alt="Galaxy, read from the center out"><br><img src="benchmark/strips/galaxy-hilbert.png" width="448" alt="Galaxy, read along a Hilbert curve"><br><img src="benchmark/strips/galaxy-color.png" width="448" alt="Galaxy, read by color"></td>
</tr>
<tr>
<td><img src="benchmark/spaceship.webp" width="240" alt="Spaceship render"></td>
<td><img src="benchmark/strips/spaceship-columns.png" width="448" alt="Spaceship, read left to right"><br><img src="benchmark/strips/spaceship-radial.png" width="448" alt="Spaceship, read from the center out"><br><img src="benchmark/strips/spaceship-hilbert.png" width="448" alt="Spaceship, read along a Hilbert curve"><br><img src="benchmark/strips/spaceship-color.png" width="448" alt="Spaceship, read by color"></td>
</tr>
<tr>
<td><img src="benchmark/desk.webp" width="240" alt="Desk render"></td>
<td><img src="benchmark/strips/desk-columns.png" width="448" alt="Desk, read left to right"><br><img src="benchmark/strips/desk-radial.png" width="448" alt="Desk, read from the center out"><br><img src="benchmark/strips/desk-hilbert.png" width="448" alt="Desk, read along a Hilbert curve"><br><img src="benchmark/strips/desk-color.png" width="448" alt="Desk, read by color"></td>
</tr>
<tr>
<td><img src="benchmark/laptop.webp" width="240" alt="Laptop render"></td>
<td><img src="benchmark/strips/laptop-columns.png" width="448" alt="Laptop, read left to right"><br><img src="benchmark/strips/laptop-radial.png" width="448" alt="Laptop, read from the center out"><br><img src="benchmark/strips/laptop-hilbert.png" width="448" alt="Laptop, read along a Hilbert curve"><br><img src="benchmark/strips/laptop-color.png" width="448" alt="Laptop, read by color"></td>
</tr>
</table>

## Credits

The sample paintings are in the public domain: the Mona Lisa (Louvre) by way of Wikimedia Commons, and A Sunday on La Grande Jatte, The Bedroom and The Great Wave courtesy of the Art Institute of Chicago (CC0).

## Development

Requires Node.js 24+ and pnpm.

```bash
pnpm install
pnpm --filter @palette-atlas/app exec playwright install chromium   # once, for the UI tests
pnpm build
pnpm test
```
