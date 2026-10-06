import { access, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { RgbaImage } from '@palette-atlas/color';
import {
  ARTIST_FIELDS,
  type Artist,
  CommonsImage,
  columnsOf,
  GALLERY_FILES,
  type GalleryManifest,
  type Painting,
  SOURCE_WIDTH,
} from '@palette-atlas/gallery';
import { type AxisName, STRIP_SEGMENTS } from '@palette-atlas/strip';
import { writeCareers } from './career-data.ts';
import { type Catalog, CATALOG_FILE, readCatalog, type Work } from './catalog.ts';
import { writeChunks } from './chunk-files.ts';
import type { StripPool } from './strip-pool.ts';

/** Paintings per chunk (see chunkOf): a chunk's strips take about 150 KB. */
export const CHUNK_SIZE = 1000;
/** The strip the gallery shows: the one read by color. The painting page reads the rest live. */
const GALLERY_AXIS: AxisName = 'color';
/**
 * Images less colorful than this (see colorfulness()) are black-and-white photos of paintings,
 * and are left out: their strips would show the photo, not the painting's colors. Measured on the
 * first 1,778 downloads: the 42 black-and-white photos score at most 0.0001, and the least
 * colorful painting 0.0037 (Manet's Luncheon in the Studio). Photos toned sepia score like muted
 * paintings (about 0.006), so they can't be told apart this way, and stay.
 */
export const MIN_COLORFULNESS = 0.001;
/**
 * Paintings moved further down the gallery, out of its opening screens, by Wikidata item. The
 * gallery opens on the most famous paintings; these come later all the same (decided Oct 6,
 * 2026): Courbet's L'Origine du monde.
 */
export const HELD_BACK = { ids: ['Q334138'], position: 500 } as const;
/** How often the build reports its progress, in images. */
const PROGRESS_EVERY = 1000;

/** Paintings to move down the gallery, and how many others come before them. */
export interface HeldBack {
  readonly ids: readonly string[];
  readonly position: number;
}

export interface BuildOptions {
  /** Paintings per chunk. */
  readonly chunkSize?: number;
  readonly heldBack?: HeldBack;
  readonly log?: (line: string) => void;
}

export interface BuildReport {
  readonly paintings: number;
  readonly notDownloaded: number;
  readonly colorless: number;
  readonly failed: number;
  /** Paintings whose Commons image couldn't be linked from its file name (see CommonsImage). */
  readonly unlinkable: number;
}

/**
 * Reads the color strip of every downloaded painting in the fetch step's catalog folder and
 * writes the gallery's files (see GALLERY_FILES) to the output folder, the artists' careers
 * included, replacing any earlier build there. Left out: the colorless paintings, those whose
 * image fails to decode, and those whose image the site couldn't link to.
 */
export async function buildPaintings(
  catalogFolder: string,
  outputFolder: string,
  pool: StripPool,
  { chunkSize = CHUNK_SIZE, heldBack = HELD_BACK, log = console.log }: BuildOptions = {},
): Promise<BuildReport> {
  const catalog = await readCatalog(join(catalogFolder, CATALOG_FILE));
  const works = await downloaded(catalog.works, catalogFolder);
  const linked = works.flatMap((work) => {
    const image = linkedImage(work);
    return image ? [{ work, image }] : [];
  });
  log(`Reading the strips of ${linked.length.toLocaleString('en')} downloaded paintings of ${catalog.works.length.toLocaleString('en')}`);
  const results = await pool.read(
    linked.map(({ work }) => join(catalogFolder, work.image)),
    (done) => {
      if (done % PROGRESS_EVERY === 0) log(`${done.toLocaleString('en')} read`);
    },
  );

  const kept: KeptPainting[] = [];
  let colorless = 0;
  let failed = 0;
  results.forEach((result, index) => {
    const { work, image } = linked[index];
    const strip = 'reading' in result ? result.reading.strips.find(({ axis }) => axis === GALLERY_AXIS)?.colors : undefined;
    if ('error' in result || strip?.width !== STRIP_SEGMENTS) {
      failed++;
      log(`Failed ${work.image}: ${'error' in result ? result.error : `no full ${GALLERY_AXIS} strip`}`);
    } else if (result.reading.colorfulness < MIN_COLORFULNESS) {
      colorless++;
    } else {
      kept.push({ work, image, strip });
    }
  });

  await writeGallery(holdBack(kept, heldBack), catalog, outputFolder, chunkSize);
  return {
    paintings: kept.length,
    notDownloaded: catalog.works.length - works.length,
    colorless,
    failed,
    unlinkable: works.length - linked.length,
  };
}

/** A painting kept for the gallery, with its image on Commons and its strip. */
interface KeptPainting {
  readonly work: Work;
  readonly image: CommonsImage;
  readonly strip: RgbaImage;
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

/**
 * A work's image on Commons, if the site can link it from its file name, hash and width alone, as
 * the gallery stores it: the link must come out as the one the image was downloaded from. A few
 * TIFFs have thumbnails named otherwise ("lossless-page1"), and no rule tells which.
 */
function linkedImage(work: Work): CommonsImage | undefined {
  const hash = CommonsImage.hashIn(work.thumbnail);
  const image = hash === undefined ? undefined : new CommonsImage(work.file, hash, work.width);
  return image?.url(SOURCE_WIDTH) === work.thumbnail ? image : undefined;
}

/** The paintings in order, with the held-back ones moved to their position (or last, if there are fewer). */
function holdBack(paintings: readonly KeptPainting[], { ids, position }: HeldBack): KeptPainting[] {
  const isHeldBack = ({ work }: KeptPainting): boolean => ids.includes(work.id);
  const others = paintings.filter((painting) => !isHeldBack(painting));
  others.splice(position, 0, ...paintings.filter(isHeldBack));
  return others;
}

/** Writes the gallery's files, then the artists' careers drawn up from them. */
async function writeGallery(paintings: readonly KeptPainting[], catalog: Catalog, folder: string, chunkSize: number): Promise<void> {
  const artistIds = [...new Set(paintings.map(({ work }) => work.artist))];
  const artistIndex = new Map(artistIds.map((id, index) => [id, index]));
  const artists: Artist[] = artistIds.map((id) => ({ id, ...catalog.artists[id] }));
  const manifest: GalleryManifest = {
    created: catalog.created,
    count: paintings.length,
    chunkSize,
    segments: STRIP_SEGMENTS,
    artists: columnsOf(artists, ARTIST_FIELDS),
  };
  const gallery = {
    paintings: paintings.map(({ work, image }) => painting(work, image, artistIndex.get(work.artist) ?? -1)),
    strips: paintings.map(({ strip }) => strip),
  };

  await mkdir(folder, { recursive: true });
  await writeFile(join(folder, GALLERY_FILES.manifest), JSON.stringify(manifest));
  await writeFile(join(folder, GALLERY_FILES.ids), JSON.stringify(gallery.paintings.map(({ id }) => id)));
  await writeChunks(folder, GALLERY_FILES.gallery, gallery, chunkSize);
  await writeCareers(folder, gallery, artists, chunkSize);
}

function painting(work: Work, image: CommonsImage, artist: number): Painting {
  return {
    id: work.id,
    title: work.title,
    artist,
    year: work.year,
    precision: work.precision,
    collection: work.collection,
    file: work.file,
    hash: image.hash,
    width: work.width,
    height: work.height,
    license: work.license,
  };
}
