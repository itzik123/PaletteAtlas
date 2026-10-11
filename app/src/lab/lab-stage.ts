import type { GalleryEntry } from '../atlas/gallery-data.ts';
import { dateOf, nameOf, titleOf } from '../atlas/painting-text.ts';
import type { Point } from './board-stack.ts';
import type { Dot } from './dot-hits.ts';
import type { IndexLayers } from './index-layers.ts';
import type { LabQuery } from './lab-query.ts';
import type { SearchReplay } from './search-replay.ts';
import type { StackView } from './stack-view.ts';

/** The column of the layers' labels, and the room between it and the boards, in CSS pixels. */
const LABEL_COLUMN = 140;
const LABEL_GAP = 28;
/**
 * A stage narrower than this leaves the labels out, giving the boards all its width; so does one
 * too short for a label between each board and the next (a phone on its side).
 */
const LABELED_FROM = 560;
/** How far above a dot its painting's label stands, and the width of the picture asked for it. */
const LABEL_RISE = 14;
const LABEL_PICTURE_WIDTH = 160;

/**
 * The stage the stack stands on (StackView): beside each board its layer's name, how many
 * paintings live on it and, once the search comes to it, how many it measured there; the
 * picture searched for on the pin's head; and over a painting pointed at, its label. A click on a
 * painting opens its page; on a touch screen, a tap shows its label, and a tap on the label opens
 * the page, as on a Career Barcode. The magnifier moves where it is dragged, so it never hides what
 * the visitor wants to see; a handle over it takes the pointer, so nothing behind it is named.
 */
export class LabStage {
  readonly element = document.createElement('section');
  readonly #view: StackView;
  readonly #layers: IndexLayers;
  readonly #entry: (position: number) => Promise<GalleryEntry>;
  readonly #labels = document.createElement('div');
  readonly #pinHead = document.createElement('figure');
  readonly #dotLabel = document.createElement('a');
  readonly #glass = document.createElement('div');
  /** While the magnifier is dragged: where the pointer and the glass's middle were when it was pressed. */
  #drag: { readonly pointer: Point; readonly glass: Point } | undefined;
  #replay: SearchReplay | undefined;
  /** The replay the labels show the work of. */
  #labeled: SearchReplay | undefined;
  #nearest: readonly number[] = [];
  #pointed: Dot | undefined;
  /** Whether the last pointer pressed on the stack was a mouse, whose click opens a painting at once. */
  #mouse = true;

  constructor(view: StackView, layers: IndexLayers, entry: (position: number) => Promise<GalleryEntry>) {
    this.#view = view;
    this.#layers = layers;
    this.#entry = entry;
    this.element.className = 'stack-stage';
    this.element.setAttribute('aria-label', 'The search, layer by layer');
    this.#labels.className = 'sheet-labels';
    this.#pinHead.className = 'pin-head';
    this.#pinHead.innerHTML = '<img alt="" />';
    this.#dotLabel.className = 'dot-label';
    this.#dotLabel.hidden = true;
    // The nearest paintings' tiles name them to screen readers and the keyboard.
    this.#dotLabel.setAttribute('aria-hidden', 'true');
    this.#dotLabel.tabIndex = -1;
    this.#glass.className = 'magnifier';
    this.#glass.setAttribute('aria-hidden', 'true');
    this.element.append(view.canvas, this.#labels, this.#glass, this.#pinHead, this.#dotLabel);
    this.#glass.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      this.#glass.setPointerCapture(event.pointerId);
      this.#drag = { pointer: [event.clientX, event.clientY], glass: view.glass.center };
      this.#glass.classList.add('dragged');
    });
    this.#glass.addEventListener('pointermove', (event) => {
      if (!this.#drag) return;
      const { pointer, glass } = this.#drag;
      view.moveGlass([glass[0] + event.clientX - pointer[0], glass[1] + event.clientY - pointer[1]]);
      this.#placeGlass();
      this.#redraw();
    });
    this.#glass.addEventListener('lostpointercapture', () => {
      this.#drag = undefined;
      this.#glass.classList.remove('dragged');
    });
    view.canvas.addEventListener('pointermove', (event) => {
      if (event.pointerType === 'mouse') void this.#point(event);
    });
    view.canvas.addEventListener('pointerleave', (event) => {
      if (event.pointerType === 'mouse') void this.#name(undefined);
    });
    view.canvas.addEventListener('pointerdown', (event) => {
      this.#mouse = event.pointerType === 'mouse';
      void this.#point(event);
    });
    view.canvas.addEventListener('click', () => {
      if (this.#mouse) void this.#open();
    });
    // A tap anywhere else puts the label away.
    document.addEventListener('pointerdown', (event) => {
      if (event.target !== view.canvas && !this.#dotLabel.contains(event.target as Node)) void this.#name(undefined);
    });
  }

  /** Puts the picture searched for on the pin's head. */
  showQuery({ picture }: LabQuery): void {
    (this.#pinHead.querySelector('img') as HTMLImageElement).src = picture;
  }

  /** Lays the stack out over the stage as it is now, with its labels beside the boards where they fit. */
  layout(): void {
    const { width, height } = this.element.getBoundingClientRect();
    this.#lay(width, height, width >= LABELED_FROM);
    if (!this.#labels.hidden && this.#labelsCrowd()) this.#lay(width, height, false);
    this.#pinHead.style.left = `${this.#view.pinX}px`;
    this.#placeGlass();
    this.#labeled = undefined;
    if (this.#replay) this.show(this.#replay, this.#nearest);
  }

  /** Lays the boards out, beside a column of their labels or across the whole stage. */
  #lay(width: number, height: number, labeled: boolean): void {
    this.#view.layout(width, height, labeled ? LABEL_COLUMN + LABEL_GAP : 0);
    this.#labels.hidden = !labeled;
    this.#labels.replaceChildren(
      ...this.#view.boards.map(({ level, top, depth }) => {
        const label = document.createElement('div');
        label.className = 'sheet-label';
        label.dataset.level = String(level);
        label.style.top = `${top + depth / 2}px`;
        label.style.width = `${LABEL_COLUMN}px`;
        label.innerHTML = `<b>Layer ${level}</b><span>${this.#layers.nodesOn(level).length.toLocaleString('en')} paintings</span><em></em>`;
        return label;
      }),
    );
  }

  /** Whether any label, centered on its board, reaches the one under it. */
  #labelsCrowd(): boolean {
    const boxes = [...this.#labels.children].map((label) => label.getBoundingClientRect());
    return boxes.some((box, below) => below > 0 && box.top < (boxes[below - 1]?.bottom ?? box.top));
  }

  /** Shows the search as far as it is replayed, and the nearest it has found by then. */
  show(replay: SearchReplay, nearest: readonly number[]): void {
    if (replay !== this.#labeled) {
      this.#labeled = replay;
      for (const label of this.#labels.querySelectorAll<HTMLElement>('.sheet-label')) {
        const level = Number(label.dataset.level);
        const work = replay.layers.get(level);
        label.classList.toggle('now', !replay.done && replay.level === level);
        (label.querySelector('em') as HTMLElement).textContent = work ? `${work.measured.size.toLocaleString('en')} measured` : '';
      }
    }
    this.#replay = replay;
    this.#nearest = nearest;
    this.#view.draw(replay, nearest, this.#pointed);
  }

  /** Names the painting pointed at, if any: a finger's reach is wider than a mouse's. */
  async #point(event: PointerEvent): Promise<void> {
    const box = this.#view.canvas.getBoundingClientRect();
    await this.#name(this.#view.pick(event.clientX - box.left, event.clientY - box.top, new Set(this.#nearest), event.pointerType !== 'mouse'));
  }

  /** Rings a painting's dot and shows its label over it, or puts them away for none. */
  async #name(dot: Dot | undefined): Promise<void> {
    if (dot?.node === this.#pointed?.node && dot?.level === this.#pointed?.level) return;
    this.#pointed = dot;
    this.#view.canvas.style.cursor = dot ? 'pointer' : '';
    this.#redraw();
    if (!dot) {
      this.#dotLabel.hidden = true;
      return;
    }
    const { painting, artist, image } = await this.#entry(dot.node);
    if (this.#pointed !== dot) return;
    this.#dotLabel.href = `./painting.html?id=${painting.id}`;
    // Shown by a tap, it can be tapped; shown by a mouse, it stays out of the pointer's way.
    this.#dotLabel.classList.toggle('tapped', !this.#mouse);
    const picture = document.createElement('img');
    picture.alt = '';
    picture.src = image.urlAtLeast(LABEL_PICTURE_WIDTH * devicePixelRatio);
    const title = document.createElement('b');
    title.textContent = titleOf(painting);
    const words = document.createElement('span');
    words.append(title, `${nameOf(artist)}, ${dateOf(painting)}`);
    this.#dotLabel.replaceChildren(picture, words);
    this.#dotLabel.hidden = false;
    const { width, height } = this.#dotLabel.getBoundingClientRect();
    const stage = this.element.clientWidth;
    this.#dotLabel.style.left = `${Math.min(Math.max(0, dot.x - width / 2), stage - width)}px`;
    // Over the dot, or under it where the stage has no room above it.
    const above = dot.y - height - LABEL_RISE;
    this.#dotLabel.style.top = `${above >= 0 ? above : dot.y + LABEL_RISE}px`;
  }

  async #open(): Promise<void> {
    if (!this.#pointed) return;
    const { painting } = await this.#entry(this.#pointed.node);
    location.assign(`./painting.html?id=${painting.id}`);
  }

  /** Puts the magnifier's handle over the glass as drawn. */
  #placeGlass(): void {
    const { center, radius } = this.#view.glass;
    this.#glass.style.left = `${center[0] - radius}px`;
    this.#glass.style.top = `${center[1] - radius}px`;
    this.#glass.style.width = this.#glass.style.height = `${2 * radius}px`;
  }

  #redraw(): void {
    if (this.#replay) this.#view.draw(this.#replay, this.#nearest, this.#pointed);
  }
}
