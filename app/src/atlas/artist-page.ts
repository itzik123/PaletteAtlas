import { BACK_ICON, CLOSE_ICON, LIST_ICON, NEXT_ICON, PREVIOUS_ICON } from '../icons.ts';
import { CareerView } from './career-view.ts';
import type { Career, GalleryData, Painter } from './gallery-data.ts';
import { PainterList } from './painter-list.ts';
import { nameOf } from './painting-text.ts';

/** Up to this width the list of painters opens over the page rather than beside the career, as atlas.css lays it out. */
const NARROW = '(max-width: 860px)';

/**
 * How long a painter is shown before the page's address names them: going through painters at a
 * key's repeat rate would change it faster than some browsers allow.
 */
const ADDRESS_DELAY_MS = 300;

/** The buttons and keys to the painter before and the painter after. */
const STEPS = [
  { offset: -1, key: 'ArrowLeft', label: 'Previous painter', icon: PREVIOUS_ICON },
  { offset: 1, key: 'ArrowRight', label: 'Next painter', icon: NEXT_ICON },
] as const;

/**
 * The Career Barcodes: the list of painters (see PainterList) beside the career of the one shown
 * (see CareerView), with the painters before and after them in the list a button or an arrow key
 * away, each button naming its painter as it is pointed at. On a narrow screen the list opens over
 * the page and closes as a painter is picked. The page's address names the painter shown, so that
 * a reload, or the way back from one of their paintings, comes back to them.
 * Mediator: the list, the career and the buttons know nothing of one another; the page passes on
 * what each does.
 */
export class ArtistPage {
  readonly element = document.createElement('main');
  readonly #data: GalleryData;
  readonly #panel = document.createElement('dialog');
  readonly #list: PainterList;
  readonly #career = new CareerView();
  readonly #narrow = matchMedia(NARROW);
  /** Each step button's tooltip, which names the painter it leads to. */
  readonly #tooltips = new Map<-1 | 1, HTMLElement>();
  #shown: Painter;
  /** Counts the careers asked for, so that only the last one is shown, whatever order they arrive in. */
  #asked = 0;
  #addressTimer: ReturnType<typeof setTimeout> | undefined;

  /** Shows a painter's career, with every painter to go to, given the most famous first. */
  constructor(data: GalleryData, painters: readonly Painter[], shown: Painter, career: Career) {
    this.#data = data;
    this.#shown = shown;
    this.#list = new PainterList(painters, (painter) => this.#pick(painter));
    this.element.className = 'artist-page';
    this.element.append(this.#bar(), this.#painterPanel(), this.#career.element);
    this.#introduce(shown);
    this.#career.show(career);

    this.#place();
    this.#narrow.addEventListener('change', () => this.#place());
    document.addEventListener('keydown', (event) => this.#key(event));
  }

  /** Back to the Atlas, the list on a narrow screen, and the painters before and after. */
  #bar(): HTMLElement {
    const bar = document.createElement('div');
    bar.className = 'artist-bar';
    bar.innerHTML = `
      <a class="pill back" href="./atlas.html">${BACK_ICON}<span>Atlas</span></a>
      <button type="button" class="pill painters-button">${LIST_ICON}<span>Painters</span></button>
    `;
    bar.querySelector('.painters-button')?.addEventListener('click', () => this.#panel.showModal());
    for (const { offset, label, icon } of STEPS) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'pill step';
      button.setAttribute('aria-label', label);
      button.innerHTML = icon;
      const tooltip = document.createElement('span');
      tooltip.className = 'tooltip';
      tooltip.setAttribute('aria-hidden', 'true');
      button.append(tooltip);
      button.addEventListener('click', () => this.#step(offset));
      this.#tooltips.set(offset, tooltip);
      bar.append(button);
    }
    // The painters before and after change with a search, so they are named afresh as a button is reached.
    bar.addEventListener('pointerover', () => this.#nameSteps());
    bar.addEventListener('focusin', () => this.#nameSteps());
    return bar;
  }

  #painterPanel(): HTMLDialogElement {
    this.#panel.className = 'painter-panel';
    this.#panel.setAttribute('aria-label', 'Painters');
    const top = document.createElement('div');
    top.className = 'panel-top';
    top.innerHTML = `<h2>Painters</h2><button type="button" class="close" aria-label="Close">${CLOSE_ICON}</button>`;
    top.querySelector('.close')?.addEventListener('click', () => this.#panel.close());
    this.#panel.append(top, this.#list.element);
    return this.#panel;
  }

  /** Puts the list beside the career on a wide screen, and away until asked for on a narrow one. */
  #place(): void {
    if (this.#panel.open) this.#panel.close();
    // Opened as part of the page rather than over it; show() would also move the focus into it.
    this.#panel.toggleAttribute('open', !this.#narrow.matches);
  }

  /** ← and → go to the painter before and after, unless they are meant for a field, or the list is over the page. */
  #key(event: KeyboardEvent): void {
    const step = STEPS.find(({ key }) => key === event.key);
    if (!step || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    // In a field, the arrows move along its text, or pick an option (of the fill switch, say).
    if (event.target instanceof HTMLInputElement || this.#panel.matches(':modal')) return;
    event.preventDefault();
    this.#step(step.offset);
  }

  /** Shows the painter picked in the list; on a narrow screen, the list makes way for them. */
  #pick(painter: Painter): void {
    if (this.#panel.matches(':modal')) this.#panel.close();
    if (painter.artist.id !== this.#shown.artist.id) this.#show(painter);
  }

  #step(offset: -1 | 1): void {
    const painter = this.#list.step(offset);
    if (painter && painter.artist.id !== this.#shown.artist.id) this.#show(painter);
  }

  /** Shows a painter at once, and their career as soon as it arrives. */
  #show(painter: Painter): void {
    this.#shown = painter;
    this.#introduce(painter);
    this.#career.wait(painter);
    void this.#load(painter);
  }

  async #load(painter: Painter): Promise<void> {
    const asked = ++this.#asked;
    const career = await this.#data.career(painter.artist.id).catch(() => undefined);
    if (asked !== this.#asked) return;
    if (career) {
      this.#career.show(career);
    } else {
      this.#career.fail(() => {
        this.#career.wait(painter);
        void this.#load(painter);
      });
    }
  }

  /** Marks the painter shown in the list, the page's title and its address. */
  #introduce({ artist }: Painter): void {
    this.#list.show(artist.id);
    document.title = `${nameOf(artist)} · Palette Atlas`;
    clearTimeout(this.#addressTimer);
    this.#addressTimer = setTimeout(() => history.replaceState(history.state, '', `?id=${artist.id}`), ADDRESS_DELAY_MS);
    this.#nameSteps();
  }

  /** Names on each step button the painter it leads to. */
  #nameSteps(): void {
    for (const [offset, tooltip] of this.#tooltips) {
      const painter = this.#list.neighbor(offset);
      tooltip.textContent = painter ? nameOf(painter.artist) : '';
    }
  }
}
