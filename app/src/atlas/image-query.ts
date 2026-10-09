import type { RgbaImage } from '@palette-atlas/color';
import { context2d } from '../image-adapters.ts';
import { SITE_COLORS } from '../site-colors.ts';

/**
 * An image to match the gallery's paintings to: its color strip, and a small copy of the picture
 * to show over its matches. Neither leaves the visitor's browser.
 */
export interface ImageQuery {
  /** The image's color strip, its segments in a row. */
  readonly colors: RgbaImage;
  /** The picture, as a data URL. */
  readonly picture: string;
  /** The picture's width over its height. */
  readonly aspect: number;
}

/** A picture to copy, and its size: a canvas showing a bitmap needn't have the bitmap's size. */
export interface Picture {
  readonly source: CanvasImageSource;
  readonly width: number;
  readonly height: number;
}

/** The copy's longest side, in pixels: sharp on the query's card (see atlas.css) at twice its size. */
const PICTURE_SIZE = 400;
const PICTURE_QUALITY = 0.9;
/** Where a picture is see-through, its copy, a JPEG, shows the page's paper. */
const BACKDROP = SITE_COLORS.paper;

/** An image's query, from its picture and its color strip. */
export function imageQuery(picture: Picture, colors: RgbaImage): ImageQuery {
  const scale = Math.min(1, PICTURE_SIZE / Math.max(picture.width, picture.height));
  const copy = document.createElement('canvas');
  copy.width = Math.max(1, Math.round(picture.width * scale));
  copy.height = Math.max(1, Math.round(picture.height * scale));
  const context = context2d(copy);
  context.fillStyle = BACKDROP;
  context.fillRect(0, 0, copy.width, copy.height);
  context.imageSmoothingQuality = 'high';
  context.drawImage(picture.source, 0, 0, copy.width, copy.height);
  return {
    colors: { width: colors.width, height: colors.height, data: Uint8ClampedArray.from(colors.data) },
    picture: copy.toDataURL('image/jpeg', PICTURE_QUALITY),
    aspect: picture.width / picture.height,
  };
}

/** A query as it is kept: plain enough for JSON. */
interface KeptQuery {
  readonly colors: { readonly width: number; readonly height: number; readonly data: readonly number[] };
  readonly picture: string;
  readonly aspect: number;
}

/** The Atlas page that shows the matches of the image handed to it. */
export const MATCHES_PAGE = './atlas.html?match';

/** The key of the query in its history entry's state. */
const STATE_KEY = 'imageQuery';
/** The key of a query handed to the next page that shows its matches, in the tab's session storage. */
const HANDOFF_KEY = 'palette-atlas:image-query';

/**
 * Memento: a query travels to the page that shows its matches (the Atlas's, or the Lab's replay
 * of the search for them) through the tab's session storage, from the Studio, the Atlas or the
 * Lab, and that page keeps it in its own history entry, so coming back to it (or reloading it)
 * finds the same matches, while the next query handed over gets a page of its own.
 */
export const ImageQueries = {
  /** Hands a query to the next page this tab opens to show its matches: MATCHES_PAGE, say. */
  hand(query: ImageQuery): void {
    try {
      sessionStorage.setItem(HANDOFF_KEY, JSON.stringify(kept(query)));
    } catch {
      // Without session storage (blocked, or full), the Atlas opens on its whole wall instead.
    }
  },

  /** The query of this history entry, or else the one handed to this page, which the entry then keeps. */
  take(): ImageQuery | undefined {
    const state: unknown = history.state;
    const own = state && typeof state === 'object' && STATE_KEY in state ? (state[STATE_KEY] as KeptQuery) : undefined;
    if (own) return restored(own);
    let handed: KeptQuery | undefined;
    try {
      const json = sessionStorage.getItem(HANDOFF_KEY);
      sessionStorage.removeItem(HANDOFF_KEY);
      handed = json ? (JSON.parse(json) as KeptQuery) : undefined;
    } catch {
      return undefined;
    }
    if (!handed) return undefined;
    history.replaceState({ ...(state && typeof state === 'object' ? state : {}), [STATE_KEY]: handed }, '');
    return restored(handed);
  },
} as const;

function kept({ colors, picture, aspect }: ImageQuery): KeptQuery {
  return { colors: { width: colors.width, height: colors.height, data: Array.from(colors.data) }, picture, aspect };
}

function restored({ colors, picture, aspect }: KeptQuery): ImageQuery {
  return { colors: { width: colors.width, height: colors.height, data: Uint8ClampedArray.from(colors.data) }, picture, aspect };
}
