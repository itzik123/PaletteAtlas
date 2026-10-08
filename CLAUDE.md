# Palette Atlas

A static site, with no server, that turns any image into a continuous color strip and finds paintings with a similar color scheme, using an HNSW index built from scratch. Users' images never leave their computer, and the site is hosted for free: on Cloudflare Pages while the repo is private, on GitHub Pages once it goes public.

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
- Avoid code smells and anti-patterns: god classes and long functions, duplicated logic, magic numbers (name them, e.g. the 500 px download width or the 256 px k-means size), deep inheritance, global mutable state and singletons.
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
- Reference images: `benchmark/strips` holds every axis's strip of the benchmark images, and tests compare the pipeline's output and the Studio's strips with them pixel for pixel. After an intended change, rerun `pnpm strips`, review the new images and commit them.
- UI tests (Playwright) live in `app/e2e` and run against the production build (`vite build && vite preview`) in Playwright's own Chromium, which each machine installs once (see Commands).
- A test and the code that makes it pass go in the same commit, so `main` and CI stay green.

## Phase completion

A phase is done only when both hold:

1. All key tests for the phase are written and pass, locally and in CI.
2. Itzik has visually confirmed an output that shows the system's overall sanity or the phase's new mechanism working. The "Visual check" column under Verification and each phase's deliverable say what to show.

Claude never declares a phase complete on its own: present the passing tests and the visual output, then wait for Itzik's confirmation before updating "Current phase".

## The product

- **Studio**: upload an image, pick an axis (color, Hilbert, columns or radial) and get a strip. Hovering over the strip highlights the region of the image it came from (and hovering over the image pins the segment each pixel went into), and the strip exports as a poster or a phone wallpaper.
- **Atlas**: a gallery of public-domain paintings with their strips, a "career barcode" for each artist, and a search for paintings whose color scheme resembles an uploaded image.
- **Lab**: an interactive explanation of HNSW. Watch the very search that found an image's paintings descend through the index's layers, every painting a dot of its own color, next to the exact answer.

## Site design

Decided Oct 5, 2026, at the start of phase 3:

- **Bold, like a cut-paper poster**: cream paper, ink-black outlines 3–4 px thick, hard offset shadows that press down when clicked, and a painter's bold colors (vermilion, cobalt, cadmium yellow, green, pink) in big geometric shapes. The colors are tokens on `:root` in `app/src/style.css`.
- **Big, heavy type**: Bricolage Grotesque, a variable font, self-hosted through Fontsource, so no request goes out to a font server.
- **Few words**: icons and shapes carry the interface. The explanation waits behind the "How it works" button in the header, beside a link to the GitHub repository; it explains the page it is on (the Studio, the Atlas, a painting's strips or the Career Barcodes) in three short steps (`explanations.ts`).
- **Images come in every way**: dropped anywhere on the page, chosen in the file picker, pasted, or picked from the sample wall: four famous public-domain paintings (the Mona Lisa from Wikimedia Commons, three CC0 works from the AIC), each in a flat version of its museum's frame, credited in "How it works". A feature that can't fit this look is left out rather than added anyway.
- **The Studio fits the window** (Oct 8, 2026): on a desktop, the Studio fills the window under the header, empty or with an image, and never scrolls: the drop zone and the picture's card take the height the rest leaves (checked at 1280×720, 1440×800, 1536×730 and 1920×950, and in windows as short as 1024×650 and 1280×620, where the headline and the axis buttons slim down).
- **Studio | Atlas** (Oct 6, 2026): a two-tab switch in the header, which floats at the bottom of the screen on a phone (below 760 px, where the name and the buttons shrink with the narrowest screens to fit beside each other). The site's name leads to the opening page of the part it is in: the Studio, or the Atlas's wall. The Atlas is a wall of paintings at their own shapes in justified rows, each over its color strip, with a museum label on hover (chosen over a card grid and a shelf of strips), and coming back to it from a painting returns to the same place on the wall. Each painting has its own page, with nothing over the picture: the picture on a card, and beside it "← Atlas" and "Open in Studio" side by side, styled as the header's buttons above them, then the details, the four strips and the paintings in the same colors (see Search by color). A click on the picture enlarges it over the darkened page, as large as fits, in one of six flat museum frames picked for that painting, rising into place; a click anywhere or Escape puts it away (`PictureLightbox`). Every painting's page fits a desktop window without scrolling (checked for all of them at 1280×720, 1440×800, 1536×730 and 1920×950). A painting wider than 2:1 spans the page with the rest below it, and one too wide to see whole (a handscroll) pans sideways.
- **Career Barcode** (Oct 6, 2026): each artist's page (`artist.html?id=`) draws their career as a barcode, every painting one bar of the same width, oldest first (chosen over a timeline with the years to scale and a skyline of each year's paintings piled up). A painting has a place in it if Wikidata dates it to the year or the decade (placed in the decade's middle) within the artist's life; 698 of the 9,071 artists have none. A switch shows each bar as the painting's color strip on end, darker end at the bottom (first), or as its average color. The barcode takes the height the artist's name leaves on the screen, so the page fits a desktop window like a painting's; pointing at a bar shows the painting's museum label, and a click opens its page. Every painting's page leads there by a barcode button beside the artist's name, with a "Career Barcode" tooltip, unless the artist has no career.
- **Career Barcodes** (Oct 6, 2026): a pill beside the Studio | Atlas switch on the Atlas's wall and on the Career Barcodes themselves (below 940 px, where the header has no room for it, its barcode icon alone beside "How it works", Oct 8, 2026, so a phone's wall begins under the headline and "Match an image" alone; a painting's page leaves it out, as it leads to its own artist's) opens the artist page at the most famous painter, with every painter who has a career listed on a card beside it (a sheet over the page on a phone, behind a "Painters" button): the 24 most famous first, then A to Z by family name as museums file them (`fileName`: Vincent van **Gogh** under G, **Leonardo** da Vinci under L), with a rail of letters to press or slide along. The search forgives words in any order, accents, a slip or two and a middle name the gallery leaves out, the best match first (`NameSearch`); a slip counts for less from a word some painter's name has as typed ("gogh" isn't "Gotha"). A painter picked shows in place, in the fill picked before, the name as large as fits one line so the barcode keeps its place; ← and → (or the buttons at the top, which name where they lead) go to the painter before and after in the list, and the address follows the painter shown. The list's 8,400 names are laid out only as they come into sight, where the browser supports scroll anchoring.
- **Search by color** (Oct 7, 2026, mocked in the real pages first): under the Atlas's headline, a yellow "Match an image" pill and a word on what it does ("Drop in any image to find paintings in its colors."; chosen over the pill on the headline's own line and beside Career Barcodes). An image dropped anywhere on the Atlas, pasted or chosen there, or sent by the Studio's yellow "Find paintings" tab on its strip, opens the wall of the 600 paintings nearest its colors, the nearest first and a quarter larger than the gallery's (`atlas.html?match`), under the image on an upright card beside "Painted in these colors." and "All paintings"; the words "these colors." stand on the image's color strip, as wide as they are (Oct 8, 2026). Its color strip and a small copy of it travel through the tab's session storage and stay in that page's history entry (`ImageQueries`), so a painting's "← Atlas", the back button and reloading all find the same matches; nothing leaves the browser.
- **Same colors** (Oct 7, 2026): every painting's page shows the paintings nearest its colors under its strips, in one row as tall as the room left (56 to 110 px) so the page still fits the window, their labels opening above them; with less room (most wide paintings, a quarter of the pages at 1280×720), a "Same colors" button instead, and on the few pages with no room even for that, nothing. Both lead to the Atlas's wall searched by that painting (`atlas.html?like=<id>`), the painting on the card. On a phone, a few rows across the page. Checked on every painting's page at 1280×720, 1440×800, 1536×730 and 1920×950: none scrolls. A label near a row's end slides back within the row, so no page pans sideways (checked on every painting's page at 320, 360, 390, 900 and 1280 px wide).

## Architecture

TypeScript libraries with no browser dependency, shared by an offline data pipeline and the site. The same code computes the gallery's strips offline and, in the browser, the strip of the image a user uploads.

- `color`: correct averaging (linear light), k-means, color distances (OKLab) and palette ordering (exact TSP)
- `strip`: image to strip (Hilbert, TSP)
- `vectorize` (added Oct 7, 2026): color strip to vector, the sliced Wasserstein embedding, compared by mean absolute difference (see Vector representation)
- `hnsw` (added Oct 7, 2026): index and search (search, trace), self-contained: it depends on no other library, takes vectors of any length (2 on the benchmark page's plane, 128 for the paintings), and is handed its distance (Strategy), the random numbers its build draws and, if any, the landmarks for its top layer
- `gallery` (added Oct 6, 2026): the gallery's data format, which the pipeline writes and the site reads: paintings stored by column, color strips packed into chunk images, Commons links rebuilt from file names (`CommonsImage`), the artists' careers, their paintings in the order made (`careers`), and the paintings' map for the Lab (`PaintingMap`)

Both sides import the same libraries:

- **pipeline** (offline, runs before each release): downloads public-domain paintings (Wikidata and Wikimedia Commons, see Painting data), computes strips and vectors, builds the index, and writes data files to `app/public/data`.
- **app** (in the browser, no server): Studio, Atlas and Lab, reading the pipeline's data files.

Both read strips through `ImageStrips.read(image)` in `strip`, the one place that holds the recipe and its settings (shrink to 256 px, a palette of 8 or more colors with a fixed seed, 128 segments per axis), so a gallery strip and a user's strip always come out the same way.

Two design decisions from day one:

- **Source map in `strip`**: every segment of the strip remembers which pixels it came from. Hover linking and fold-back are built on it. `SourceMap` holds each pixel's segment (or `NO_SEGMENT`); `Strip.read(image, axis, segments)` averages every segment in linear light, and `foldBack()` paints each segment back over its own pixels. Segments are all equally long, so an axis gives something more room by giving it more segments. `SourceMap.fromSequence` cuts any ordering of the pixels into equal runs: the radial axis orders them by distance from the center (so its rings have equal area), the Hilbert axis along its curve, and the color axis along its palette path, so each color gets segments in proportion to its share.
- **Trace in `hnsw`**: every search can record its steps (visiting a node, comparing, descending a layer). The Lab only replays the record, so the animation shows the real code, not a simulation of it. Built Oct 7, 2026: a search reports to a `SearchTracer` (Observer) the layer it enters, each node it measures, each node whose links it follows, and the nodes that join and leave its nearest so far (the paper's W); `SearchRecorder` keeps the steps, and searches no one watches report to `SILENT_TRACER` (Null Object), which timed within noise of no tracer at all. The benchmark page replays a search over 1,500 points on a plane, layer by layer.

**Color spaces** (decided Oct 4, 2026, after comparing them on the benchmark images):

- **Linear light for averaging**: strip segments and any resizing, including the 256 px shrink before k-means and the career barcodes (across their bars; down a bar, a fill's few rows are only stretched to the screen, never blended). We resize images ourselves by area averaging in linear light (`resize`), because canvas and `createImageBitmap` scaling usually blend the encoded sRGB values.
- **OKLab for perception**: gradients, k-means, color distances and palette ordering. k-means measures lightness through Ottosson's toe (L_r, as in Okhsl), so near-blacks that look alike share one palette color instead of taking several. Palette ordering and the color axis work in the same toe-corrected space (OKLrab), so each pixel joins the palette color k-means would put it with.
- **Palettes cover their image** (decided Oct 4, 2026, after the Phase 2 audit): k-means alone folds a small distinct accent (the cube's green spheres) into a large cluster nearby, and its pixels then show as a foreign band inside that color's stretch of the strip. So a palette starts at 8 colors and grows while more than 0.5% of the pixels lie farther than 0.15 from every palette color, up to the 16 that Held-Karp orders (`CoveringKMeans`, `PALETTE_COVERAGE`).

## Repository layout (target)

Folders are created as the phases need them.

```
PaletteAtlas/
├── packages/
│   ├── color/          sRGB / linear / OKLab, k-means, color ordering
│   ├── strip/          axes, source map, Hilbert fold-back
│   ├── vectorize/      strip to vector (sliced Wasserstein)
│   ├── hnsw/           index, brute force, recall, trace, serialization
│   └── gallery/        the gallery's data format: chunks, columns, Commons links
├── pipeline/
│   ├── fetch/          Python: Wikidata catalog, Commons licenses, polite download
│   ├── build/          TypeScript (Node): strips, vectors, index build
│   └── data/           downloaded paintings and their metadata (not in git)
├── notebooks/          Python: experiments and evaluation (optional)
├── benchmark/          Itzik's ray-traced renders: the standard inputs for visual checks
├── docs/               README media (the Studio GIF) and research notes
├── app/                Studio, Atlas, Lab
│   ├── e2e/            Playwright UI tests
│   └── public/data/    pipeline output: metadata, strips, vectors, binary index
└── .github/workflows/  tests, build, deploy
```

## Tech stack

- **UI**: plain TypeScript, no framework (decided in phase 1).
- **Build**: pnpm workspaces and Vite for the TypeScript part. The Python part uses only the standard library (Python 3.14), so it needs no packages and no venv yet.
- **Drawing**: Canvas 2D, for the strips and for the Lab's layers (Three.js was planned for a 3D color-space view in the Lab, dropped Oct 8, 2026).
- **Compute**: Web Workers for every heavy computation, so the interface never freezes.
- **Tests**: Vitest for the libraries, the pipeline's build and the app's pure modules (the painters' name filing and search), each test file next to its code as `*.test.ts`; `unittest` for the Python fetch step, likewise as `*_test.py`; Playwright for UI flows and for screenshots of the app compared against reference images.
- **Images in Node**: `sharp` (libvips) decodes and encodes image files in the pipeline, WebP and PNG included. Its strips of the benchmark images match the browser's exactly.
- **CI/CD**: GitHub Actions run tests and build on every push, and every green push to `main` publishes the tested build: to Cloudflare Pages (with `wrangler`) while the repo is private, to GitHub Pages once it is public. Only the deploy job changes between the two.
- **Toolchain**: Node 24 LTS, pnpm 12 (pinned by `packageManager`), TypeScript 6. Not TS 7 yet: it is very new (July 2026) and `typescript-eslint` only supports up to TS 6; revisit later.
- **Workspace conventions**: packages are named `@palette-atlas/<name>`. Shared dependency versions live in the `catalog` in `pnpm-workspace.yaml`, and packages refer to them as `"catalog:"`. Each package has its own `typecheck` and `test` scripts, plus `build` where there is something to build; the root scripts run them across the workspace.
- **Libraries ship TypeScript source**: no build step. A library's `exports` points at `src/index.ts`, and Vite, Vitest and Node 24 (built-in type stripping) all run it directly.
- **TS config**: `tsconfig.base.json` is strict and deliberately has no DOM types, so the libraries can't touch browser APIs. The app adds `DOM`, its Web Workers (`app/src/workers`, with their own tsconfig) add `WebWorker` instead, and the Node pipeline adds `node` types. `erasableSyntaxOnly` bans TS-only runtime syntax (enums, namespaces, parameter properties); use union types or `as const` objects. Nothing is compiled to JavaScript (`noEmit`), so relative imports end in `.ts`, as Node's type stripping requires. TypeScript compares classes by shape; where two classes share a shape but must not mix (e.g. color spaces), a type-only `private declare readonly brand` keeps them apart.

## Languages

The core and the site are TypeScript. Python is used only for parts that don't run in the browser and don't duplicate algorithms.

| Part | Language | Why |
|---|---|---|
| Libraries: color, strip, vectorize, hnsw | TypeScript | They run both in the browser and in the pipeline, so user strips and gallery strips come from the same code |
| Site: Studio, Atlas, Lab | TypeScript | Only JavaScript and WebAssembly run in the browser |
| Data build (`pipeline/build`) | TypeScript (Node) | Builds strips, vectors and the index with the same libraries |
| Data download (`pipeline/fetch`) | Python | Queries Wikidata, checks each file's license on Commons and downloads politely; none of the project's algorithms live here |
| Notebooks (optional) | Python | Compare vector representations and chart recall vs. speed; whatever is chosen gets implemented in TypeScript |

- The contract between download and build is a folder of images, as Commons serves them, plus a JSON metadata file (`pipeline/data/wikidata`), so neither side depends on the other's code.
- C++ through WebAssembly stays an option for later, only if measurements show a bottleneck.

## Work phases

Seven phases, each ending in something you can show. **Current phase: 6 (Lab).**

1. **Infrastructure** (1 weekend): monorepo, CI, and deployment of an empty page to GitHub Pages. From here on, every push goes live. *Deployment was deferred; phase 1 covered the monorepo, CI and the empty page, and the site went live in phase 3 (see Hosting while private).* Done Oct 4, 2026.
2. **Color library and strip engine** (2–3 weekends): OKLab conversions and correct averaging, k-means, a column axis and a radial axis, a color axis with TSP ordering, and a Hilbert axis with fold-back. Deliverable: correct strips generated from a script, covered by tests. Done Oct 4, 2026.
3. **Studio, first release v0.1** (2 weekends): image upload, axis switching, hover linking between strip and image, and PNG export. A README with a GIF and a link to the site. The first moment to share. Done Oct 5, 2026: live at https://palette-atlas.pages.dev, with a sample wall of famous paintings and poster and wallpaper export.
4. **Data pipeline and gallery** (2–3 weekends): download about 50,000 public-domain paintings, compute their strips, a gallery page, and a career barcode for each artist. Done Oct 7, 2026: the Atlas shows 48,695 paintings, each with its own page, and 8,373 artists' Career Barcodes.
5. **HNSW and search, v0.2** (3–4 weekends): implementation from scratch, brute force for checking, recall measurement, saving to a binary file, and building the index in the pipeline. In the browser: upload an image and get the closest paintings. Steps (planned Oct 7, 2026, after the research in `docs/search-research.md`): `vectorize`; the HNSW index with brute force and recall on real paintings; the search trace; the binary file; the index built by the pipeline; the search in the browser, its look mocked in the real page first. Done Oct 8, 2026, released as v0.2: any image matched on the Atlas, or sent from the Studio, hangs the 600 paintings nearest its colors, and every painting's page shows its own; the index (48,695 paintings) downloads once as 5.4 MB and answers each search in about a millisecond.
6. **Lab** (3–5 weekends): the search trace becomes an animation. Decided Oct 8–9, 2026, after mockups in the real pages (made-up points on a plane with controls for `M` and `ef`, a color-space mode, and a separate site for programmers were mocked and dropped; nothing to tinker with): the Lab is the site's third part (Studio | Atlas | Lab) and replays the Atlas's own search, `search(vector, 601)` over the gallery's index, for an image matched on the Atlas (a "How they were found" button on its wall), an image handed to the Lab, or a painting (`lab.html?like=<id>`). The layers are a stack of card boards, each painting a dot of its average color on a map of the two principal components of the search vectors (92.5% of their variance); the image rides a pin down through the boards, a magnifier shows the bottom layer around it from above, and the 10 nearest stand beside the stack as the Atlas's tiles, checked against brute force. Steps: landmarks on the index's top layer (see Search index); the paintings' map and colors written by the pipeline; the traced search in the search worker; the Lab page; the way in from the Atlas; phones and How it works.
7. **Polish and launch, v1.0** (1–2 weekends): performance, mobile, accessibility, a GIF for each part, and a launch post.

After v1: video (decoded in the browser with WebCodecs) and personal photo albums.

## Verification

Every part gets an automated test that runs in CI, and a screen where you can see with your own eyes that it works. Visual checks run on the six benchmark images in `benchmark/`, on a dev-only page (`app/benchmark.html`) that grows with each step and stays out of the production build.

| Part | Automated test | Visual check |
|---|---|---|
| color | A round-trip conversion returns the same color within a negligible error; known OKLab reference values | A gradient between two colors in sRGB vs. OKLab, one above the other |
| strip | Hilbert fold-back at full resolution restores the image pixel for pixel; reference strips for every axis (`benchmark/strips`) | Hovering over the strip highlights the source region in the image |
| vectorize | An identical image gives distance zero; a small color change gives a small distance; never farther than the Earth Mover's Distance | The nearest results and their strips next to the query strip |
| hnsw | recall@10 vs. brute force of at least 0.95, on real paintings too; every painting finds itself; deterministic build with a seed | In the Lab: the true neighbors marked next to what HNSW found; until then, a search replayed layer by layer on the benchmark page |
| pipeline | Only files Commons marks public domain or CC0; record counts and file schema | A check page with 20 random works and their strips |
| app | Playwright: upload, axis switch, export; an image matched on the Atlas or sent from the Studio hangs its nearest paintings first, and a painting's page shows its own, never itself | A manual pass on a phone before every release |

## Open decisions and risks

- **Scope** is the main risk. The Lab is the heavy part, so it comes after there is already a product that stands on its own.
- **Vector representation** (decided Oct 7, 2026, replacing the design doc's soft histogram with Hellinger distance; measurements and sources in `docs/search-research.md`): a painting's color strip is a distribution of color in 128 equal shares, and the Earth Mover's Distance between two such distributions in OKLrab is the classic measure of how alike two color schemes look (Rubner et al., 2000), but too slow to compare a query with every painting. Its sliced form is fast: the vector projects the strip's colors onto 8 directions, sorts them and averages them over 16 equal shares (128 numbers), and two vectors' mean absolute difference (L1) is the Earth Mover's Distance along each direction, averaged, which never exceeds the true one. On 240 gallery queries its 10 nearest held 78% of the exact Earth Mover's top 10 and lay only 2% farther by it; the soft histogram held 45%, 14% farther. L1 tracks the Earth Mover's Distance; Euclidean tracks its squared-cost cousin (W2) instead. Only color counts, not layout: the gallery stores the color strip alone.
- **Search index** (measured Oct 7, 2026): HNSW over the 48,695 vectors (M = 16, efConstruction = 200) builds in 39 s in Node and finds the true 10 nearest at ef = 32 in 0.25 ms; brute force takes 14 ms. The vectors' intrinsic dimension is about 11, low enough that the layers speed the search up (they stop helping above about 32). The index is saved as one binary file (`toBytes`, decided Oct 7, 2026): the graph and the vectors, a byte per number with a range per dimension, and each node's links sorted and stored as the gaps between them in variable-length integers (as Lucene does). For the paintings that is 7.9 MB (6.2 MB of vectors, 1.65 MB of links), read in 0.12 s; read back, it still finds 98% of the true 10 nearest. The browser could compute the vectors from the color strips instead, but that takes about 3 s after downloading every strip (7.3 MB), so the file carries them. In the browser, a Web Worker reads the index once and answers every search in about a millisecond (`ColorSearch`, a Remote Proxy like the Studio's `StripReader`; both talk to their workers through `WorkerChannel`). Cloudflare Pages doesn't compress a binary file (`application/octet-stream`, checked Oct 7, 2026), so the pipeline gzips it (`search-index.bin.gz`) and the worker unzips it, unless the host has already (Vite serves it as `Content-Encoding: gzip`). Its second version (Oct 7, 2026) lays the vectors out for that, dimension by dimension, each byte as its difference from the dimension before, which gzip shrinks to 3.8 MB rather than 5.5: a first search downloads 5.4 MB instead of 7.9 (brotli on the first layout gave 5.7, and browsers can't unzip brotli themselves). Since matches lie all over the gallery, the wall's first 60 load most of its chunks too (about 200 KB each).
- **Landmarks on the index's top layer** (decided Oct 9, 2026, for the Lab): the random draw left 2 paintings on the top layer, where every search starts (48,695 / 3,021 / 184 / 12 / 2 by layer), which showed nothing and helped little: the four upper layers cost about 65 of a search's 2,556 measurements. The top layer now holds 8 landmarks (`HnswOptions.landmarks`), the most typical painting of each color family (`landmarks` in the pipeline: k-means over the paintings' mean colors in OKLrab, then the painting whose vector lies nearest its family's mean), from near-black to near-white; every other painting keeps its drawn layer, below them. On 1,200 queries searches measured as much as before (2,558 against 2,556) and found all of the true 10; landmarks as far apart as possible (black, white, the outermost colors) cost 10 measurements more. The textbook leaves every layer to chance; this is a deliberate change.
- **The paintings' map** (Oct 9, 2026, for the Lab): the Lab draws each layer as a map of the paintings, the plane of the two directions in which their color scheme vectors differ most (principal components, `MapProjection`), which holds 92.5% of the vectors' variance; a painting's 10 nearest lie on it, on average, at 6.7% of its distance to the rest of the gallery. Lighter paintings lie to the right, warmer ones to the front, and each is drawn in its color strip's average in linear light. The pipeline writes it with the search index (`painting-map.bin.gz`: each place in 16 bits per axis, each color in 3 bytes, and the projection, which places a visitor's image on the same map), 0.33 MB, where the mockup drew the colors from every strip (7.3 MB).
- **Non-square images** (decided Oct 4, 2026): the classic Hilbert curve is defined on a square whose side is a power of 2, so the Hilbert axis uses Jakub Červený's generalized curve ("gilbert"), which fills any rectangle without jumps (at most one diagonal step) and matches the classic curve on those squares. No padding or cropping.
- **Data size in the browser**: 50,000 vectors and their graph can reach tens of megabytes. Fix: uint8 quantization and loading in chunks as needed. The strips were settled on Oct 6, 2026: only the color axis ships (about 7.5 MB for 50,000), and pages load a chunk at a time. The careers repeat the dated paintings and their strips in each artist's order (about 14 MB more), so an artist's page loads a chunk or two rather than the whole gallery.
- **Painting data** (decided Oct 5, 2026, at the start of phase 4; replaces the design doc's AIC data dump): the AIC has only 1,875 public-domain paintings with images, too few to find a painting that truly resembles a user's photo, and too few to give HNSW a real job. Five museum APIs together (the Met, Rijksmuseum, SMK, Cleveland, AIC) hold about 30,000; Wikidata lists 247,000 paintings with a Commons image by artists who died over 70 years ago, from hundreds of museums. So:
  - **Catalog**: Wikidata, queried through QLever (`qlever.dev/api/wikidata`), which returns the whole catalog in about 25 s; the official query service times out at 60 s on it. A painting qualifies with one artist, an image, a collection and a date, its artist dead for 70 years or more.
  - **Selection**: about 50,000 (a setting), the most famous first (by how many Wikipedias have an article on it), then a seeded draw from the rest.
  - **Licenses**: only files Commons marks `pd` or `cc0`, which it checks for both the US and the source country, at least 500 px wide. Photos that claim their own license (e.g. CC BY-SA) are left out, and black-and-white photos are dropped by the build.
  - **Download**: 500 px thumbnails, one at a time and resumable, within Wikimedia's robot policy (at most 2 at once, standard thumbnail sizes only, a User-Agent naming the site).
  - **Hosting** (decided Oct 6, 2026): the site loads pictures straight from Commons at its standard widths (thumbnails from `thumb.wikimedia.org`, a file no wider than asked from `upload.wikimedia.org`), since 50,000 files exceed Cloudflare Pages' 20,000-file limit and don't belong in git. Git holds what the pipeline computes, in `app/public/data`: metadata stored by column, 1,000 paintings a chunk, and only the color strips, packed 1,000 to an RGB PNG (about 150 KB). The painting page reads the other three axes live from the same 500 px image the pipeline read. Links are rebuilt from each file's name, hash and width by MediaWiki's thumbnail rules; the 9 TIFFs whose thumbnails break them are left out. Each painting is credited with artist, title, date, collection and Wikimedia Commons.
  - **Order** (decided Oct 6, 2026): the most famous first. A short held-back list (`HELD_BACK` in the pipeline) moves a painting out of the opening screens: Courbet's *L'Origine du monde* comes at position 500.
  - **Quality varies**: in a random sample of 24, 17 were clean photos; the rest were black and white, framed, photographed in place or a drawing. The check page measures it; the museums' own images for the same works stay an option for later.
  - **Color profiles**: the pipeline applies a file's embedded ICC profile as browsers do, so a painting keeps its true colors. For the files with a wide-gamut profile (Adobe RGB and the like, about 15% of the first 2,900 downloads), libvips (LittleCMS) and Chromium (skcms) round the conversion differently by ±1, and k-means can magnify that in the color strip, so the browser's strip of such a file can differ slightly from the gallery's. Files in sRGB or without a profile give the same strips byte for byte (the check page found no exception in 200 random paintings).
- **Performance**: downscale an image to about 256 px before k-means (area averaging in linear light, see Color spaces), and run it in a Worker.
- **Hosting while private** (decided Oct 5, 2026; not in the design doc): GitHub Pages on a private repo needs a paid plan (e.g. GitHub Pro through the Student Developer Pack), so until the repo goes public at v1.0 the site lives on Cloudflare Pages, which serves private repos for free. CI uploads the tested `app/dist` with `wrangler`, using the repo secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`, to https://palette-atlas.pages.dev (live since Oct 5, 2026). The site is public either way. The build uses relative paths, so it already works under `/PaletteAtlas/` for the move to GitHub Pages.

## What the project teaches

- Color science: gamma, linear light, OKLab, and why averaging raw sRGB values gives a dark, muddy strip.
- Algorithms and geometry: space-filling curves, k-means, and the TSP solved exactly by dynamic programming (Held-Karp).
- Vector search: HNSW from scratch, the trade-off between recall and speed, binary serialization, and optimal transport (the Earth Mover's Distance and its sliced form) as a distance between color schemes.
- Web engineering: Web Workers, Canvas and Three.js, performance with heavy data in the browser.
- Infrastructure: monorepo, CI/CD, visual tests, a data pipeline you can rerun.

## Commands

```bash
pnpm install     # install all dependencies
pnpm dev         # run the app locally at http://localhost:5173 (visual checks: /benchmark.html)
pnpm build       # build every workspace package
pnpm test        # run every package's tests, the app's UI tests and the fetch step's Python tests included
pnpm --filter @palette-atlas/app exec playwright install chromium   # once per machine, for the UI tests
pnpm typecheck   # type-check every package
pnpm strips      # write the benchmark images' strips to benchmark/strips, the tests' reference images
python pipeline/fetch/fetch.py catalog   # choose the paintings on Wikidata and Commons (about 30 min)
python pipeline/fetch/fetch.py images    # download their images to pipeline/data (hours; rerun to resume)
pnpm paintings   # read the downloaded paintings' strips into app/public/data (check: /benchmark.html)
pnpm careers     # rebuild the artists' careers from app/public/data in seconds (pnpm paintings writes them too)
pnpm search-index   # rebuild the search index and the paintings' map from app/public/data in about a minute (pnpm paintings writes them too)
```

Development happens on Windows (PowerShell). `.gitattributes` keeps every text file LF.

## Sources

- [QLever: SPARQL over Wikidata](https://qlever.dev/wikidata)
- [MediaWiki API: imageinfo](https://www.mediawiki.org/wiki/API:Imageinfo) (Commons file sizes, licenses and thumbnail URLs)
- [Wikimedia robot policy](https://wikitech.wikimedia.org/wiki/Robot_policy) and [standard thumbnail sizes](https://www.mediawiki.org/wiki/Common_thumbnail_sizes)
- [Art Institute of Chicago: Open Access Images](https://www.artic.edu/open-access/open-access-images) (three of the Studio's samples)
- [Malkov and Yashunin: HNSW](https://arxiv.org/abs/1603.09320) and [hnswlib](https://github.com/nmslib/hnswlib); the rest of phase 5's reading is listed in `docs/search-research.md`
