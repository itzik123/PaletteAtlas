import { AlphabetRail } from './alphabet-rail.ts';
import type { Painter } from './gallery-data.ts';
import { ListScroll } from './list-scroll.ts';
import { type Filing, fileName, OTHER_LETTER } from './name-filing.ts';
import { NameSearch } from './name-search.ts';
import { lifespanOf, nameOf, paintingCount } from './painting-text.ts';
import { SearchField } from './search-field.ts';

/** How many of the most famous painters the list opens with. */
const POPULAR_COUNT = 24;
/** What the list's opening section is called. */
const POPULAR = 'Popular';
/** The most painters a search lists: the best matches. */
const MOST_FOUND = 100;
/**
 * About how tall a painter's entry is, and what a section's heading adds to it, in CSS pixels (see
 * atlas.css): a section out of sight holds its place by them until it is laid out.
 */
const ESTIMATED_HEIGHT = { entry: 53, heading: 45 } as const;

/**
 * Every painter with a Career Barcode, to pick one from: the most famous first, then all of them
 * from A to Z, filed by their family names as museums file them (see fileName), with a rail of
 * letters to jump or slide along (see AlphabetRail), and a search that forgives slips and names the
 * gallery leaves out (see NameSearch). The keyboard goes through it as through any list: ↓ from the
 * search into the list, ↑ and ↓, Home and End from painter to painter, Enter to pick one.
 * Observer: the painter picked is reported to the listener.
 */
export class PainterList {
  readonly element = document.createElement('div');
  readonly #search: SearchField;
  /** All the painters: the most famous, then A to Z. */
  readonly #browse = document.createElement('div');
  /** The painters a search found, in place of all of them while there is a search. */
  readonly #found = document.createElement('div');
  readonly #browseScroll: ListScroll;
  readonly #foundScroll: ListScroll;
  /** How many painters a search found, for screen readers. */
  readonly #status = document.createElement('p');
  readonly #rail: AlphabetRail;
  /** The painters, the most famous first, and by their Wikidata items. */
  readonly #painters: readonly Painter[];
  readonly #byId: ReadonlyMap<string, Painter>;
  readonly #filings: ReadonlyMap<Painter, Filing>;
  /** The A to Z sections, by letter. */
  readonly #sections = new Map<string, HTMLElement>();
  /** The entries of all the painters in order, and each painter's among them: a painter can be listed twice. */
  readonly #browseEntries: readonly HTMLAnchorElement[];
  readonly #browseEntriesOf = new Map<string, HTMLAnchorElement[]>();
  /** The entries of the painters a search found, in order. */
  #foundEntries: readonly HTMLAnchorElement[] = [];
  readonly #onPick: (painter: Painter) => void;
  /** The search of the painters' names, made as the search field is first used. */
  #names: NameSearch<Painter> | undefined;
  /** The painter shown, by their Wikidata item. */
  #shown: string | undefined;
  /** The entries marked as the painter shown. */
  #marked: HTMLAnchorElement[] = [];
  /** The entry picked or stepped to last, which steps go on from. */
  #anchor: HTMLAnchorElement | undefined;
  /** The one entry the Tab key stops at. */
  #stop: HTMLAnchorElement | undefined;
  /** The letter the rail last jumped to, marked as the list scrolls there, however far short of it the list's end stops. */
  #jumpedTo: string | undefined;
  /** How far down the list of all the painters was as a search took its place, and the painter shown then. */
  #beforeSearch: { scroll: number; shown: string | undefined } = { scroll: 0, shown: undefined };

  /** Lists painters given the most famous first. */
  constructor(painters: readonly Painter[], onPick: (painter: Painter) => void) {
    this.#painters = painters;
    this.#byId = new Map(painters.map((painter) => [painter.artist.id, painter]));
    this.#filings = new Map(painters.map((painter) => [painter, fileName(nameOf(painter.artist))]));
    this.#onPick = onPick;
    this.element.className = 'painter-list';
    this.#search = new SearchField('Find a painter', {
      change: (search) => this.#find(search),
      down: () => this.#focusFirst(),
      enter: () => this.#pickFirstFound(),
    });
    // Ready by the first letter typed.
    this.#search.element.addEventListener('focusin', () => this.#nameSearch(), { once: true });
    this.#status.className = 'visually-hidden';
    this.#status.setAttribute('role', 'status');

    this.#browse.className = 'painter-scroll';
    this.#found.className = 'painter-scroll';
    this.#found.hidden = true;
    this.#browse.append(section(POPULAR, painters.slice(0, POPULAR_COUNT).map((painter) => this.#entry(painter))));
    for (const [letter, filed] of byLetter(painters, (painter) => this.#filingOf(painter))) {
      const letterSection = section(letter, filed.map((painter) => this.#entry(painter)));
      this.#sections.set(letter, letterSection);
      this.#browse.append(letterSection);
    }
    this.#browseEntries = [...this.#browse.querySelectorAll<HTMLAnchorElement>('a.painter')];
    for (const link of this.#browseEntries) {
      const id = link.dataset.id ?? '';
      const entries = this.#browseEntriesOf.get(id);
      if (entries) entries.push(link);
      else this.#browseEntriesOf.set(id, [link]);
    }
    this.#browseScroll = new ListScroll(this.#browse);
    this.#foundScroll = new ListScroll(this.#found);
    this.#rail = new AlphabetRail(new Set(this.#sections.keys()), (letter) => this.#jump(letter));
    this.element.append(this.#search.element, this.#status, this.#browse, this.#found, this.#rail.element);

    this.element.addEventListener('click', (event) => this.#click(event));
    this.element.addEventListener('keydown', (event) => this.#listKey(event));
    let framed = false;
    this.#browse.addEventListener(
      'scroll',
      () => {
        if (framed) return;
        framed = true;
        requestAnimationFrame(() => {
          framed = false;
          this.#rail.mark(this.#jumpedTo ?? this.#letterInView());
          this.#jumpedTo = undefined;
        });
      },
      { passive: true },
    );
    // As the list comes into view (as the page opens, or as it opens over the page on a phone), it
    // shows the painter shown in its middle.
    let inView = false;
    new ResizeObserver(() => {
      const nowInView = this.element.clientHeight > 0;
      const link = this.#anchorOf();
      if (nowInView && !inView && link) this.#scroll().toMiddle(itemOf(link), headingOver(link));
      inView = nowInView;
    }).observe(this.element);
  }

  /** Marks the painter shown, and scrolls the list to their entry. */
  show(id: string): void {
    const focused = document.activeElement?.matches('a.painter') && this.element.contains(document.activeElement);
    this.#shown = id;
    this.#mark();
    const link = this.#anchorOf();
    if (!link) return;
    this.#scroll().toNearest(itemOf(link), headingOver(link));
    // Going through the painters with the keyboard, the focus goes along.
    if (focused) link.focus({ preventScroll: true });
  }

  /**
   * The painter listed before or after the one shown, in the list as it is (the painters found,
   * during a search), going round from the last to the first.
   */
  neighbor(offset: -1 | 1): Painter | undefined {
    return this.#painterOf(this.#neighborOf(offset));
  }

  /** Goes on to the painter before or after the one shown (see neighbor), and gives them. */
  step(offset: -1 | 1): Painter | undefined {
    const next = this.#neighborOf(offset);
    if (next) this.#anchor = next;
    return this.#painterOf(next);
  }

  /** Lists the painters a search finds in place of all of them, or all of them again for an empty search. */
  #find(search: string): void {
    if (search.trim() === '') {
      if (!this.#found.hidden) this.#endSearch();
      this.#status.textContent = '';
      return;
    }
    if (this.#found.hidden) {
      this.#beforeSearch = { scroll: this.#browse.scrollTop, shown: this.#shown };
      this.#browseScroll.release();
      this.#browse.hidden = true;
      this.#rail.element.hidden = true;
      this.#found.hidden = false;
    }
    const found = this.#nameSearch().find(search).slice(0, MOST_FOUND);
    if (found.length > 0) {
      const list = document.createElement('ul');
      list.append(...found.map((painter) => this.#entry(painter)));
      this.#found.replaceChildren(list);
    } else {
      const none = document.createElement('p');
      none.className = 'painter-none';
      none.textContent = 'No painter by that name';
      this.#found.replaceChildren(none);
    }
    this.#foundEntries = [...this.#found.querySelectorAll<HTMLAnchorElement>('a.painter')];
    this.#found.scrollTop = 0;
    this.#status.textContent = found.length === 1 ? '1 painter' : `${found.length} painters`;
    this.#mark();
  }

  #nameSearch(): NameSearch<Painter> {
    this.#names ??= new NameSearch(this.#painters, ({ artist }) => nameOf(artist));
    return this.#names;
  }

  /** Lists all the painters again where they were, or at the painter shown if another was picked meanwhile. */
  #endSearch(): void {
    this.#found.hidden = true;
    this.#found.replaceChildren();
    this.#foundEntries = [];
    this.#browse.hidden = false;
    this.#rail.element.hidden = false;
    this.#mark();
    const link = this.#anchorOf();
    if (this.#shown === this.#beforeSearch.shown || !link) this.#browse.scrollTop = this.#beforeSearch.scroll;
    else this.#browseScroll.toMiddle(itemOf(link), headingOver(link));
  }

  #focusFirst(): void {
    const [first] = this.#entries();
    if (first) this.#focus(first);
  }

  #pickFirstFound(): void {
    const [first] = this.#foundEntries;
    if (first && !this.#found.hidden) this.#pick(first);
  }

  /** Moves the keyboard from painter to painter: ↑ and ↓, Home and End; ↑ from the first goes back to the search. */
  #listKey(event: KeyboardEvent): void {
    if (!(event.target instanceof HTMLAnchorElement)) return;
    const entries = this.#entries();
    const at = entries.indexOf(event.target);
    if (at < 0) return;
    const targets: Readonly<Record<string, HTMLAnchorElement | SearchField | undefined>> = {
      ArrowDown: entries[at + 1],
      ArrowUp: at > 0 ? entries[at - 1] : this.#search,
      Home: entries[0],
      End: entries.at(-1),
    };
    const target = targets[event.key];
    if (!target) return;
    event.preventDefault();
    if (target instanceof HTMLAnchorElement) this.#focus(target);
    else target.focus();
  }

  #click(event: MouseEvent): void {
    const link = (event.target as Element).closest<HTMLAnchorElement>('a.painter');
    // A click with a modifier key opens the painter as any link does: in a new tab, say.
    if (!link || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    this.#pick(link);
  }

  #pick(link: HTMLAnchorElement): void {
    const painter = this.#painterOf(link);
    if (!painter) return;
    this.#anchor = link;
    this.#onPick(painter);
  }

  /** The entries listed now, in order: all the painters, or the ones a search found. */
  #entries(): readonly HTMLAnchorElement[] {
    return this.#found.hidden ? this.#browseEntries : this.#foundEntries;
  }

  /** How the list as it is scrolls: all the painters, or the ones a search found. */
  #scroll(): ListScroll {
    return this.#found.hidden ? this.#browseScroll : this.#foundScroll;
  }

  #painterOf(link: HTMLAnchorElement | undefined): Painter | undefined {
    return link ? this.#byId.get(link.dataset.id ?? '') : undefined;
  }

  #filingOf(painter: Painter): Filing {
    return this.#filings.get(painter) ?? fileName(nameOf(painter.artist));
  }

  /** The entry of the painter shown in the list as it is: the one picked or stepped to last, else their first. */
  #anchorOf(): HTMLAnchorElement | undefined {
    const id = this.#shown ?? '';
    const listed = this.#found.hidden ? (this.#browseEntriesOf.get(id) ?? []) : this.#foundEntries.filter((link) => link.dataset.id === id);
    return this.#anchor && listed.includes(this.#anchor) ? this.#anchor : listed[0];
  }

  #neighborOf(offset: -1 | 1): HTMLAnchorElement | undefined {
    const entries = this.#entries();
    const anchor = this.#anchorOf();
    // A painter the list doesn't have (one the search didn't find) comes before the first and after the last.
    let at = anchor ? entries.indexOf(anchor) : offset > 0 ? -1 : entries.length;
    // Past the painter shown, listed again next to themselves (last of the most famous, first of their letter).
    for (let tried = 0; tried < entries.length; tried++) {
      at = (at + offset + entries.length) % entries.length;
      if (entries[at]?.dataset.id !== this.#shown) return entries[at];
    }
    return undefined;
  }

  /**
   * Marks the painter shown wherever they are listed, and makes their entry in the list as it is
   * (else its first) the one the Tab key stops at.
   */
  #mark(): void {
    for (const link of this.#marked) link.removeAttribute('aria-current');
    const id = this.#shown ?? '';
    this.#marked = [...(this.#browseEntriesOf.get(id) ?? []), ...this.#foundEntries.filter((link) => link.dataset.id === id)];
    for (const link of this.#marked) link.setAttribute('aria-current', 'page');
    const stop = this.#anchorOf() ?? this.#entries()[0];
    if (stop) this.#rove(stop);
  }

  /** Makes an entry the one the Tab key stops at. */
  #rove(link: HTMLAnchorElement): void {
    if (this.#stop && this.#stop !== link) this.#stop.tabIndex = -1;
    link.tabIndex = 0;
    this.#stop = link;
  }

  #focus(link: HTMLAnchorElement): void {
    this.#rove(link);
    link.focus({ preventScroll: true });
    this.#scroll().toNearest(itemOf(link), headingOver(link));
  }

  /** Scrolls the list of all the painters to the ones filed under a letter. */
  #jump(letter: string): void {
    const letterSection = this.#sections.get(letter);
    if (!letterSection) return;
    const before = this.#browse.scrollTop;
    this.#browseScroll.toTop(letterSection);
    if (this.#browse.scrollTop !== before) this.#jumpedTo = letter;
    this.#rail.mark(letter);
  }

  /** The letter of the section at the top of the list of all the painters, once past the most famous. */
  #letterInView(): string | undefined {
    let inView: string | undefined;
    for (const [letter, letterSection] of this.#sections) {
      if (this.#browseScroll.topOf(letterSection) > this.#browse.scrollTop + 1) break;
      inView = letter;
    }
    return inView;
  }

  /** A painter's entry: their name, the family name it is filed by in bold, and their years and how many paintings their career has. */
  #entry(painter: Painter): HTMLLIElement {
    const { artist, paintings } = painter;
    const item = document.createElement('li');
    const link = document.createElement('a');
    link.className = 'painter';
    link.href = `./artist.html?id=${artist.id}`;
    link.dataset.id = artist.id;
    link.tabIndex = -1;
    const { before, family, after } = this.#filingOf(painter).parts;
    const name = document.createElement('span');
    name.className = 'painter-name';
    const familyName = document.createElement('b');
    familyName.textContent = family;
    name.append(before, familyName, after);
    const facts = document.createElement('span');
    facts.className = 'painter-facts';
    facts.textContent = `${lifespanOf(artist)} · ${paintingCount(paintings)}`;
    link.append(name, facts);
    item.append(link);
    return item;
  }
}

/** The painters filed under each letter, in order, the letters in the rail's order: A to Z, then the rest. */
function byLetter(painters: readonly Painter[], filingOf: (painter: Painter) => Filing): Map<string, Painter[]> {
  const last = (letter: string): number => (letter === OTHER_LETTER ? 1 : 0);
  const sorted = [...painters].sort((a, b) => {
    const [x, y] = [filingOf(a), filingOf(b)];
    return last(x.letter) - last(y.letter) || compare(x.letter, y.letter) || compare(x.key, y.key);
  });
  const letters = new Map<string, Painter[]>();
  for (const painter of sorted) {
    const { letter } = filingOf(painter);
    const filed = letters.get(letter);
    if (filed) filed.push(painter);
    else letters.set(letter, [painter]);
  }
  return letters;
}

/** A section of the list under a heading, the most famous painters or a letter's, with its estimated height (see ESTIMATED_HEIGHT). */
function section(heading: string, entries: readonly HTMLLIElement[]): HTMLElement {
  const element = document.createElement('section');
  element.className = 'painter-section';
  element.style.containIntrinsicSize = `auto ${ESTIMATED_HEIGHT.heading + entries.length * ESTIMATED_HEIGHT.entry}px`;
  const title = document.createElement('h2');
  title.textContent = heading;
  const list = document.createElement('ul');
  list.append(...entries);
  element.append(title, list);
  return element;
}

/** The item of the list that holds an entry. */
function itemOf(link: HTMLAnchorElement): HTMLElement {
  return link.parentElement ?? link;
}

/** How much of the list's top the heading of an entry's section covers, as its painters pass under it. */
function headingOver(link: HTMLAnchorElement): number {
  return link.closest('section')?.querySelector('h2')?.offsetHeight ?? 0;
}

/** Orders text by its characters' codes: filing keys are folded to plain letters (see fileName). */
function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
