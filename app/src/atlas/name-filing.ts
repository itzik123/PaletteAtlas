import { fold } from './text-fold.ts';

/** Where a painter's name is filed in an index of painters. */
export interface Filing {
  /** The letter it is filed under: A to Z, or OTHER_LETTER for a name in another script. */
  readonly letter: string;
  /** What it is ordered by: the family name, then the rest of the name, folded (see fold). */
  readonly key: string;
  /** The name as written, around the words it is filed by. */
  readonly parts: { readonly before: string; readonly family: string; readonly after: string };
}

/** The letter for names that don't start with one of A to Z. */
export const OTHER_LETTER = '#';
/** Capitalized articles that belong to the family name after them: La Tour, Le Brun, De Morgan. */
const CAPITAL_ARTICLES = new Set(['La', 'Le', 'Les', 'De', 'Di', 'Da', 'Del', 'Della', 'Des', 'Du', 'Van', 'Von', 'Ter', 'Ten', 'Den', 'Der']);
/**
 * Italian words that join a given name to a place or a father's name, as in Leonardo da Vinci and
 * Duccio di Buoninsegna, painters filed under their given name.
 */
const ITALIAN_LINKS = new Set(['da', 'di', 'del', 'della', 'dello', 'dei', 'degli', 'dal', 'dalla']);
/** A generation after a name: I to VI, in brackets or not, Jr. and Sr.; and "(Mrs)". */
const GENERATION = /^\(?(?:I{1,3}|IV|VI?|Mrs|Jr\.?|Sr\.?)\)?$/;
/** The first word of the name of a painter known only by a work, filed whole: "Master of the Housebook". */
const MASTER = /^(?:Master|Meister|Anonymous)$/i;
/** The word joining a Spanish double family name: "Pradilla y Ortiz". */
const SPANISH_AND = 'y';
/** An elided article opening a family name in lower case, which filing passes over: "d'Hondecoeter". */
const ELIDED_ARTICLE = /^(?:d|l|dell|dall)['’]/;

/**
 * Where a painter's name is filed, as museums index painters: under the family name, its
 * particles in lower case aside (Vincent van Gogh under G), a capitalized article kept with it
 * (Georges de La Tour under L), and whatever follows it left out: an epithet, a generation or a
 * title (Pieter Brueghel the Elder, Abraham Janssens I, John Frederick Herring, Sr.). A single
 * name, a master known by a work, and an Italian given name joined to a place or a father's name
 * (Leonardo da Vinci) are filed under themselves.
 */
export function fileName(name: string): Filing {
  const comma = name.indexOf(',');
  const head = comma < 0 ? name : name.slice(0, comma);
  const words = Array.from(head.matchAll(/\S+/g), (match) => ({ text: match[0], at: match.index }));
  if (words.length === 0) return { letter: OTHER_LETTER, key: fold(name), parts: { before: name, family: '', after: '' } };
  const [start, end] = familyWords(words.map(({ text }) => text));
  const from = words[start].at;
  const to = words[end - 1].at + words[end - 1].text.length;
  const parts = { before: name.slice(0, from), family: name.slice(from, to), after: name.slice(to) };
  const filedBy = fold(parts.family.replace(ELIDED_ARTICLE, ''));
  const letter = /^[a-z]/.test(filedBy) ? filedBy[0].toUpperCase() : OTHER_LETTER;
  return { letter, key: `${filedBy} ${fold(parts.before + parts.after)}`, parts };
}

/** The words of a name that make its family name, from `start` up to `end` (exclusive). */
function familyWords(words: readonly string[]): [start: number, end: number] {
  if (words.length === 1 || MASTER.test(words[0])) return [0, words.length];
  let end = words.length;
  while (end > 1 && GENERATION.test(words[end - 1])) end--;
  // An epithet: "the Elder", "the Younger", "the Greek".
  if (end > 2 && words[end - 2] === 'the') end -= 2;
  if (end === 1 || ITALIAN_LINKS.has(words[1])) return [0, 1];
  let start = end - 1;
  if (start >= 2 && words[start - 1] === SPANISH_AND) start -= 2;
  // The first word is always a given name, never part of the family name.
  while (start > 1 && CAPITAL_ARTICLES.has(words[start - 1])) start--;
  return [start, end];
}
