import type { GalleryEntry } from '../atlas/gallery-data.ts';
import { dateOf, nameOf, titleOf } from '../atlas/painting-text.ts';
import type { Dot } from './dot-hits.ts';
import type { IndexLayers } from './index-layers.ts';
import type { LabQuery } from './lab-query.ts';
import type { SearchReplay } from './search-replay.ts';
import type { StackView } from './stack-view.ts';

/** The column of the layers' labels, and the room between it and the boards, in CSS pixels. */
const LABEL_COLUMN = 140;
const LABEL_GAP = 28;
/** A stage narrower than this leaves the labels out, giving the boards all its width. */
const LABELED_FROM = 560;
/** How far above a dot its painting's label stands, and the width of the picture asked for it. */
const LABEL_RISE = 14;
const LABEL_PICTURE_WIDTH = 160;

/**
 * The stage the stack stands on (StackView): beside each board its layer's name, how many
 * paintings live on it and, once the search comes to it, how many it measured there; the
 * picture searched for on the pin's head; and over a painting pointed at, its label. A click on a
 * painting opens its page.
 */
export class LabStage {
  readonly element = document.createElement('section');
  readonly #view: StackView;
  readonly #layers: IndexLayers;
  readonly #entry: (position: number) => Promise<GalleryEntry>;
  readonly #labels = document.createElement('div');
  readonly #pinHead = document.createElement('figure');
  readonly #dotLabel = document.createElement('div');
  #replay: SearchReplay | undefined;
  /** The replay the labels show the work of. */
  #labeled: SearchReplay | undefined;
  #nearest: readonly number[] = [];
  #pointed: Dot | undefined;

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
    this.#dotLabel.setAttribute('aria-hidden', 'true');
    this.element.append(view.canvas, this.#labels, this.#pinHead, this.#dotLabel);
    view.canvas.addEventListener('pointermove', (event) => void this.#point(event));
    view.canvas.addEventListener('pointerleave', () => this.#leave());
    view.canvas.addEventListener('click', () => void this.#open());
  }

  /** Puts the picture searched for on the pin's head. */
  showQuery({ picture }: LabQuery): void {
    (this.#pinHead.querySelector('img') as HTMLImageElement).src = picture;
  }

  /** Lays the stack out over the stage as it is now, with its labels beside the boards. */
  layout(): void {
    const { width, height } = this.element.getBoundingClientRect();
    const labeled = width >= LABELED_FROM;
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
    this.#pinHead.style.left = `${this.#view.pinX}px`;
    this.#labeled = undefined;
    if (this.#replay) this.show(this.#replay, this.#nearest);
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

  /** Names the painting pointed at, if any, over its dot. */
  async #point(event: PointerEvent): Promise<void> {
    const box = this.#view.canvas.getBoundingClientRect();
    const dot = this.#view.pick(event.clientX - box.left, event.clientY - box.top, new Set(this.#nearest));
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
    const picture = document.createElement('img');
    picture.alt = '';
    picture.src = image.urlAtLeast(LABEL_PICTURE_WIDTH * devicePixelRatio);
    const title = document.createElement('b');
    title.textContent = titleOf(painting);
    const words = document.createElement('span');
    words.append(title, `${nameOf(artist)}, ${dateOf(painting)}`);
    this.#dotLabel.replaceChildren(picture, words);
    this.#dotLabel.hidden = false;
    const width = this.#dotLabel.offsetWidth;
    this.#dotLabel.style.left = `${Math.min(Math.max(0, dot.x - width / 2), box.width - width)}px`;
    this.#dotLabel.style.top = `${dot.y - this.#dotLabel.offsetHeight - LABEL_RISE}px`;
  }

  #leave(): void {
    this.#pointed = undefined;
    this.#dotLabel.hidden = true;
    this.#redraw();
  }

  async #open(): Promise<void> {
    if (!this.#pointed) return;
    const { painting } = await this.#entry(this.#pointed.node);
    location.assign(`./painting.html?id=${painting.id}`);
  }

  #redraw(): void {
    if (this.#replay) this.#view.draw(this.#replay, this.#nearest, this.#pointed);
  }
}
