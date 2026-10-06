import { CLOSE_ICON, SEARCH_ICON } from '../icons.ts';

/** What a search field reports: its text as it changes, and the keys that lead out of it into what it found. */
export interface SearchListener {
  change(search: string): void;
  /** ↓: into the results. */
  down(): void;
  /** Enter: to the best result. */
  enter(): void;
}

/**
 * A search field: a magnifying glass, the field, and a button to clear it while it has text. Escape
 * clears it too, and only once it is clear goes on to whatever else it does (closing the list over
 * a phone's page). The whole box takes a click into the field, its icon included.
 * Observer: the search's changes and the keys out of it are reported to the listener.
 */
export class SearchField {
  readonly element = document.createElement('search');
  readonly #input = document.createElement('input');
  readonly #clear = document.createElement('button');
  readonly #listener: SearchListener;

  constructor(label: string, listener: SearchListener) {
    this.#listener = listener;
    this.element.className = 'search-field';
    this.element.innerHTML = SEARCH_ICON;
    this.#input.type = 'search';
    this.#input.placeholder = label;
    this.#input.setAttribute('aria-label', label);
    this.#input.spellcheck = false;
    this.#input.autocomplete = 'off';
    this.#input.enterKeyHint = 'go';
    this.#clear.type = 'button';
    this.#clear.className = 'search-clear';
    this.#clear.setAttribute('aria-label', 'Clear the search');
    this.#clear.innerHTML = CLOSE_ICON;
    this.#clear.hidden = true;
    this.element.append(this.#input, this.#clear);

    this.#input.addEventListener('input', () => this.#changed());
    this.#input.addEventListener('keydown', (event) => this.#key(event));
    this.#clear.addEventListener('click', () => {
      this.#empty();
      this.focus();
    });
    this.element.addEventListener('click', (event) => {
      if (!this.#clear.contains(event.target as Node)) this.focus();
    });
  }

  focus(): void {
    this.#input.focus();
  }

  #key(event: KeyboardEvent): void {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.#listener.down();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      this.#listener.enter();
    } else if (event.key === 'Escape' && this.#input.value) {
      event.preventDefault();
      event.stopPropagation();
      this.#empty();
    }
  }

  #empty(): void {
    this.#input.value = '';
    this.#changed();
  }

  #changed(): void {
    this.#clear.hidden = this.#input.value === '';
    this.#listener.change(this.#input.value);
  }
}
