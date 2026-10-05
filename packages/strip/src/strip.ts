import { BucketMeans, BYTES_PER_PIXEL, Channel, type RgbaImage, Srgb } from '@palette-atlas/color';
import { NO_SEGMENT, SourceMap, type SourceMapData } from './source-map.ts';
import type { StripAxis } from './strip-axis.ts';

/** A strip as plain data, which the structured clone algorithm copies whole (see Strip.toData). */
export interface StripData {
  readonly sourceMap: SourceMapData;
  /** One pixel per segment. */
  readonly colors: RgbaImage;
}

/**
 * An image read along an axis: one color per segment, the mean of its pixels in linear light,
 * together with the source map that says which pixels each segment came from.
 */
export class Strip {
  readonly sourceMap: SourceMap;
  /** One pixel per segment. */
  readonly #colors: RgbaImage;

  private constructor(sourceMap: SourceMap, colors: RgbaImage) {
    this.sourceMap = sourceMap;
    this.#colors = colors;
  }

  /** Reads an image along an axis into at most `segments` segments. */
  static read(image: RgbaImage, axis: StripAxis, segments: number): Strip {
    const sourceMap = axis.sourceMap(image, segments);
    const means = new BucketMeans(sourceMap.segmentCount);
    const { width, height, data } = image;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const segment = sourceMap.segmentAt(x, y);
        if (segment === NO_SEGMENT) continue;
        const pixel = (y * width + x) * BYTES_PER_PIXEL;
        means.add(
          segment,
          data[pixel + Channel.red],
          data[pixel + Channel.green],
          data[pixel + Channel.blue],
          data[pixel + Channel.alpha],
        );
      }
    }
    return new Strip(sourceMap, means.toImage());
  }

  /** A strip from its plain data, which it takes ownership of. */
  static fromData({ sourceMap, colors }: StripData): Strip {
    const map = SourceMap.fromData(sourceMap);
    if (colors.width !== map.segmentCount || colors.height !== 1) {
      throw new RangeError(`Expected ${map.segmentCount} × 1 colors, got ${colors.width} × ${colors.height}`);
    }
    return new Strip(map, colors);
  }

  /** The strip as plain data with copies of its colors and source map, for passing it between threads. */
  toData(): StripData {
    return { sourceMap: this.sourceMap.toData(), colors: this.toImage() };
  }

  get segmentCount(): number {
    return this.sourceMap.segmentCount;
  }

  /** A segment's mean color, or undefined if it holds no visible pixel. */
  colorAt(segment: number): Srgb | undefined {
    if (!Number.isInteger(segment) || segment < 0 || segment >= this.segmentCount) {
      throw new RangeError(`Segment ${segment} is outside 0 to ${this.segmentCount - 1}`);
    }
    const { data } = this.#colors;
    const pixel = segment * BYTES_PER_PIXEL;
    if (data[pixel + Channel.alpha] === 0) return undefined;
    return Srgb.fromBytes(data[pixel + Channel.red], data[pixel + Channel.green], data[pixel + Channel.blue]);
  }

  /** The strip as a copy of its colors: an image one pixel high, one pixel per segment. */
  toImage(): RgbaImage {
    return { width: this.segmentCount, height: 1, data: this.#colors.data.slice() };
  }

  /** The strip folded back into the image's shape: every pixel painted with its segment's color. */
  foldBack(): RgbaImage {
    const { width, height } = this.sourceMap;
    const colors = this.#colors.data;
    const data = new Uint8ClampedArray(width * height * BYTES_PER_PIXEL);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const segment = this.sourceMap.segmentAt(x, y);
        if (segment === NO_SEGMENT) continue;
        const source = segment * BYTES_PER_PIXEL;
        const target = (y * width + x) * BYTES_PER_PIXEL;
        for (let channel = 0; channel < BYTES_PER_PIXEL; channel++) data[target + channel] = colors[source + channel];
      }
    }
    return { width, height, data };
  }
}
