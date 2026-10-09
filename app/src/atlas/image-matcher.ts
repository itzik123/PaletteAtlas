import { dropOverlay, FileIntake, isImage } from '../studio/file-intake.ts';
import { StripReader } from '../studio/strip-reader.ts';
import { Toast } from '../studio/toast.ts';
import { ImageQueries, imageQuery, MATCHES_PAGE } from './image-query.ts';

/** The strip an image is matched by: its colors. */
const MATCHED_AXIS = 'color';

/**
 * Takes the images handed to a page, dropped anywhere on it, pasted, or chosen in the file
 * picker, reads each one's colors in a worker as the Studio does, and opens the page that shows
 * its matches: the Atlas's wall of them, or the Lab's replay of the search for them. While it
 * reads, the page is marked "is-matching"; an image it can't read is turned away with a word why.
 */
export class ImageMatcher {
  readonly #root: HTMLElement;
  readonly #opens: string;
  readonly #reader: StripReader;
  readonly #intake: FileIntake;
  readonly #toast = new Toast();

  /** Takes the images handed to `root`, opening `opens` for each, a page that takes it from ImageQueries. */
  constructor(root: HTMLElement, opens = MATCHES_PAGE, reader = new StripReader()) {
    this.#root = root;
    this.#opens = opens;
    this.#reader = reader;
    this.#intake = new FileIntake(root, { onFile: (file) => void this.#match(file) });
    root.append(dropOverlay(), this.#toast.element);
  }

  /** Opens the file picker. */
  choose(): void {
    this.#intake.choose();
  }

  async #match(file: File): Promise<void> {
    if (!isImage(file)) {
      this.#toast.show(`“${file.name}” is not an image.`);
      return;
    }
    this.#toast.hide();
    this.#root.classList.add('is-matching');
    const read = await this.#reader.read(file, [MATCHED_AXIS]);
    this.#root.classList.remove('is-matching');
    const colors = read?.strips.find(({ axis }) => axis === MATCHED_AXIS)?.strip;
    if (!read || !colors) {
      this.#toast.show(`Couldn’t open “${file.name}”.`);
    } else if (colors.segmentCount === 0) {
      this.#toast.show(`“${file.name}” has nothing visible to read.`);
    } else {
      const { picture } = read;
      ImageQueries.hand(imageQuery({ source: picture, width: picture.width, height: picture.height }, colors.toImage()));
      location.assign(this.#opens);
    }
    read?.picture.close();
  }
}
