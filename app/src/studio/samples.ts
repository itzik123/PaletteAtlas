import bedroom from './samples/bedroom.webp';
import bedroomThumbnail from './samples/bedroom-thumb.webp';
import grandeJatte from './samples/grande-jatte.webp';
import grandeJatteThumbnail from './samples/grande-jatte-thumb.webp';
import greatWave from './samples/great-wave.webp';
import greatWaveThumbnail from './samples/great-wave-thumb.webp';
import monaLisa from './samples/mona-lisa.webp';
import monaLisaThumbnail from './samples/mona-lisa-thumb.webp';

/**
 * How a painting is framed on the sample wall, after the frame it hangs in at its museum, drawn
 * flat in the site's style.
 */
export type FrameStyle =
  /** The carved and gilded Italian Renaissance frame the Mona Lisa has hung in since 1909. */
  | 'carved-gilt'
  /** The plain white frame Seurat wanted around his painted border of dots. */
  | 'white'
  /** A gilded frame with a beaded inner edge. */
  | 'beaded-gilt'
  /** A Japanese print's frame: thin black lacquer around a wide paper mat. */
  | 'print-mat';

/** A famous public-domain painting to try the Studio with. */
export interface Sample {
  readonly id: string;
  readonly title: string;
  readonly artist: string;
  readonly date: string;
  /** Where the painting is kept. */
  readonly museum: string;
  readonly frame: FrameStyle;
  /** The image the Studio reads: at most 843 px on its longer side, the width the Art Institute of Chicago asks for. */
  readonly image: string;
  /** The image as the wall shows it, 320 px on its shorter side. */
  readonly thumbnail: string;
  /**
   * Where a square crop of the painting centers, as a CSS object-position: on a phone the wall
   * shows every painting square, around its best-known part.
   */
  readonly focus: string;
}

/** The paintings on the sample wall, in order, each after a comment saying where its image came from. */
export const SAMPLES: readonly Sample[] = [
  // https://www.artic.edu/artworks/27992
  {
    id: 'grande-jatte',
    title: 'A Sunday on La Grande Jatte',
    artist: 'Georges Seurat',
    date: '1884–86',
    museum: 'Art Institute of Chicago',
    frame: 'white',
    image: grandeJatte,
    thumbnail: grandeJatteThumbnail,
    // The couple with the monkey, and the woman and child in white.
    focus: '85% 50%',
  },
  // https://commons.wikimedia.org/wiki/File:Mona_Lisa,_by_Leonardo_da_Vinci,_from_C2RMF_retouched.jpg
  {
    id: 'mona-lisa',
    title: 'Mona Lisa',
    artist: 'Leonardo da Vinci',
    date: 'c. 1503–19',
    museum: 'Louvre, Paris',
    frame: 'carved-gilt',
    image: monaLisa,
    thumbnail: monaLisaThumbnail,
    // Her face and folded hands.
    focus: '50% 30%',
  },
  // https://www.artic.edu/artworks/28560
  {
    id: 'bedroom',
    title: 'The Bedroom',
    artist: 'Vincent van Gogh',
    date: '1889',
    museum: 'Art Institute of Chicago',
    frame: 'beaded-gilt',
    image: bedroom,
    thumbnail: bedroomThumbnail,
    focus: '55% 50%',
  },
  // https://www.artic.edu/artworks/24645
  {
    id: 'great-wave',
    title: 'The Great Wave',
    artist: 'Katsushika Hokusai',
    date: '1830–33',
    museum: 'Art Institute of Chicago',
    frame: 'print-mat',
    image: greatWave,
    thumbnail: greatWaveThumbnail,
    // The crest of the wave, with Mount Fuji under it.
    focus: '35% 50%',
  },
];
