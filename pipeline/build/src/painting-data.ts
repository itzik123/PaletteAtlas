import { access, mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { type AxisName, STRIP_SEGMENTS } from '@palette-atlas/strip';
import { type Catalog, CATALOG_FILE, type DatePrecision, readCatalog, type Work } from './catalog.ts';
import { writePng } from './image-file.ts';
import { StripAtlas } from './strip-atlas.ts';
import type { ImageReading } from './strip-messages.ts';
import type { PoolResult, StripPool } from './strip-pool.ts';

/** Paintings per atlas image (see StripAtlas). */
export const CHUNK_SIZE = 1000;
/**
 * Images less colorful than this (see colorfulness()) are black-and-white photos of paintings,
 * and are left out: their strips would show the photo, not the painting's colors. Measured on the
 * first 1,778 downloads: the 42 black-and-white photos score at most 0.0001, and the least
 * colorful painting 0.0037 (Manet's Luncheon in the Studio). Photos toned sepia score like muted
 * paintings (about 0.006), so they can't be told apart this way, and stay.
 */
export const MIN_COLORFULNESS = 0.001;
/** The file that lists the paintings, inside the output folder. */
export const PAINTINGS_FILE = 'paintings.json';
/** The folder of atlas images, inside the output folder. */
export const STRIPS_FOLDER = 'strips';
/** How often the build reports its progress, in images. */
const PROGRESS_EVERY = 1000;

/** The paintings file the app reads. */
export interface PaintingsFile {
  /** The day the catalog was compiled. */
  readonly created: string;
  /** Segments per strip, and the axes, in the order of each painting's strips. */
  readonly segments: number;
  readonly axes: readonly AxisName[];
  /** Paintings per atlas image: painting i's strip along an axis is row i % chunkSize of `strips/<axis>-<⌊i / chunkSize⌋>.png`. */
  readonly chunkSize: number;
  readonly artists: readonly PaintingArtist[];
  /** The most famous first. */
  readonly paintings: readonly Painting[];
}

export interface PaintingArtist {
  readonly id: string;
  readonly name: string | null;
  readonly born: number | null;
  readonly died: number;
}

export interface Painting {
  readonly id: string;
  readonly title: string | null;
  /** The index of its artist in PaintingsFile.artists. */
  readonly artist: number;
  readonly year: number;
  readonly precision: DatePrecision;
  readonly collection: string | null;
  /** Its image's file on Wikimedia Commons, its license there, and its full size. */
  readonly file: string;
  readonly license: string;
  readonly width: number;
  readonly height: number;
  /** A 500 px wide thumbnail on Commons; other standard widths replace the "500px-" in it. */
  readonly thumbnail: string;
  /**
   * The segment counts of its strips that fall short of PaintingsFile.segments, by axis: a tall
   * painting has fewer columns than segments. Such a strip fills the start of its atlas row.
   */
  readonly lengths?: Partial<Record<AxisName, number>>;
}

export interface BuildOptions {
  /** Paintings per atlas image. */
  readonly chunkSize?: number;
  readonly log?: (line: string) => void;
}

export interface BuildReport {
  readonly paintings: number;
  readonly notDownloaded: number;
  readonly colorless: number;
  readonly failed: number;
}

/**
 * Reads the strips of every downloaded painting in the fetch step's catalog folder, leaves out the
 * colorless ones and those that fail to decode, and writes the paintings file and the strip atlas
 * to the output folder, replacing any earlier build there.
 */
export async function buildPaintings(
  catalogFolder: string,
  outputFolder: string,
  pool: StripPool,
  { chunkSize = CHUNK_SIZE, log = console.log }: BuildOptions = {},
): Promise<BuildReport> {
  const catalog = await readCatalog(join(catalogFolder, CATALOG_FILE));
  const works = await downloaded(catalog.works, catalogFolder);
  log(`Reading the strips of ${works.length.toLocaleString('en')} downloaded paintings of ${catalog.works.length.toLocaleString('en')}`);
  const results = await pool.read(
    works.map((work) => join(catalogFolder, work.image)),
    (done) => {
      if (done % PROGRESS_EVERY === 0) log(`${done.toLocaleString('en')} read`);
    },
  );

  const { kept, colorless, failed } = sort(works, results, log);
  const atlas = new StripAtlas(STRIP_SEGMENTS, chunkSize);
  for (const { reading } of kept) atlas.add(reading.strips);
  await writeAtlas(atlas, join(outputFolder, STRIPS_FOLDER));
  const paintings = paintingsFile(catalog.created, kept, catalog.artists, chunkSize);
  await writeFile(join(outputFolder, PAINTINGS_FILE), JSON.stringify(paintings));
  return { paintings: kept.length, notDownloaded: catalog.works.length - works.length, colorless, failed };
}

/** A painting kept for the app, with what its image read as. */
interface KeptPainting {
  readonly work: Work;
  readonly reading: ImageReading;
}

/** Keeps the paintings in color, counting the colorless and the unreadable ones. */
function sort(
  works: readonly Work[],
  results: readonly PoolResult[],
  log: (line: string) => void,
): { kept: KeptPainting[]; colorless: number; failed: number } {
  const kept: KeptPainting[] = [];
  let colorless = 0;
  let failed = 0;
  results.forEach((result, index) => {
    if ('error' in result) {
      failed++;
      log(`Failed ${works[index].image}: ${result.error}`);
    } else if (result.reading.colorfulness < MIN_COLORFULNESS) {
      colorless++;
    } else {
      kept.push({ work: works[index], reading: result.reading });
    }
  });
  return { kept, colorless, failed };
}

/** Writes the atlas's images into a folder, emptied first so no chunk of an earlier build stays. */
async function writeAtlas(atlas: StripAtlas, folder: string): Promise<void> {
  await rm(folder, { recursive: true, force: true });
  await mkdir(folder, { recursive: true });
  for (const { axis, chunk, image } of atlas.images()) {
    await writePng(join(folder, `${axis}-${chunk}.png`), image);
  }
}

/** The works whose images the fetch step has downloaded so far. */
async function downloaded(works: readonly Work[], folder: string): Promise<Work[]> {
  const present = await Promise.all(
    works.map((work) =>
      access(join(folder, work.image)).then(
        () => true,
        () => false,
      ),
    ),
  );
  return works.filter((_, index) => present[index]);
}

function paintingsFile(created: string, kept: readonly KeptPainting[], artists: Catalog['artists'], chunkSize: number): PaintingsFile {
  const artistIds = [...new Set(kept.map(({ work }) => work.artist))];
  const artistIndex = new Map(artistIds.map((id, index) => [id, index]));
  return {
    created,
    segments: STRIP_SEGMENTS,
    // Every reading has its strips in the same order, ImageStrips'.
    axes: kept[0]?.reading.strips.map(({ axis }) => axis) ?? [],
    chunkSize,
    artists: artistIds.map((id) => ({ id, ...artists[id] })),
    paintings: kept.map(({ work, reading }) => ({
      id: work.id,
      title: work.title,
      artist: artistIndex.get(work.artist) ?? -1,
      year: work.year,
      precision: work.precision,
      collection: work.collection,
      file: work.file,
      license: work.license,
      width: work.width,
      height: work.height,
      thumbnail: work.thumbnail,
      ...shortStrips(reading),
    })),
  };
}

/** The lengths of a painting's strips shorter than STRIP_SEGMENTS, if any (see Painting.lengths). */
function shortStrips({ strips }: ImageReading): Pick<Painting, 'lengths'> {
  const short = strips.filter(({ colors }) => colors.width < STRIP_SEGMENTS);
  return short.length ? { lengths: Object.fromEntries(short.map(({ axis, colors }) => [axis, colors.width])) } : {};
}
