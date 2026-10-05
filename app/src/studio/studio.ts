import './studio.css';
import { OkLab, type RgbaImage, Srgb } from '@palette-atlas/color';
import { type AxisName, ImageStrips, NO_SEGMENT, type Strip } from '@palette-atlas/strip';
import { decodeImage } from '../image-adapters.ts';
import { UPLOAD_ICON } from '../icons.ts';
import { AxisPicker } from './axis-picker.ts';
import { FileIntake, isImage } from './file-intake.ts';
import { PictureView, type Spot } from './picture-view.ts';
import { StripView } from './strip-view.ts';
import { Toast } from './toast.ts';

/** Segments at least this light (OKLab L) are uncovered from a dark veil, darker ones from a light one. */
const LIGHT_SEGMENT = 0.6;
/** The page's ink and paper (see style.css), the two veils. */
const INK = Srgb.fromBytes(0x18, 0x14, 0x0f);
const PAPER = Srgb.fromBytes(0xf7, 0xf1, 0xe6);

/**
 * The Studio: an image dropped, chosen or pasted in becomes its strip, read along the axis the
 * user picks. Until the first image arrives, the page is one big invitation to drop it. Pointing
 * at a segment of the strip uncovers the pixels it came from, and pointing at the picture pins
 * the segment that pixel went into.
 *
 * Mediator: the picture, the strip and the axis picker know nothing of each other; the Studio
 * links them through the source map of the strip on show.
 */
export class Studio {
  readonly element = document.createElement('main');
  readonly #picture = new PictureView((spot) => this.#pointAtPicture(spot));
  readonly #strip = new StripView((segment) => this.#point(segment));
  readonly #picker = new AxisPicker((axis) => this.#showAxis(axis));
  readonly #toast = new Toast();
  readonly #intake: FileIntake;
  #strips: ImageStrips | undefined;
  /** The strip along the picked axis. */
  #shown: Strip | undefined;
  /** Counts the files handed in, so that only the latest one is shown when several arrive at once. */
  #latest = 0;

  constructor() {
    this.element.className = 'studio';
    this.element.dataset.state = 'empty';
    this.#intake = new FileIntake(this.element, (file) => void this.#open(file));
    this.element.append(this.#intro(), this.#workspace(), dropOverlay(), this.#toast.element);
  }

  /** What the page shows before the first image: a headline and a big target to drop it on. */
  #intro(): HTMLElement {
    const intro = document.createElement('section');
    intro.className = 'intro';
    intro.innerHTML = `
      <h1>Turn any image into a <span class="strip-word">strip</span> of color.</h1>
      <div class="drop-stage">
        <span class="shape circle" aria-hidden="true"></span>
        <span class="shape arch" aria-hidden="true"></span>
        <span class="shape square" aria-hidden="true"></span>
      </div>
    `;
    intro.querySelector('.drop-stage')?.append(this.#dropZone());
    return intro;
  }

  /** What the page shows with an image: the picture, the axis to read it by, and its strip. */
  #workspace(): HTMLElement {
    const another = document.createElement('button');
    another.type = 'button';
    another.className = 'pill another';
    another.innerHTML = `${UPLOAD_ICON}<span>New image</span>`;
    another.addEventListener('click', () => this.#intake.choose());
    const controls = document.createElement('div');
    controls.className = 'controls';
    controls.append(this.#picker.element, another);
    const workspace = document.createElement('section');
    workspace.className = 'workspace';
    workspace.append(this.#picture.element, controls, this.#strip.element);
    return workspace;
  }

  #dropZone(): HTMLButtonElement {
    const zone = document.createElement('button');
    zone.type = 'button';
    zone.className = 'drop-zone';
    zone.innerHTML = `
      <span class="drop-art" aria-hidden="true"><i class="sun"></i><i class="hill"></i><i class="peak"></i></span>
      <span class="drop-title pointer-only">Drop an image</span>
      <span class="drop-title touch-only">Pick an image</span>
      <span class="drop-hint pointer-only">or click to choose one</span>
    `;
    zone.addEventListener('click', () => this.#intake.choose());
    return zone;
  }

  async #open(file: File): Promise<void> {
    if (!isImage(file)) {
      this.#toast.show(`“${file.name}” is not an image.`);
      return;
    }
    const ticket = ++this.#latest;
    this.element.setAttribute('aria-busy', 'true');
    // The browser can't decode every image type (HEIC, for one) and turns away broken files.
    const image = await decodeImage(file).catch(() => undefined);
    if (ticket !== this.#latest) return;
    this.element.removeAttribute('aria-busy');
    if (image) this.#show(file.name, image);
    else this.#toast.show(`Couldn’t open “${file.name}”.`);
  }

  #show(name: string, image: RgbaImage): void {
    this.#toast.hide();
    this.#strips = ImageStrips.read(image);
    this.#picture.show(image, name);
    this.#showAxis(this.#picker.axis);
    this.element.dataset.state = 'loaded';
  }

  #showAxis(axis: AxisName): void {
    this.#shown = this.#strips?.strips.find((strip) => strip.axis === axis)?.strip;
    if (this.#shown) this.#strip.show(this.#shown);
    this.#picture.clear();
  }

  #pointAtPicture(spot: Spot | undefined): void {
    const map = this.#shown?.sourceMap;
    this.#point(spot && map?.segmentAt(Math.floor(spot.x * map.width), Math.floor(spot.y * map.height)));
  }

  /** Shows where a segment came from on the picture and pins it on the strip, or shows none. */
  #point(segment: number | undefined): void {
    if (!this.#shown || segment === undefined || segment === NO_SEGMENT) {
      this.#picture.clear();
      this.#strip.unmark();
      return;
    }
    const color = this.#shown.colorAt(segment);
    this.#picture.highlight(this.#shown.sourceMap, segment, color && OkLab.fromSrgb(color).l >= LIGHT_SEGMENT ? INK : PAPER);
    this.#strip.mark(segment, color);
  }
}

/** Covers the page while a file is dragged over it (see FileIntake). */
function dropOverlay(): HTMLElement {
  const overlay = document.createElement('div');
  overlay.className = 'drop-overlay';
  overlay.setAttribute('aria-hidden', 'true');
  overlay.innerHTML = '<span>Drop it!</span>';
  return overlay;
}
