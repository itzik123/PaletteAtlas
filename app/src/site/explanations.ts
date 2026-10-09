import { AXIS_ICONS, BARCODE_ICON, LAB_ICON, LIST_ICON, SEARCH_ICON, STRIP_FILL_ICON, STUDIO_ICON, UPLOAD_ICON } from '../icons.ts';

/** A small strip of the site's colors, as an icon. */
const MINI_STRIP = '<span class="mini-strip"></span>';

/** One step of an explanation: an icon on a colored disc, its first words in bold, and the rest. */
export interface ExplainStep {
  /** The icon, as markup. */
  readonly icon: string;
  readonly disc: 'red' | 'blue' | 'yellow';
  readonly lead: string;
  readonly rest: string;
}

/** What "How it works" says on a kind of page: a title, a few steps, and whose work the page shows. */
export interface Explanation {
  readonly title: string;
  readonly steps: readonly ExplainStep[];
  readonly credits: string;
}

/** Where the Atlas's paintings come from, said on each of its pages. */
const ATLAS_CREDITS = 'The paintings and their details come from Wikidata and Wikimedia Commons, and are all in the public domain.';

export const STUDIO_EXPLANATION: Explanation = {
  title: 'How the Studio works',
  steps: [
    { icon: UPLOAD_ICON, disc: 'red', lead: 'Drop in any image.', rest: 'It never leaves your computer.' },
    {
      icon: AXIS_ICONS.hilbert,
      disc: 'blue',
      lead: 'Pick a path through it:',
      rest: 'by color, along a Hilbert curve, in columns, or out from the center.',
    },
    { icon: MINI_STRIP, disc: 'yellow', lead: 'The path becomes 128 stripes,', rest: 'each the true average light of the pixels it passes.' },
  ],
  credits:
    'The samples are all in the public domain: the Mona Lisa (Louvre) by way of Wikimedia Commons, and the others courtesy of the Art Institute of Chicago.',
};

export const ATLAS_EXPLANATION: Explanation = {
  title: 'How the Atlas works',
  steps: [
    {
      icon: MINI_STRIP,
      disc: 'red',
      lead: 'The most famous hang first,',
      rest: 'each over its color strip: its colors side by side, each as wide as its share of the picture.',
    },
    { icon: UPLOAD_ICON, disc: 'blue', lead: 'Match an image', rest: 'to hang the paintings nearest its colors first. It never leaves your computer.' },
    { icon: BARCODE_ICON, disc: 'yellow', lead: 'Career Barcodes', rest: 'line up each painter’s work, oldest first, a bar for every painting.' },
  ],
  credits: ATLAS_CREDITS,
};

export const PAINTING_EXPLANATION: Explanation = {
  title: 'How the strips work',
  steps: [
    {
      icon: AXIS_ICONS.hilbert,
      disc: 'red',
      lead: 'Four paths through the picture,',
      rest: 'a strip for each: by color, along a Hilbert curve, in columns, and out from the center.',
    },
    { icon: MINI_STRIP, disc: 'blue', lead: 'Every stripe is the true average light', rest: 'of the pixels its path passes.' },
    { icon: STUDIO_ICON, disc: 'yellow', lead: 'Open it in the Studio', rest: 'to see where each stripe comes from, or to save a strip as a poster.' },
  ],
  credits: ATLAS_CREDITS,
};

export const CAREERS_EXPLANATION: Explanation = {
  title: 'How Career Barcodes work',
  steps: [
    { icon: BARCODE_ICON, disc: 'red', lead: 'A bar for every painting,', rest: 'oldest first, with the years beneath. Point at a bar to see its painting.' },
    {
      icon: STRIP_FILL_ICON,
      disc: 'blue',
      lead: 'Strip or Average:',
      rest: 'a bar shows its painting’s colors stacked, the darker below, or all of them averaged into one.',
    },
    { icon: LIST_ICON, disc: 'yellow', lead: 'Pick a painter', rest: 'from the list, by letter or by name, then step on to the next with the arrows.' },
  ],
  credits: ATLAS_CREDITS,
};

export const LAB_EXPLANATION: Explanation = {
  title: 'How the Lab works',
  steps: [
    {
      icon: LAB_ICON,
      disc: 'red',
      lead: 'Every painting is a dot',
      rest: 'of its average color, on a map of their colors: the lighter to the right, the warmer to the front.',
    },
    {
      icon: SEARCH_ICON,
      disc: 'blue',
      lead: 'The search starts at the top,',
      rest: 'among a few paintings far apart, and steps down a layer once it is as close as that layer takes it.',
    },
    {
      icon: UPLOAD_ICON,
      disc: 'yellow',
      lead: 'Drop in any image',
      rest: 'to watch the search find its paintings, measuring only a few thousand of them. It never leaves your computer.',
    },
  ],
  credits: ATLAS_CREDITS,
};
