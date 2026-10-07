import { fold } from './text-fold.ts';

/** How well a word of a name matches a word searched for. */
const MATCH = {
  /** The very word. */
  exact: 1,
  /** Its start: a word still being typed. */
  start: 0.9,
  /** The word or its start within a slip in spelling, and less for every slip more. */
  slip: 0.8,
  perSlip: 0.1,
} as const;
/**
 * What a slip counts for, as a share, from a searched word that some name has just as it is: the word
 * was likely meant as typed, and a name only a slip from it ("Gotha" for "gogh") is likely another.
 */
const SLIP_FROM_A_NAME = 0.5;
/** Searched words at least this long forgive one slip in spelling, and at least this long, two. */
const ONE_SLIP = 4;
const TWO_SLIPS = 7;
/** The least a searched word weighs, however many names it matches: "de" and "van" match hundreds. */
const MIN_WEIGHT = 0.3;
/** The names found: those matching at least this share as well as the best match. */
const KEEP_SHARE = 0.35;

/** A word of the names, or a run of the words of a name written together ("davinci"). */
interface Word {
  readonly text: string;
  /** Whether it is a run of words, which matches only whole, never as a start. */
  readonly joined: boolean;
  /** The items whose names have it. */
  readonly items: readonly number[];
}

/**
 * A search of names that forgives: words in any order, without accents or capitals, partly typed,
 * with a slip or two in spelling, or run together ("davinci"), and words the names don't have, such
 * as a middle name the gallery leaves out: a name matching some of the words is still found. The
 * best matches come first, a searched word matching few names counting for more than one matching
 * many ("gogh" for more than "van"), a slip counting for less from a word some name has as typed,
 * and among equal matches the earlier item, as given (the more famous painter).
 */
export class NameSearch<T> {
  readonly #items: readonly T[];
  /** The words of the names, by their first letter. */
  readonly #words = new Map<string, Word[]>();

  /** Searches the names of items given in order of fame, the most famous first. */
  constructor(items: readonly T[], nameOf: (item: T) => string) {
    this.#items = items;
    const found = new Map<string, { joined: boolean; items: number[] }>();
    items.forEach((item, index) => {
      const words = fold(nameOf(item)).split(' ').filter(Boolean);
      for (const [text, joined] of wordsAndRuns(words)) {
        const word = found.get(text);
        if (word) {
          word.items.push(index);
          word.joined &&= joined;
        } else {
          found.set(text, { joined, items: [index] });
        }
      }
    });
    for (const [text, { joined, items: having }] of found) {
      const word: Word = { text, joined, items: having };
      const initial = this.#words.get(text[0]);
      if (initial) initial.push(word);
      else this.#words.set(text[0], [word]);
    }
  }

  /** The items whose names match a search, the best match first; none for a search with no words. */
  find(search: string): T[] {
    const terms = fold(search).split(' ').filter(Boolean);
    const scores = new Float64Array(this.#items.length);
    const best = new Float64Array(this.#items.length);
    for (const term of terms) {
      best.fill(0);
      const words = this.#words.get(term[0]) ?? [];
      const slipShare = words.some(({ text }) => text === term) ? SLIP_FROM_A_NAME : 1;
      for (const word of words) {
        const match = matchOf(term, word, slipShare);
        if (match > 0) for (const item of word.items) best[item] = Math.max(best[item], match);
      }
      const matched = best.reduce((count, match) => count + (match > 0 ? 1 : 0), 0);
      const termWeight = weight(matched, this.#items.length);
      for (let item = 0; item < scores.length; item++) scores[item] += best[item] * termWeight;
    }
    const top = scores.reduce((most, score) => Math.max(most, score), 0);
    if (top === 0) return [];
    const kept = [...scores.keys()].filter((item) => scores[item] >= KEEP_SHARE * top);
    return kept.sort((a, b) => scores[b] - scores[a] || a - b).map((item) => this.#items[item]);
  }
}

/** A name's words, each once, and every run of two or more of them written together. */
function wordsAndRuns(words: readonly string[]): Map<string, boolean> {
  const all = new Map<string, boolean>(words.map((word) => [word, false]));
  for (let start = 0; start < words.length; start++) {
    for (let end = start + 2; end <= words.length; end++) {
      const run = words.slice(start, end).join('');
      if (!all.has(run)) all.set(run, true);
    }
  }
  return all;
}

/** How much a searched word matching `matched` of `count` names weighs: 1 for a word matching one name, less the more it matches. */
function weight(matched: number, count: number): number {
  if (count <= 1 || matched === 0) return 1;
  return Math.max(MIN_WEIGHT, Math.log(count / matched) / Math.log(count));
}

/** How well a word of a name matches a searched word (see MATCH), a slip counting for `slipShare` of its worth; or 0 if it doesn't. */
function matchOf(term: string, { text, joined }: Word, slipShare: number): number {
  if (text === term) return MATCH.exact;
  if (!joined && text.startsWith(term)) return MATCH.start;
  const allowed = term.length >= TWO_SLIPS ? 2 : term.length >= ONE_SLIP ? 1 : 0;
  if (allowed === 0) return 0;
  let fewest = slipsBetween(term, text, allowed);
  // The start of a word still being typed, with a slip in it.
  for (let length = term.length - 1; !joined && length <= term.length + 1 && length < text.length; length++) {
    fewest = Math.min(fewest, slipsBetween(term, text.slice(0, length), allowed));
  }
  return fewest <= allowed ? (MATCH.slip - MATCH.perSlip * (fewest - 1)) * slipShare : 0;
}

/**
 * The fewest slips that turn one word into the other, a slip being a letter left out, added,
 * changed, or swapped with the next (the optimal string alignment distance); or `most` + 1 as soon
 * as it is clear there are more than `most`.
 */
function slipsBetween(a: string, b: string, most: number): number {
  if (Math.abs(a.length - b.length) > most) return most + 1;
  let twoBack = new Array<number>(b.length + 1).fill(0);
  let back = Array.from({ length: b.length + 1 }, (_, j) => j);
  let row = new Array<number>(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    row[0] = i;
    let rowLeast = i;
    for (let j = 1; j <= b.length; j++) {
      let slips = Math.min(back[j] + 1, row[j - 1] + 1, back[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) slips = Math.min(slips, twoBack[j - 2] + 1);
      row[j] = slips;
      rowLeast = Math.min(rowLeast, slips);
    }
    if (rowLeast > most) return most + 1;
    [twoBack, back, row] = [back, row, twoBack];
  }
  return back[b.length];
}
