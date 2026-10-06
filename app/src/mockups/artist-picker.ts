import type { Artist } from '@palette-atlas/gallery';
import { lifespanOf, nameOf } from '../atlas/painting-text.ts';

/**
 * Artists offered at a click, by Wikidata item: long careers and short, dark palettes and light,
 * landscapes and abstraction. Van Gogh, Monet, Rembrandt, Vermeer, Turner, Friedrich, Mondrian,
 * Kandinsky, Franz Marc and Malevich.
 */
const FEATURED = ['Q5582', 'Q296', 'Q5598', 'Q41264', 'Q159758', 'Q104884', 'Q151803', 'Q61064', 'Q44054', 'Q130777'] as const;
/** The id of the search box's list of artists. */
const LIST_ID = 'mockup-artists';

/** An artist the picker offers, and how many paintings of theirs the gallery has. */
export interface ArtistChoice {
  readonly artist: Artist;
  readonly paintings: number;
}

/**
 * A choice of artist: a chip for each of a few, and a search box for any of the gallery's.
 * Observer: every choice is reported to the listener, by the artist's Wikidata item.
 */
export class ArtistPicker {
  readonly element = document.createElement('div');
  readonly #chips = new Map<string, HTMLButtonElement>();

  /** Offers the artists in the order given. */
  constructor(choices: readonly ArtistChoice[], onPick: (id: string) => void) {
    this.element.className = 'artist-picker';
    const byId = new Map(choices.map((choice) => [choice.artist.id, choice]));
    for (const id of FEATURED) {
      const choice = byId.get(id);
      if (!choice) continue;
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'chip';
      chip.textContent = nameOf(choice.artist);
      chip.addEventListener('click', () => onPick(id));
      this.#chips.set(id, chip);
      this.element.append(chip);
    }

    // Names can repeat, so each is offered with its years.
    const ids = new Map<string, string>();
    const list = document.createElement('datalist');
    list.id = LIST_ID;
    for (const { artist, paintings } of choices) {
      const option = document.createElement('option');
      option.value = `${nameOf(artist)} (${lifespanOf(artist)})`;
      option.label = `${paintings} ${paintings === 1 ? 'painting' : 'paintings'}`;
      ids.set(option.value, artist.id);
      list.append(option);
    }
    const search = document.createElement('input');
    search.type = 'search';
    search.className = 'artist-search';
    search.placeholder = 'Any artist…';
    search.setAttribute('aria-label', 'Any artist');
    search.setAttribute('list', LIST_ID);
    search.addEventListener('input', () => {
      const id = ids.get(search.value);
      if (id === undefined) return;
      search.value = '';
      search.blur();
      onPick(id);
    });
    this.element.append(search, list);
  }

  /** Shows which artist is picked: their chip pressed, if they have one. */
  select(id: string): void {
    for (const [chipId, chip] of this.#chips) chip.setAttribute('aria-pressed', String(chipId === id));
  }
}
