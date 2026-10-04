# Benchmark images

Renders from Itzik's Java ray tracer, used as the standard inputs for Palette Atlas's visual checks. All six are square, opaque WebP files.

| File | Size | What it exercises |
|---|---|---|
| `laptop.webp` | 2000 × 2000 | Muted blue-grays, a glass table and a reflection |
| `galaxy.webp` | 2000 × 2000 | Mostly black with small bright particles: the hardest case for averaging |
| `chess.webp` | 1200 × 1200 | Warm bokeh, deep shadows and render noise |
| `spaceship.webp` | 2000 × 2000 | A purple-to-blue canopy on a flat navy background |
| `desk.webp` | 2000 × 2000 | Soft lavender light, pastels and dark furniture |
| `cube.webp` | 1600 × 1600 | Saturated primaries: red, yellow, green and blue |

To see them with each mechanism's output, run `pnpm dev` and open http://localhost:5173/benchmark.html.
