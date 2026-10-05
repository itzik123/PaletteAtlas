import './studio.css';
import { OkLab } from '@palette-atlas/color';
import { type AxisName, NO_SEGMENT, type NamedStrip, type Strip } from '@palette-atlas/strip';
import { UPLOAD_ICON } from '../icons.ts';
import { siteSrgb } from '../site-colors.ts';
import { AxisPicker } from './axis-picker.ts';
import { FileIntake, isImage } from './file-intake.ts';
import { PictureView, type Spot } from './picture-view.ts';
import { savePng } from './save-png.ts';
import { STRIP_FORMATS, type StripFormat } from './strip-formats.ts';
import type { ReadImage, StripReader } from './strip-reader.ts';
import { StripView } from './strip-view.ts';
import { Toast } from './toast.ts';

/** Segments at least this light (OKLab L) are uncovered from a dark veil, darker ones from a light one. */
const LIGHT_SEGMENT = 0.6;
/** The page's ink and paper, the two veils. */
const INK = siteSrgb('ink');
const PAPER = siteSrgb('paper');

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
  readonly #reader: StripReader;
  readonly #intake: FileIntake;
  #strips: readonly NamedStrip[] = [];
  /** The image's file name without its extension, which names what the Studio saves. */
  #title = '';
  /** The strip along the picked axis. */
  #shown: Strip | undefined;
  /** Counts the files handed in, so that only the latest one is shown when several arrive at once. */
  #latest = 0;

  constructor(reader: StripReader) {
    this.#reader = reader;
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
    const saves = document.createElement('div');
    saves.className = 'saves';
    saves.append(...STRIP_FORMATS.map((format) => this.#saveButton(format)));
    const controls = document.createElement('div');
    controls.className = 'controls';
    controls.append(this.#picker.element, saves);
    // A tab on the picture's card: a new image takes this one's place.
    this.#picture.element.append(another);
    const workspace = document.createElement('section');
    workspace.className = 'workspace';
    workspace.append(this.#picture.element, controls, this.#strip.element);
    return workspace;
  }

  #saveButton(format: StripFormat): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'pill dark';
    button.innerHTML = `${format.icon}<span>${format.label}</span>`;
    button.addEventListener('click', () => void this.#save(format));
    return button;
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
    const read = await this.#reader.read(file);
    if (ticket !== this.#latest) {
      read?.picture.close();
      return;
    }
    this.element.removeAttribute('aria-busy');
    if (read) this.#show(file.name, read);
    else this.#toast.show(`Couldn’t open “${file.name}”.`);
  }

  #show(name: string, { picture, strips }: ReadImage): void {
    this.#toast.hide();
    this.#strips = strips;
    this.#title = name.replace(/\.[^.]*$/, '');
    this.#picture.show(picture, name);
    this.#showAxis(this.#picker.axis);
    this.element.dataset.state = 'loaded';
  }

  #showAxis(axis: AxisName): void {
    this.#shown = this.#strips.find((strip) => strip.axis === axis)?.strip;
    if (this.#shown) this.#strip.show(this.#shown);
    this.#picture.clear();
  }

  async #save(format: StripFormat): Promise<void> {
    if (!this.#shown) return;
    const { axis } = this.#picker;
    const picture = await format.draw(this.#shown, { title: this.#title, axis });
    await savePng(picture, `${this.#title}-${axis}-${format.suffix}.png`);
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
