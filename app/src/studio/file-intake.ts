import { SAMPLE_DRAG_TYPE } from './sample-wall.ts';

/** Reports what the user hands the page. */
export interface IntakeListener {
  /** A file, the first image among several. */
  onFile(file: File): void;
  /** A painting dragged from the sample wall, by its id. */
  onSample(id: string): void;
}

/** What a drag may carry for the page to take. */
const TAKEN_DRAG_TYPES = ['Files', SAMPLE_DRAG_TYPE];

/**
 * Takes what a user hands the page: files dropped anywhere on it, chosen in the file picker, or
 * pasted, and paintings dragged from the sample wall. While either is dragged over the page, the
 * root element carries the class "is-dragging", so the page can show where it will land.
 *
 * Observer: everything handed in is reported to the listener.
 */
export class FileIntake {
  readonly #root: HTMLElement;
  readonly #listener: IntakeListener;
  readonly #picker = document.createElement('input');
  /** dragenter and dragleave fire for every element the pointer crosses; they balance out once it leaves the page. */
  #dragDepth = 0;

  constructor(root: HTMLElement, listener: IntakeListener) {
    this.#root = root;
    this.#listener = listener;
    this.#picker.type = 'file';
    this.#picker.accept = 'image/*';
    this.#picker.hidden = true;
    this.#picker.addEventListener('change', () => {
      this.#take(this.#picker.files);
      // Choosing the same file again should open it again.
      this.#picker.value = '';
    });
    root.append(this.#picker);

    window.addEventListener('dragenter', (event) => {
      if (!carriesImage(event)) return;
      this.#dragDepth++;
      this.#setDragging(true);
    });
    window.addEventListener('dragleave', (event) => {
      if (!carriesImage(event)) return;
      this.#dragDepth = Math.max(0, this.#dragDepth - 1);
      if (this.#dragDepth === 0) this.#setDragging(false);
    });
    // Without this, the browser refuses the drop.
    window.addEventListener('dragover', (event) => {
      if (carriesImage(event)) event.preventDefault();
    });
    window.addEventListener('drop', (event) => {
      if (!carriesImage(event)) return;
      // Stops the browser from opening the file itself.
      event.preventDefault();
      this.#dragDepth = 0;
      this.#setDragging(false);
      const sample = event.dataTransfer?.getData(SAMPLE_DRAG_TYPE);
      if (sample) this.#listener.onSample(sample);
      else this.#take(event.dataTransfer?.files);
    });
    // A drag from the page itself (a painting from the wall) always ends here, even when cancelled.
    window.addEventListener('dragend', () => {
      this.#dragDepth = 0;
      this.#setDragging(false);
    });
    window.addEventListener('paste', (event) => this.#take(event.clipboardData?.files));
  }

  /** Opens the file picker. */
  choose(): void {
    this.#picker.click();
  }

  #take(files: FileList | null | undefined): void {
    const all = [...(files ?? [])];
    const file = all.find(isImage) ?? all[0];
    if (file) this.#listener.onFile(file);
  }

  #setDragging(dragging: boolean): void {
    this.#root.classList.toggle('is-dragging', dragging);
  }
}

export function isImage(file: File): boolean {
  return file.type.startsWith('image/');
}

function carriesImage(event: DragEvent): boolean {
  return event.dataTransfer?.types.some((type) => TAKEN_DRAG_TYPES.includes(type)) ?? false;
}
