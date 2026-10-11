# Contributing

Thanks for looking. Palette Atlas is a small project with one maintainer, so a few notes keep things moving.

## What helps

- **Pick up an issue.** [`good first issue`](https://github.com/itzik123/PaletteAtlas/labels/good%20first%20issue) marks small, self-contained ones. [`help wanted`](https://github.com/itzik123/PaletteAtlas/labels/help%20wanted) marks bigger ones that need a hand. Say so in the issue before you start, so two people don't do the same work.
- **Ask and suggest in [Discussions](https://github.com/itzik123/PaletteAtlas/discussions).** Ideas, questions, "would this fit?". Do this before writing code for anything big, such as a new Studio feature or a new page: the site has a deliberate look (cream paper, thick ink outlines, few words), and a feature that can't fit it is left out rather than added anyway.
- **Report a bug** in an issue: what you did, your browser and device, and the image if you can share it. Images never leave your computer, so we can't see yours unless you share it.
- **Try it on what tests can't reach.** Real phones, other browsers, screen readers.

## Setup

You need Node.js 24+ and [pnpm](https://pnpm.io) (the version is pinned in `package.json`). `pnpm test` also runs the fetch step's Python tests, so it needs Python 3.14, the version CI uses.

```bash
pnpm install
pnpm --filter @palette-atlas/app exec playwright install chromium   # once, for the UI tests
pnpm dev          # the site at http://localhost:5173
pnpm test         # unit, integration and UI tests
pnpm typecheck
```

The gallery's data is in the repository, so there is nothing to download. `pnpm dev` also serves `/benchmark.html`, a dev-only page that shows each mechanism on the six renders in `benchmark/`, and 20 random paintings from the gallery.

To run one package's tests, filter by its name: `pnpm --filter @palette-atlas/strip test`. The UI tests build the site and run it in Playwright's Chromium, so they take longer than the rest.

Rebuilding the whole gallery takes hours (see the README). To try a change to the pipeline, build the four-painting fixture instead, and always name an output folder: with none, `paintings.ts` writes over `app/public/data`.

```bash
node pipeline/build/src/paintings.ts pipeline/fixtures/wikidata <output folder> 2
```

## How the code is organized

The [project layout](README.md#project-layout) table in the README says what each folder holds. In short: the algorithms live in `packages/` as TypeScript libraries with no browser dependency, so the offline pipeline and the site run the same code; `app/` is the site; `pipeline/build` prepares the gallery's data.

[CLAUDE.md](CLAUDE.md) goes further: the design decisions and the reasons for them. (It is also the instruction file for Claude Code, the assistant the maintainer works with.) The decisions behind the search are in [docs/search-research.md](docs/search-research.md).

## Conventions

- **Test first.** Write the failing test, then the simplest code that passes. Tests sit next to the code as `*.test.ts` (Vitest). Skip the obvious (getters, plain constructors). Unit tests check known reference values, round-trips and invariants; the tests that matter most put subsystems together (image → strip → vector, HNSW against brute force). A change and its tests go in the same commit, so `main` stays green.
- **UI tests** are in `app/e2e` (Playwright) and run against the production build. Every page, in every state, on a laptop and a phone, must pass axe-core's WCAG 2.2 AA checks (`accessibility.spec.ts`), and whatever a pointer does a keyboard does too. A new page or state goes into the list there.
- **Reference strips.** `benchmark/strips` holds every axis's strip of the benchmark images, and tests compare the pipeline's output and the Studio's strips with them pixel for pixel. After an intended change, run `pnpm strips`, look at the new images and commit them. A change you didn't intend is a bug.
- **Plain TypeScript, no UI framework.** The config is strict. `erasableSyntaxOnly` bans enums, namespaces and constructor parameter properties (use union types or `as const` objects), and relative imports end in `.ts`, because Node runs the source directly. The libraries in `packages/` have no DOM types on purpose, so they can't touch browser APIs.
- **Design.** Small classes with one job, dependencies handed in through constructors, composition over inheritance. When a class is a known pattern, name it in its doc comment (see "Strategy" on `StripAxis`, "Facade" on `ImageStrips`), but don't force a pattern where plain code is clearer. Name magic numbers. In hot paths (pixel loops, distances) keep the data in typed arrays, not one object per pixel.
- **Commits.** One cohesive change each, the subject a short plain sentence, like `Save the HNSW index to a compact binary file` or `Add the paintings' map for the Lab`, and optionally a few sentences below. Not one commit per file, and not unrelated things together.
- **Style.** No formatter or linter is set up; follow the code around yours.

## Sending a change

Open a pull request against `main`. CI runs the typecheck, the tests and the build, and all three need to pass. Smaller is easier to review.

If your change would alter the gallery's data files (`app/public/data`), say so in the issue first. Rebuilding them needs the downloaded images (hours of polite downloading) and then over an hour of building, so it is usually the maintainer who does it; a pull request with the code and its tests is enough.

## Adding a strip axis

An axis is a way of reading an image into a strip: it decides which pixels go into which of the 128 stripes. There are four (color, Hilbert curve, columns, radial), and a fifth, such as a spiral, a Z-order curve or a path by lightness, is the best-defined way to extend the project.

The strip engine needs no change: `Strip`, `SourceMap`, the hover linking and the workers handle any axis. The lists that name the axes do.

1. **The class.** `packages/strip/src/<name>-axis.ts` implements `StripAxis` (`strip-axis.ts`), which has one method, `sourceMap(image, segments)`, returning a `SourceMap`. Most axes put the pixels in an order and cut it into equal runs with `SourceMap.fromSequence`, as `RadialAxis` and `HilbertAxis` do; `ColumnAxis` builds the map itself. An axis never averages colors; `Strip.read` does, in linear light.
2. **The name.** `ImageStrips` in `packages/strip/src/image-strips.ts` is the one place that builds the axes. Add the name to `AxisName`, `EVERY_AXIS` and the `stripAxes` record, and export the class from `packages/strip/src/index.ts`.
3. **The site.** Four places in `app/src`:
   - `AXIS_ICONS` in `icons.ts`: an inline SVG, outlined like the others.
   - `READINGS` in `studio/strip-formats.ts`: how a saved poster's caption describes the axis.
   - `AXIS_OPTIONS` in `studio/axis-picker.ts`: its label, and its place among the Studio's buttons and the strips on a painting's page.
   - `.axis-<name>` in `style.css`: its tile color.

   TypeScript flags the first two if you forget them (both are `Record<AxisName, …>`); the other two you have to remember. Words like "four paths" in `site/explanations.ts` and the README need an update too.
4. **Tests.** Add the axis to `AXES` in `packages/strip/src/axes.test.ts` (every pixel in a segment, none empty, at several sizes) and to the list in `app/e2e/studio.spec.ts`. Add a test for what makes your axis itself, as the Hilbert curve's test checks that it visits every pixel once. Then run `pnpm strips` and commit the new files in `benchmark/strips`: the pipeline's `strip-images.test.ts` fails until they exist.
5. **Fit.** A fifth button in the Studio and a fifth strip on every painting's page make both taller. Both must still fit a laptop window without scrolling, and the buttons must fit a 320 px phone (the longest label now is "Columns", so keep yours short). The UI tests check this; if the CSS needs work, say so in the pull request and the layout can be adjusted together.

## Python

Python is only for `pipeline/fetch`, which finds the paintings on Wikidata and downloads their images from Commons. It uses the standard library alone (no packages, no venv), with tests next to the code as `*_test.py`, run by `unittest` (`pnpm test` runs them). Anything the site also needs is TypeScript. The fetch step follows Wikimedia's [robot policy](https://wikitech.wikimedia.org/wiki/Robot_policy); please don't make it faster or more parallel.

## License

The code is under the [MIT License](LICENSE). The ray-traced renders in `benchmark/` and the GIFs in `docs/` are under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Contributions are released under the same licenses.
