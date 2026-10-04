# Palette Atlas

A static site, with no server, that turns any image into a continuous color strip and finds paintings with a similar color scheme, using an HNSW index built from scratch. Users' images never leave their computer, and the site is hosted for free on GitHub Pages.

Source: the design doc "Palette Atlas: Project Structure and Work Plan" (Oct 4, 2026). This file summarizes it; update it when decisions change.

## How we work

- Itzik is new to TypeScript: briefly explain TS concepts and tooling choices when they first come up.
- Work in small increments, one phase and one step at a time. Itzik reviews each stage as we reach it, and the plan adapts to the problems that come up.
- Start minimal: add folders, files and dependencies only when a step needs them.
- The GitHub repository (`itzik123/PaletteAtlas`) stays private until launch (v1.0). Never make it public, deploy publicly or publish anything without explicit approval.

## Commits (strict)

- One commit per cohesive change with a central theme. Only fundamentally different changes go in separate commits; never split by file or by line. For scale: the setup, the project plan, the phase 1 infrastructure and the guidelines are about 3–4 commits in total.
- Subject: a few basic words saying what changed or was added, ideally one coherent sentence, e.g. `Add OKLab conversions` or `Add X, Y and Z to CLAUDE.md`. If even a short list can't summarize it, the commit mixes unrelated themes.
- Optional description: extra context, at most 3–4 sentences.
- Credit both of us: Itzik is the commit author (from the local git config), and Claude is added with a `Co-Authored-By:` trailer.

## Design principles

- Follow SOLID and object-oriented design throughout: small classes with one responsibility, programming to interfaces, dependencies injected through constructors, composition over inheritance.
- Use design patterns wherever they fit the problem, and name the pattern in the class's doc comment so the design stays readable. Don't force a pattern where plain code is clearer; speculative generality is itself a smell.
- Avoid code smells and anti-patterns: god classes and long functions, duplicated logic, magic numbers (name them, e.g. the 843 px download width or the 256 px k-means size), deep inheritance, global mutable state and singletons.
- In hot paths (pixel loops, distance computations), objects keep bulk data in typed arrays rather than one object per pixel or vector; encapsulation stays at the object boundary.

Expected applications (names are illustrative; confirm as we reach them):

- **Strategy + open/closed**: every strip axis implements one `StripAxis` interface, so a new axis is a new class with no edits elsewhere.
- **Liskov substitution**: `HnswIndex` and the brute-force index implement one `VectorIndex` interface, so recall tests can swap them freely.
- **Observer + Null Object**: the HNSW search reports its steps to a tracer; a no-op tracer costs nothing when the Lab isn't recording.
- **Dependency inversion (ports and adapters)**: the libraries define the image types they need; the app (canvas `ImageData`) and the pipeline (PNG files) adapt their inputs to them.

## Testing

- Development is test-driven: write the failing test first, make it pass with the simplest code, then refactor.
- No overly basic tests: skip getters, plain constructors, one-line delegation and behavior the language or a library already guarantees.
- Unit tests only check baseline sanity: known reference values, round-trips and invariants (e.g. the Hilbert curve visits every pixel exactly once).
- The substantive tests are integration tests between subsystems, e.g. image → strip → vector (an identical image gives distance zero), HNSW vs. brute force on real vectors (recall@10), and the pipeline's output loading in the app.
- Reference images: `benchmark/strips` holds every axis's strip of the benchmark images, and a test compares the pipeline's output with them pixel for pixel. After an intended change, rerun `pnpm strips`, review the new images and commit them.
- A test and the code that makes it pass go in the same commit, so `main` and CI stay green.

## Phase completion

A phase is done only when both hold:

1. All key tests for the phase are written and pass, locally and in CI.
2. Itzik has visually confirmed an output that shows the system's overall sanity or the phase's new mechanism working. The "Visual check" column under Verification and each phase's deliverable say what to show.

Claude never declares a phase complete on its own: present the passing tests and the visual output, then wait for Itzik's confirmation before updating "Current phase".

## The product

- **Studio**: upload an image, pick an axis (color, space, columns or radial) and get a strip. Hovering over the strip highlights the region of the image it came from, and the strip exports as a poster or a phone wallpaper.
- **Atlas**: a gallery of public-domain paintings with their strips, a "career barcode" for each artist, and a search for paintings whose color scheme resembles an uploaded image.
- **Lab**: an interactive explanation of HNSW. Watch the graph being built and the search descending through the layers, next to the exact answer. Two modes: points on a plane, and color space itself, where each point is painted the color it represents.

## Architecture

Four TypeScript libraries with no browser dependency, shared by an offline data pipeline and the site. The same code computes the gallery's strips offline and, in the browser, the strip of the image a user uploads.

- `color`: correct averaging (linear light), k-means, color distances (OKLab) and palette ordering (exact TSP)
- `strip`: image to strip (Hilbert, TSP)
- `vectorize`: strip to vector (soft histogram, Hellinger)
- `hnsw`: index and search (search, trace)

Both sides import the same libraries:

- **pipeline** (offline, runs before each release): downloads public-domain paintings, computes strips and vectors, builds the index, and writes data files to `app/public/data`.
- **app** (in the browser, no server): Studio, Atlas and Lab, reading the pipeline's data files.

Two design decisions from day one:

- **Source map in `strip`**: every segment of the strip remembers which pixels it came from. Hover linking and fold-back are built on it. `SourceMap` holds each pixel's segment (or `NO_SEGMENT`); `Strip.read(image, axis, segments)` averages every segment in linear light, and `foldBack()` paints each segment back over its own pixels. Segments are all equally long, so an axis gives something more room by giving it more segments. `SourceMap.fromSequence` cuts any ordering of the pixels into equal runs: the Hilbert axis orders them along its curve, and the color axis along its palette path, so each color gets segments in proportion to its share.
- **Trace in `hnsw`**: every search can record its steps (visiting a node, comparing, descending a layer). The Lab only replays the record, so the animation shows the real code, not a simulation of it.

**Color spaces** (decided Oct 4, 2026, after comparing them on the benchmark images):

- **Linear light for averaging**: strip segments and any downscaling, including the 256 px shrink before k-means. We shrink images ourselves by area averaging in linear light, because canvas and `createImageBitmap` scaling usually blend the encoded sRGB values.
- **OKLab for perception**: gradients, k-means, color distances and palette ordering. k-means measures lightness through Ottosson's toe (L_r, as in Okhsl), so near-blacks that look alike share one palette color instead of taking several. Palette ordering and the color axis work in the same toe-corrected space (OKLrab), so each pixel joins the palette color k-means would put it with.

## Repository layout (target)

Folders are created as the phases need them.

```
PaletteAtlas/
├── packages/
│   ├── color/          sRGB / linear / OKLab, k-means, color ordering
│   ├── strip/          axes, source map, Hilbert fold-back
│   ├── vectorize/      strip to vector (soft histogram, Hellinger)
│   └── hnsw/           index, brute force, recall, trace, serialization
├── pipeline/
│   ├── fetch/          Python: AIC dump, filter, polite download, PNGs
│   └── build/          TypeScript (Node): strips, vectors, index build
├── notebooks/          Python: experiments and evaluation (optional)
├── benchmark/          Itzik's ray-traced renders: the standard inputs for visual checks
├── app/                Studio, Atlas, Lab
│   └── public/data/    pipeline output: binary index, metadata, thumbnails
└── .github/workflows/  tests, build, deploy to GitHub Pages
```

## Tech stack

- **UI**: plain TypeScript, no framework (decided in phase 1).
- **Build**: pnpm workspaces and Vite for the TypeScript part; a plain venv for the Python part.
- **Drawing**: Canvas 2D for strips, Three.js for the 3D view in the Lab.
- **Compute**: Web Workers for every heavy computation, so the interface never freezes.
- **Tests**: Vitest for the libraries and the pipeline, each test file next to its code as `*.test.ts`; Playwright for UI flows and for screenshots of the app compared against reference images.
- **Images in Node**: `sharp` (libvips) decodes and encodes image files in the pipeline, WebP and PNG included. Its strips of the benchmark images match the browser's exactly.
- **CI/CD**: GitHub Actions run tests, build, and publish to GitHub Pages on every push to `main`.
- **Toolchain**: Node 24 LTS, pnpm 12 (pinned by `packageManager`), TypeScript 6. Not TS 7 yet: it is very new (July 2026) and `typescript-eslint` only supports up to TS 6; revisit later.
- **Workspace conventions**: packages are named `@palette-atlas/<name>`. Shared dependency versions live in the `catalog` in `pnpm-workspace.yaml`, and packages refer to them as `"catalog:"`. Each package has its own `typecheck` and `test` scripts, plus `build` where there is something to build; the root scripts run them across the workspace.
- **Libraries ship TypeScript source**: no build step. A library's `exports` points at `src/index.ts`, and Vite, Vitest and Node 24 (built-in type stripping) all run it directly.
- **TS config**: `tsconfig.base.json` is strict and deliberately has no DOM types, so the libraries can't touch browser APIs. The app adds `DOM`, and the Node pipeline adds `node` types. `erasableSyntaxOnly` bans TS-only runtime syntax (enums, namespaces, parameter properties); use union types or `as const` objects. Nothing is compiled to JavaScript (`noEmit`), so relative imports end in `.ts`, as Node's type stripping requires. TypeScript compares classes by shape; where two classes share a shape but must not mix (e.g. color spaces), a type-only `private declare readonly brand` keeps them apart.

## Languages

The core and the site are TypeScript. Python is used only for parts that don't run in the browser and don't duplicate algorithms.

| Part | Language | Why |
|---|---|---|
| Libraries: color, strip, vectorize, hnsw | TypeScript | They run both in the browser and in the pipeline, so user strips and gallery strips come from the same code |
| Site: Studio, Atlas, Lab | TypeScript | Only JavaScript and WebAssembly run in the browser |
| Data build (`pipeline/build`) | TypeScript (Node) | Builds strips, vectors and the index with the same libraries |
| Data download (`pipeline/fetch`) | Python | Filters the data dump, downloads politely and shrinks images to PNG; none of the project's algorithms live here |
| Notebooks (optional) | Python | Compare vector representations and chart recall vs. speed; whatever is chosen gets implemented in TypeScript |

- The contract between download and build is a folder of PNGs plus a JSON metadata file, so neither side depends on the other's code.
- C++ through WebAssembly stays an option for later, only if measurements show a bottleneck.

## Work phases

Seven phases, each ending in something you can show. **Current phase: 2 (Color library and strip engine).**

1. **Infrastructure** (1 weekend): monorepo, CI, and deployment of an empty page to GitHub Pages. From here on, every push goes live. *Deployment is deferred for now; phase 1 covers the monorepo, CI and the empty page.* Done Oct 4, 2026.
2. **Color library and strip engine** (2–3 weekends): OKLab conversions and correct averaging, k-means, a column axis and a radial axis, a color axis with TSP ordering, and a Hilbert axis with fold-back. Deliverable: correct strips generated from a script, covered by tests.
3. **Studio, first release v0.1** (2 weekends): image upload, axis switching, hover linking between strip and image, and PNG export. A README with a GIF and a link to the site. The first moment to share.
4. **Data pipeline and gallery** (2–3 weekends): download public-domain paintings, compute their strips, a gallery page, and a career barcode for each artist.
5. **HNSW and search, v0.2** (3–4 weekends): implementation from scratch, brute force for checking, recall measurement, saving to a binary file, and building the index in the pipeline. In the browser: upload an image and get the closest paintings.
6. **Lab** (3–5 weekends): the search trace becomes an animation, in plane mode and in color-space mode. Controls for `M` and `ef`, and failure scenarios, such as clustered data without the neighbor-selection heuristic.
7. **Polish and launch, v1.0** (1–2 weekends): performance, mobile, accessibility, a GIF for each part, and a launch post.

After v1: video (decoded in the browser with WebCodecs) and personal photo albums.

## Verification

Every part gets an automated test that runs in CI, and a screen where you can see with your own eyes that it works. Visual checks run on the six benchmark images in `benchmark/`, on a dev-only page (`app/benchmark.html`) that grows with each step and stays out of the production build.

| Part | Automated test | Visual check |
|---|---|---|
| color | A round-trip conversion returns the same color within a negligible error; known OKLab reference values | A gradient between two colors in sRGB vs. OKLab, one above the other |
| strip | Hilbert fold-back at full resolution restores the image pixel for pixel; reference strips for every axis (`benchmark/strips`) | Hovering over the strip highlights the source region in the image |
| vectorize | An identical image gives distance zero; a small color change gives a small distance | The nearest results and their strips next to the query strip |
| hnsw | recall@10 vs. brute force above a set target (e.g. 0.95); deterministic build with a seed | In the Lab: the true neighbors marked next to what HNSW found |
| pipeline | Only works marked as public domain; record counts and file schema | A check page with 20 random works and their strips |
| app | Playwright: upload, axis switch, export | A manual pass on a phone before every release |

## Open decisions and risks

- **Scope** is the main risk. The Lab is the heavy part, so it comes after there is already a product that stands on its own.
- **Vector representation**: start with a soft histogram over a color vocabulary in OKLab, with Hellinger distance. Take the square root of each proportion and use plain Euclidean distance, so HNSW needs no special metric. A 3×3 grid of average colors can be added so layout counts too; decide by what looks right in the gallery.
- **Non-square images** (decided Oct 4, 2026): the classic Hilbert curve is defined on a square whose side is a power of 2, so the Hilbert axis uses Jakub Červený's generalized curve ("gilbert"), which fills any rectangle without jumps (at most one diagonal step) and matches the classic curve on those squares. No padding or cropping.
- **Data size in the browser**: tens of thousands of vectors and their graph can reach tens of megabytes. Fix: uint8 quantization, lazy loading, and starting from a subset of paintings.
- **Museum data**: the Art Institute of Chicago (AIC) releases over 50,000 images under CC0 and asks for credit of artist, title and date. Its API docs recommend filtering the nightly data dump rather than querying the API, and downloading images one at a time, a second apart, at width 843.
- **Performance**: downscale an image to about 256 px before k-means (area averaging in linear light, see Color spaces), and run it in a Worker.
- **GitHub Pages while private** (not in the design doc): Pages on a private repo needs a paid plan (e.g. GitHub Pro through the Student Developer Pack), and the published site is public even when the repo is private. Deferred: not a concern for now; revisit when deployment becomes relevant.

## What the project teaches

- Color science: gamma, linear light, OKLab, and why averaging raw sRGB values gives a dark, muddy strip.
- Algorithms and geometry: space-filling curves, k-means, and the TSP solved exactly by dynamic programming (Held-Karp).
- Vector search: HNSW from scratch, the trade-off between recall and speed, binary serialization.
- Web engineering: Web Workers, Canvas and Three.js, performance with heavy data in the browser.
- Infrastructure: monorepo, CI/CD, visual tests, a data pipeline you can rerun.

## Commands

```bash
pnpm install     # install all dependencies
pnpm dev         # run the app locally at http://localhost:5173 (visual checks: /benchmark.html)
pnpm build       # build every workspace package
pnpm test        # run every package's tests
pnpm typecheck   # type-check every package
pnpm strips      # write the benchmark images' strips to benchmark/strips, the tests' reference images
```

Development happens on Windows (PowerShell). `.gitattributes` keeps every text file LF.

## Sources

- [Art Institute of Chicago: Open Access Images](https://www.artic.edu/open-access/open-access-images)
- [Art Institute of Chicago API: Documentation](https://api.artic.edu/docs)
