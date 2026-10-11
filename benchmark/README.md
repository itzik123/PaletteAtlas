# Benchmark images

Renders from Itzik's Java ray tracer, used as the standard inputs for Palette Atlas's visual checks. All six are square, opaque WebP files. They and their strips are licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), unlike the code (MIT).

| File | Size | What it exercises |
|---|---|---|
| `laptop.webp` | 2000 × 2000 | Muted blue-grays, a glass table and a reflection |
| `galaxy.webp` | 2000 × 2000 | Mostly black with small bright particles: the hardest case for averaging |
| `chess.webp` | 1200 × 1200 | Warm bokeh, deep shadows and render noise |
| `spaceship.webp` | 2000 × 2000 | A purple-to-blue canopy on a flat navy background |
| `desk.webp` | 2000 × 2000 | Soft lavender light, pastels and dark furniture |
| `cube.webp` | 1600 × 1600 | Saturated primaries: red, yellow, green and blue |

To see them with each mechanism's output, run `pnpm dev` and open http://localhost:5173/benchmark.html.

`strips/` holds each image's strip along every axis (`<image>-<axis>.png`), written by `pnpm strips` with the benchmark page's settings. They are the reference images for the tests: after an intended change to the strips, rerun `pnpm strips`, review the new files and commit them.
