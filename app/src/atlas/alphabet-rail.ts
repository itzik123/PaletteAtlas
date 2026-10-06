import { OTHER_LETTER } from './name-filing.ts';

/** The rail's letters in order: A to Z, then the one for names in other scripts. */
const LETTERS = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ', OTHER_LETTER];

/**
 * The letters of the alphabet down the side of a list, each jumping to the names filed under it,
 * a letter without any dimmed. Slid along with a finger or the mouse, as a phone's contacts are,
 * it jumps to each letter it passes, however far the pointer strays to the side.
 * Observer: every letter jumped to is reported to the listener.
 */
export class AlphabetRail {
  readonly element = document.createElement('nav');
  readonly #buttons = new Map<string, HTMLButtonElement>();

  constructor(present: ReadonlySet<string>, onLetter: (letter: string) => void) {
    this.element.className = 'alphabet-rail';
    this.element.setAttribute('aria-label', 'Painters by letter');
    for (const letter of LETTERS) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = letter;
      button.disabled = !present.has(letter);
      // Out of the Tab key's way: the search reaches any painter sooner.
      button.tabIndex = -1;
      this.#buttons.set(letter, button);
      this.element.append(button);
    }

    let reached: string | undefined;
    const reach = ({ clientY }: PointerEvent): void => {
      const letter = this.#letterAt(clientY);
      if (letter && letter !== reached) {
        reached = letter;
        onLetter(letter);
      }
    };
    this.element.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) return;
      event.preventDefault();
      reached = undefined;
      this.element.setPointerCapture(event.pointerId);
      reach(event);
    });
    this.element.addEventListener('pointermove', (event) => {
      if (this.element.hasPointerCapture(event.pointerId)) reach(event);
    });
    // A press that comes with no pointer: a screen reader's, say.
    this.element.addEventListener('click', (event) => {
      const button = (event.target as Element).closest('button');
      if (event.detail === 0 && button?.textContent) onLetter(button.textContent);
    });
  }

  /** Marks the letter whose names are in view, or none. */
  mark(letter: string | undefined): void {
    for (const [each, button] of this.#buttons) button.toggleAttribute('data-current', each === letter);
  }

  /** The letter at a height on the screen, the first or the last beyond the rail's ends; none if it has no names. */
  #letterAt(y: number): string | undefined {
    const buttons = [...this.#buttons.values()];
    const button = buttons.find((each) => y < each.getBoundingClientRect().bottom) ?? buttons.at(-1);
    return button && !button.disabled ? (button.textContent ?? undefined) : undefined;
  }
}
