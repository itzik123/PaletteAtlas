import { access, mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { RgbaImage } from '@palette-atlas/color';
import {
  ARTIST_FIELDS,
  type Artist,
  CommonsImage,
  columnsOf,
  GALLERY_FILES,
  type GalleryManifest,
  ID_SHARDS,
  idShard,
  type Painting,
  SOURCE_WIDTH,
} from '@palette-atlas/gallery';
import { STRIP_SEGMENTS } from '@palette-atlas/strip';
import { writeCareers } from './career-data.ts';
import { type Catalog, CATALOG_FILE, readCatalog, type Work } from './catalog.ts';
import { asStored, writeChunks } from './chunk-files.ts';
import { writeSearchData } from './search-data.ts';
import { GALLERY_AXIS } from './strip-messages.ts';
import type { StripPool } from './strip-pool.ts';

/**
 * Paintings per chunk (see chunkOf): a chunk's strips take about 15 KB, its records about 6 KB.
 * Small, as a search's paintings lie all over the gallery, about one chunk each: a wall of matches'
 * first 60 fetch 1.2 MB of chunks of 100, where chunks of 1,000 took 6.5 MB (Oct 11, 2026).
 */
export const CHUNK_SIZE = 100;
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
/**
 * Titles that replace the catalog's, by Wikidata item: the paintings whose English label on
 * Wikidata was vandalized or garbled by an anonymous or brand-new editor and never reverted (found
 * Oct 11, 2026, by comparing every title with the English Wikipedia's article, the Commons file
 * name and the other languages' labels, and by reading the edit histories of the first 2,000
 * paintings and of the next 3,000 that have an English Wikipedia article). Each fix is the label
 * as it stood before the edit that spoiled it, or the article's title. Drop an entry once
 * Wikidata has the right label again: the catalog then brings it.
 */
export const TITLE_FIXES: TitleFixes = {
  // "The Surrender of Brea", since May 2026.
  Q1133420: 'The Surrender of Breda',
  // "The Coronation of Gabo Napoleon", since Sep 2026.
  Q1231009: 'The Coronation of Napoleon',
  // "El retorno del hijo gey", since Oct 5, 2026.
  Q512755: 'The Return of the Prodigal Son',
  // "A Journalist Lecturing on the Orrery", since 2019.
  Q1651874: 'A Philosopher Lecturing on the Orrery',
  // "The Fif", since 2024.
  Q26250: 'The Fifer',
  // "Narcissuss", since 2021.
  Q746716: 'Narcissus',
  // "Walk on the mountain", since 2024.
  Q6065609: 'Walk on the Beach',
  // "San Bernardino Altarpiec", since Aug 2026.
  Q3889248: 'San Bernardino Altarpiece',
};
/** How often the build reports its progress, in images. */
const PROGRESS_EVERY = 1000;

/** Paintings to move down the gallery, and how many others come before them. */
export interface HeldBack {
  readonly ids: readonly string[];
  readonly position: number;
}

/** The title to show for a painting, by its Wikidata item, in place of the catalog's. */
export type TitleFixes = Readonly<Record<string, string>>;

export interface BuildOptions {
  /** Paintings per chunk. */
  readonly chunkSize?: number;
  readonly heldBack?: HeldBack;
  readonly titleFixes?: TitleFixes;
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
 * writes the gallery's files (see GALLERY_FILES) to the output folder, the artists' careers and
 * the search index included, replacing any earlier build there. Left out: the colorless paintings, those whose
 * image fails to decode, and those whose image the site couldn't link to.
 */
export async function buildPaintings(
  catalogFolder: string,
  outputFolder: string,
  pool: StripPool,
  { chunkSize = CHUNK_SIZE, heldBack = HELD_BACK, titleFixes = TITLE_FIXES, log = console.log }: BuildOptions = {},
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
    const strip = 'reading' in result ? result.reading.strip : undefined;
    if ('error' in result || strip?.width !== STRIP_SEGMENTS) {
      failed++;
      log(`Failed ${work.image}: ${'error' in result ? result.error : `no full ${GALLERY_AXIS} strip`}`);
    } else if (result.reading.colorfulness < MIN_COLORFULNESS) {
      colorless++;
    } else {
      kept.push({ work, image, strip: asStored(strip) });
    }
  });

  await writeGallery(holdBack(kept, heldBack).map((painting) => retitle(painting, titleFixes)), catalog, outputFolder, chunkSize);
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

/** The painting, with the title the fixes name for it, if any. */
function retitle(painting: KeptPainting, fixes: TitleFixes): KeptPainting {
  const title = fixes[painting.work.id];
  return title === undefined ? painting : { ...painting, work: { ...painting.work, title } };
}

/** Writes the gallery's files, then the artists' careers and the search index drawn up from them. */
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
  await writeIds(folder, gallery.paintings.map(({ id }) => id));
  await writeChunks(folder, GALLERY_FILES.gallery, gallery, chunkSize);
  await writeCareers(folder, gallery, artists, chunkSize);
  await writeSearchData(folder, gallery.strips, chunkSize);
}

/** Writes the paintings' Wikidata items in their shards (see GALLERY_FILES.ids), each with its position: every shard, if empty. */
async function writeIds(folder: string, ids: readonly string[]): Promise<void> {
  const shards = Array.from({ length: ID_SHARDS }, (): Record<string, number> => ({}));
  ids.forEach((id, position) => {
    const shard = idShard(id);
    if (shard === undefined) throw new RangeError(`${id} is no Wikidata item`);
    shards[shard][id] = position;
  });
  const target = join(folder, GALLERY_FILES.ids.folder);
  await rm(target, { recursive: true, force: true });
  await mkdir(target, { recursive: true });
  await Promise.all(shards.map((shard, index) => writeFile(join(folder, GALLERY_FILES.ids.shard(index)), JSON.stringify(shard))));
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
