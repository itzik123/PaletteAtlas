import { dropOverlay, FileIntake, isImage } from '../studio/file-intake.ts';
import { StripReader } from '../studio/strip-reader.ts';
import { Toast } from '../studio/toast.ts';
import { ImageQueries, imageQuery, MATCHES_PAGE } from './image-query.ts';

/**
 * Takes the images handed to the Atlas, dropped anywhere on it, pasted, or chosen in the file
 * picker, reads each one's colors in a worker as the Studio does, and opens the page of its
 * matches. While it reads, the page is marked "is-matching"; an image it can't read is turned away
 * with a word why.
 */
export class ImageMatcher {
  readonly #root: HTMLElement;
  readonly #reader: StripReader;
  readonly #intake: FileIntake;
  readonly #toast = new Toast();

  constructor(root: HTMLElement, reader = new StripReader()) {
    this.#root = root;
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
    const read = await this.#reader.read(file);
    this.#root.classList.remove('is-matching');
    const colors = read?.strips.find(({ axis }) => axis === 'color')?.strip;
    if (!read || !colors) {
      this.#toast.show(`Couldn’t open “${file.name}”.`);
    } else if (colors.segmentCount === 0) {
      this.#toast.show(`“${file.name}” has nothing visible to read.`);
    } else {
      const { picture } = read;
      ImageQueries.hand(imageQuery({ source: picture, width: picture.width, height: picture.height }, colors.toImage()));
      location.assign(MATCHES_PAGE);
    }
    read?.picture.close();
  }
}
