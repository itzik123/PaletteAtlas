/**
 * Wikimedia's standard thumbnail widths, the only ones it serves to sites that link its images
 * directly (https://www.mediawiki.org/wiki/Common_thumbnail_sizes).
 */
export const THUMBNAIL_WIDTHS = [20, 40, 60, 120, 250, 330, 500, 960, 1280, 1920, 3840] as const;
export type ThumbnailWidth = (typeof THUMBNAIL_WIDTHS)[number];

/** The smallest standard width at least `width` wide, or the widest there is. */
export function thumbnailWidthAtLeast(width: number): ThumbnailWidth {
  return THUMBNAIL_WIDTHS.find((standard) => standard >= width) ?? THUMBNAIL_WIDTHS[THUMBNAIL_WIDTHS.length - 1];
}

/** Where Commons serves its files, and their thumbnails. */
const FILES_URL = 'https://upload.wikimedia.org/wikipedia/commons/';
const THUMBNAILS_URL = 'https://thumb.wikimedia.org/wikipedia/commons/thumb/';
const PAGES_URL = 'https://commons.wikimedia.org/wiki/File:';
/** Thumbnails of a file whose name is longer than this, in bytes, are named "thumbnail" instead (Wikimedia's abbrvThreshold). */
const LONGEST_THUMBNAIL_NAME = 160;
/** The formats browsers show, whose files can stand in for a thumbnail. */
const WEB_FORMATS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp']);
const TIFF = new Set(['tif', 'tiff']);

/**
 * An image file on Wikimedia Commons, linked at any standard width the way MediaWiki names its
 * thumbnails, so that only the file's name, hash and width need storing.
 */
export class CommonsImage {
  /** Its name on Commons, with spaces, e.g. "Mona Lisa.jpg". */
  readonly file: string;
  /** MediaWiki's hashed directory for it, the first two hex digits of the MD5 of its name, e.g. "ec". */
  readonly hash: string;
  /** Its full width. */
  readonly width: number;

  constructor(file: string, hash: string, width: number) {
    this.file = file;
    this.hash = hash;
    this.width = width;
  }

  /**
   * The image at a standard width (the type admits no other): a thumbnail, or the file itself
   * when it is no wider. A TIFF,
   * which browsers can't show, is never linked itself, but as its widest thumbnail instead.
   */
  url(width: ThumbnailWidth): string {
    if (width < this.width) return this.#thumbnail(width);
    if (WEB_FORMATS.has(this.#extension)) return `${FILES_URL}${this.#directory}${escape(this.file)}`;
    return this.#thumbnail(THUMBNAIL_WIDTHS.findLast((standard) => standard < this.width) ?? THUMBNAIL_WIDTHS[0]);
  }

  /** The image at least `width` pixels wide if it can be: at the smallest standard width that is. */
  urlAtLeast(width: number): string {
    return this.url(thumbnailWidthAtLeast(width));
  }

  /** The file's page on Commons, with its license and history. */
  get page(): string {
    return `${PAGES_URL}${escape(this.file)}`;
  }

  /** Reads a file's hash from a link to it or to one of its thumbnails, as the Commons API gives them. */
  static hashIn(url: string): string | undefined {
    return /\/wikipedia\/commons\/(?:thumb\/)?([0-9a-f])\/(\1[0-9a-f])\//.exec(url)?.[2];
  }

  /** A thumbnail, named by MediaWiki's rules (File::thumbName and FileRepo::nameForThumb). */
  #thumbnail(width: number): string {
    const escaped = escape(this.file);
    const name = byteLength(underscored(this.file)) > LONGEST_THUMBNAIL_NAME ? `thumbnail.${this.#extension}` : escaped;
    // A TIFF's thumbnails are JPEGs of its first page.
    const thumbnail = TIFF.has(this.#extension) ? `lossy-page1-${width}px-${name}.jpg` : `${width}px-${name}`;
    return `${THUMBNAILS_URL}${this.#directory}${escaped}/${thumbnail}`;
  }

  get #directory(): string {
    return `${this.hash[0]}/${this.hash}/`;
  }

  get #extension(): string {
    return this.file.slice(this.file.lastIndexOf('.') + 1).toLowerCase();
  }
}

function underscored(file: string): string {
  return file.replaceAll(' ', '_');
}

/** A file name as it appears in Commons links: underscores for spaces, and everything but letters, digits and -_.~ escaped (PHP's rawurlencode). */
function escape(file: string): string {
  return encodeURIComponent(underscored(file)).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}

/** A string's length in UTF-8 bytes: each escaped byte counts once. */
function byteLength(text: string): number {
  return encodeURIComponent(text).replace(/%[0-9A-F]{2}/g, '_').length;
}
