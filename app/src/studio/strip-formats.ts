import type { AxisName, Strip } from '@palette-atlas/strip';
import { context2d } from '../image-adapters.ts';
import { PHONE_ICON, POSTER_ICON } from '../icons.ts';
import { LOGO_COLORS, SITE_COLORS } from '../site-colors.ts';

/** What a saved strip is called and how it was read, for its caption and file name. */
export interface StripCaption {
  /** The image's file name without its extension. */
  readonly title: string;
  readonly axis: AxisName;
}

/**
 * A way to save a strip as a picture. Strategy: each format lays the strip out its own way, and
 * the Studio saves whichever the user picks.
 */
export interface StripFormat {
  /** The button's name. */
  readonly label: string;
  readonly icon: string;
  /** Ends the saved file's name, as <title>-<axis>-<suffix>.png. */
  readonly suffix: string;
  draw(strip: Strip, caption: StripCaption): Promise<HTMLCanvasElement>;
}

/** The type the saved images' captions are set in, loaded with the page (see main.ts). */
const FONT_FAMILY = '"Bricolage Grotesque Variable", sans-serif';

/** How each axis is described under a poster's title. */
const READINGS: Readonly<Record<AxisName, string>> = {
  color: 'Read by color',
  hilbert: 'Read along a Hilbert curve',
  columns: 'Read in columns, left to right',
  radial: 'Read from the center out',
};

/** A phone's home screen, the 9 : 19.5 of today's phones: the strip's bands running top to bottom, edge to edge. */
export const WALLPAPER: StripFormat = {
  label: 'Wallpaper',
  icon: PHONE_ICON,
  suffix: 'wallpaper',
  async draw(strip) {
    const canvas = sizedCanvas(1440, 3120);
    drawBands(context2d(canvas), strip, { x: 0, y: 0, width: canvas.width, height: canvas.height }, 'down');
    return canvas;
  },
};

/**
 * The poster's layout, in units of a 600 × 900 sheet (2 : 3, printing at 8 × 12 in), drawn
 * POSTER_SCALE times larger: the strip framed and casting a hard shadow, as on the site, with the
 * title and how the strip was read underneath, and the site's name in the corner.
 */
const POSTER_SCALE = 4;
const POSTER_LAYOUT = {
  width: 600,
  height: 900,
  margin: 54,
  frameHeight: 640,
  frameBorder: 6,
  frameRadius: 18,
  shadowOffset: 12,
  titleBaseline: 792,
  titleSize: 56,
  /** A long title shrinks to fit, down to this size, and is cut short beyond it. */
  smallestTitleSize: 30,
  readingBaseline: 834,
  readingSize: 22,
  logoSize: 26,
  logoBorder: 3,
  logoRadius: 7,
  logoGap: 10,
  nameSize: 20,
} as const;

export const POSTER: StripFormat = {
  label: 'Poster',
  icon: POSTER_ICON,
  suffix: 'poster',
  async draw(strip, { title, axis }) {
    const p = POSTER_LAYOUT;
    await Promise.all([800, 700, 600].map((weight) => document.fonts.load(`${weight} 16px ${FONT_FAMILY}`)));
    const canvas = sizedCanvas(p.width * POSTER_SCALE, p.height * POSTER_SCALE);
    const context = context2d(canvas);
    context.scale(POSTER_SCALE, POSTER_SCALE);
    context.fillStyle = SITE_COLORS.paper;
    context.fillRect(0, 0, p.width, p.height);

    const frame = { x: p.margin, y: p.margin, width: p.width - 2 * p.margin, height: p.frameHeight };
    context.fillStyle = SITE_COLORS.ink;
    context.beginPath();
    context.roundRect(frame.x + p.shadowOffset, frame.y + p.shadowOffset, frame.width, frame.height, p.frameRadius);
    context.roundRect(frame.x, frame.y, frame.width, frame.height, p.frameRadius);
    context.fill();
    const inside = inset(frame, p.frameBorder);
    context.save();
    context.beginPath();
    context.roundRect(inside.x, inside.y, inside.width, inside.height, p.frameRadius - p.frameBorder);
    context.clip();
    // Bands in whole poster pixels, so their edges come out sharp.
    context.scale(1 / POSTER_SCALE, 1 / POSTER_SCALE);
    drawBands(context, strip, scaled(inside, POSTER_SCALE), 'across');
    context.restore();

    context.fillStyle = SITE_COLORS.ink;
    context.textBaseline = 'alphabetic';
    context.textAlign = 'left';
    context.fillText(fitText(context, title, frame.width, p.titleSize, p.smallestTitleSize, 800), frame.x, p.titleBaseline);
    context.font = `600 ${p.readingSize}px ${FONT_FAMILY}`;
    context.fillText(READINGS[axis], frame.x, p.readingBaseline);
    drawSignature(context, frame.x + frame.width, p.readingBaseline);
    return canvas;
  },
};

/** The formats the Studio offers, in the order of its buttons. */
export const STRIP_FORMATS: readonly StripFormat[] = [POSTER, WALLPAPER];

interface Box {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** Fills a box with one band per segment, across from left to right or down from top to bottom, each band whole pixels wide. */
function drawBands(context: CanvasRenderingContext2D, strip: Strip, box: Box, direction: 'across' | 'down'): void {
  const length = direction === 'across' ? box.width : box.height;
  const count = strip.segmentCount;
  for (let segment = 0; segment < count; segment++) {
    const start = Math.round((segment * length) / count);
    const end = Math.round(((segment + 1) * length) / count);
    context.fillStyle = strip.colorAt(segment)?.toHex() ?? SITE_COLORS.paper;
    if (direction === 'across') context.fillRect(box.x + start, box.y, end - start, box.height);
    else context.fillRect(box.x, box.y + start, box.width, end - start);
  }
}

/** The site's logo, a tiny strip of its five colors, and its name, ending at the right edge on the baseline. */
function drawSignature(context: CanvasRenderingContext2D, right: number, baseline: number): void {
  const p = POSTER_LAYOUT;
  context.font = `700 ${p.nameSize}px ${FONT_FAMILY}`;
  context.textAlign = 'right';
  context.fillText('Palette Atlas', right, baseline);
  const logo = {
    x: right - context.measureText('Palette Atlas').width - p.logoGap - p.logoSize,
    y: baseline - p.logoSize + p.logoBorder,
    width: p.logoSize,
    height: p.logoSize,
  };
  context.save();
  context.beginPath();
  context.roundRect(logo.x, logo.y, logo.width, logo.height, p.logoRadius);
  context.clip();
  const band = logo.width / LOGO_COLORS.length;
  LOGO_COLORS.forEach((color, index) => {
    context.fillStyle = color;
    context.fillRect(logo.x + index * band, logo.y, band, logo.height);
  });
  context.restore();
  context.strokeStyle = SITE_COLORS.ink;
  context.lineWidth = p.logoBorder;
  context.beginPath();
  context.roundRect(logo.x, logo.y, logo.width, logo.height, p.logoRadius);
  context.stroke();
}

/**
 * Sets the context's font to the largest size from `size` down to `smallest` at which the text
 * fits the width, and returns the text, cut short with an ellipsis if it doesn't fit even then.
 */
function fitText(context: CanvasRenderingContext2D, text: string, width: number, size: number, smallest: number, weight: number): string {
  context.font = `${weight} ${size}px ${FONT_FAMILY}`;
  const fitted = Math.max(smallest, Math.min(size, Math.floor((size * width) / context.measureText(text).width)));
  context.font = `${weight} ${fitted}px ${FONT_FAMILY}`;
  let shown = text;
  while (shown.length > 1 && context.measureText(shown).width > width) shown = `${shown.slice(0, -2)}…`;
  return shown;
}

function sizedCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function inset({ x, y, width, height }: Box, by: number): Box {
  return { x: x + by, y: y + by, width: width - 2 * by, height: height - 2 * by };
}

function scaled({ x, y, width, height }: Box, by: number): Box {
  return { x: x * by, y: y * by, width: width * by, height: height * by };
}
