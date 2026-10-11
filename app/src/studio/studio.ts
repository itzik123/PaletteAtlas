import './studio.css';
import { OkLab } from '@palette-atlas/color';
import { type AxisName, NO_SEGMENT, type NamedStrip, type Strip } from '@palette-atlas/strip';
import { ImageQueries, imageQuery, MATCHES_PAGE } from '../atlas/image-query.ts';
import { fetchOk } from '../fetching.ts';
import { SEARCH_ICON, UPLOAD_ICON } from '../icons.ts';
import { siteSrgb } from '../site-colors.ts';
import { AxisPicker } from './axis-picker.ts';
import { dropOverlay, FileIntake, isImage } from './file-intake.ts';
import { PictureView, type Spot } from './picture-view.ts';
import { SampleWall } from './sample-wall.ts';
import { SAMPLES, type Sample } from './samples.ts';
import { savePng } from './save-png.ts';
import { STRIP_FORMATS, type StripFormat } from './strip-formats.ts';
import type { ReadImage, StripReader } from './strip-reader.ts';
import { StripView } from './strip-view.ts';
import { Toast } from './toast.ts';

/** Segments at least this light (OKLab L) are uncovered from a dark veil, darker ones from a light one. */
const LIGHT_SEGMENT = 0.6;
/** What names a saved strip when its image's file name has nothing before the extension. */
const UNTITLED = 'Untitled';
/** The page's ink and paper, the two veils. */
const INK = siteSrgb('ink');
const PAPER = siteSrgb('paper');

/**
 * The Studio: an image dropped, chosen or pasted in becomes its strip, read along the axis the
 * user picks. Until the first image arrives, the page is one big invitation to drop it. Pointing
 * at a segment of the strip uncovers the pixels it came from, and pointing at the picture pins
 * the segment that pixel went into. A tab on the strip opens the paintings in the image's colors,
 * on the Atlas's wall.
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
  /** The page's heading with an image: its name, for those who hear the page rather than see it. */
  readonly #heading = document.createElement('h1');
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
    this.#intake = new FileIntake(this.element, {
      onFile: (file) => void this.#openFile(file),
      onSample: (id) => {
        const sample = SAMPLES.find((candidate) => candidate.id === id);
        if (sample) void this.#openSample(sample);
      },
    });
    this.element.append(this.#intro(), this.#workspace(), dropOverlay(), this.#toast.element);
  }

  /**
   * What the page shows before the first image: a headline over a wall of famous paintings to
   * try, and a big target to drop an image on.
   */
  #intro(): HTMLElement {
    const intro = document.createElement('section');
    intro.className = 'intro';
    intro.innerHTML = `
      <div class="intro-text">
        <h1>Turn any image into a <span class="strip-word">strip</span> of color.</h1>
        <p class="wall-hint pointer-only">or drag in a classic →</p>
        <p class="wall-hint touch-only">or tap a classic</p>
      </div>
      <div class="drop-stage">
        <span class="shape circle" aria-hidden="true"></span>
        <span class="shape arch" aria-hidden="true"></span>
        <span class="shape square" aria-hidden="true"></span>
      </div>
    `;
    intro.querySelector('.intro-text')?.append(new SampleWall(SAMPLES, (sample) => void this.#openSample(sample)).element);
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
    // And one on the strip: the paintings in its colors, on the Atlas's wall.
    const find = document.createElement('button');
    find.type = 'button';
    find.className = 'pill find-paintings';
    find.innerHTML = `${SEARCH_ICON}<span>Find paintings</span>`;
    find.addEventListener('click', () => this.#findPaintings());
    this.#strip.element.append(find);
    const workspace = document.createElement('section');
    workspace.className = 'workspace';
    this.#heading.className = 'visually-hidden';
    workspace.append(this.#heading, this.#picture.element, controls, this.#strip.element);
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

  async #openFile(file: File): Promise<void> {
    if (!isImage(file)) {
      this.#toast.show(`“${file.name}” is not an image.`);
      return;
    }
    await this.open(file.name, async () => file);
  }

  /** Opens a painting from the wall as if its file had been dropped, named after its title. */
  async #openSample(sample: Sample): Promise<void> {
    await this.open(`${sample.title}.webp`, async () => (await fetchOk(sample.image)).blob());
  }

  /**
   * Loads an image, reads it into its strips and shows it, unless another image has been handed in
   * since: the latest one wins, however long each takes to arrive and be read. Any failure along the
   * way ends in a message rather than a page left waiting. The name, a file name, names what the
   * Studio saves. Images dropped, chosen, pasted or picked from the wall come in this way, and so
   * does a painting opened from the Atlas.
   */
  async open(name: string, load: () => Promise<Blob>): Promise<void> {
    const ticket = ++this.#latest;
    this.element.setAttribute('aria-busy', 'true');
    const read = await load()
      .then((image) => this.#reader.read(image))
      .catch(() => undefined);
    if (ticket !== this.#latest) {
      read?.picture.close();
      return;
    }
    this.element.removeAttribute('aria-busy');
    if (!read) {
      this.#toast.show(`Couldn’t open “${name}”.`);
    } else if (!showsAnything(read.strips)) {
      read.picture.close();
      this.#toast.show(`“${name}” has nothing visible to read.`);
    } else {
      this.#show(name, read);
    }
  }

  #show(name: string, { picture, strips }: ReadImage): void {
    this.#toast.hide();
    this.#strips = strips;
    this.#title = name.replace(/\.[^.]*$/, '') || UNTITLED;
    this.#heading.textContent = this.#title;
    this.#picture.show(picture, this.#title);
    this.#showAxis(this.#picker.axis);
    this.element.dataset.state = 'loaded';
  }

  #showAxis(axis: AxisName): void {
    this.#shown = this.#strips.find((strip) => strip.axis === axis)?.strip;
    if (this.#shown) this.#strip.show(this.#shown);
    this.#picture.clear();
  }

  /** Opens the Atlas on the paintings nearest the image's colors (see ImageQueries). */
  #findPaintings(): void {
    const colors = this.#strips.find(({ axis }) => axis === 'color')?.strip;
    if (!colors) return;
    ImageQueries.hand(imageQuery(this.#picture.picture, colors.toImage()));
    location.assign(MATCHES_PAGE);
  }

  async #save(format: StripFormat): Promise<void> {
    if (!this.#shown) return;
    const { axis } = this.#picker;
    try {
      const picture = await format.draw(this.#shown, { title: this.#title, axis });
      await savePng(picture, `${this.#title}-${axis}-${format.suffix}.png`);
    } catch {
      this.#toast.show(`Couldn’t save the ${format.label.toLowerCase()}.`);
    }
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

/**
 * Whether any strip has a segment with a color. An image without a single visible pixel has none:
 * its color strip has no segments at all, and every other segment is empty.
 */
function showsAnything(strips: readonly NamedStrip[]): boolean {
  return strips.some(({ strip }) =>
    Array.from({ length: strip.segmentCount }, (_, segment) => strip.colorAt(segment)).some((color) => color !== undefined),
  );
}
