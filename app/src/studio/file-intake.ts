/**
 * Takes the files a user hands the page: dropped anywhere on it, chosen in the file picker, or
 * pasted. While a file is dragged over the page, the root element carries the class
 * "is-dragging", so the page can show where it will land.
 *
 * Observer: each file handed in is reported to the listener, the first image among several.
 */
export class FileIntake {
  readonly #root: HTMLElement;
  readonly #onFile: (file: File) => void;
  readonly #picker = document.createElement('input');
  /** dragenter and dragleave fire for every element the pointer crosses; they balance out once it leaves the page. */
  #dragDepth = 0;

  constructor(root: HTMLElement, onFile: (file: File) => void) {
    this.#root = root;
    this.#onFile = onFile;
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
      if (!carriesFiles(event)) return;
      this.#dragDepth++;
      this.#setDragging(true);
    });
    window.addEventListener('dragleave', (event) => {
      if (!carriesFiles(event)) return;
      this.#dragDepth = Math.max(0, this.#dragDepth - 1);
      if (this.#dragDepth === 0) this.#setDragging(false);
    });
    // Without this, the browser refuses the drop.
    window.addEventListener('dragover', (event) => {
      if (carriesFiles(event)) event.preventDefault();
    });
    window.addEventListener('drop', (event) => {
      if (!carriesFiles(event)) return;
      // Stops the browser from opening the file itself.
      event.preventDefault();
      this.#dragDepth = 0;
      this.#setDragging(false);
      this.#take(event.dataTransfer?.files);
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
    if (file) this.#onFile(file);
  }

  #setDragging(dragging: boolean): void {
    this.#root.classList.toggle('is-dragging', dragging);
  }
}

export function isImage(file: File): boolean {
  return file.type.startsWith('image/');
}

function carriesFiles(event: DragEvent): boolean {
  return event.dataTransfer?.types.includes('Files') ?? false;
}
