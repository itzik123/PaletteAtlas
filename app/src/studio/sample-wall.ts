import type { Sample } from './samples.ts';

/** The drag data type under which a painting dragged from the wall carries its id. */
export const SAMPLE_DRAG_TYPE = 'application/x-palette-atlas-sample';

/**
 * Famous paintings hung in frames after their museums' own, to try the Studio without an image
 * at hand: click one, or drag it onto the drop zone (FileIntake takes the drop). Each shows its
 * museum label while pointed at.
 * Observer: picking a painting by click or keyboard reports it to the listener.
 */
export class SampleWall {
  readonly element = document.createElement('div');

  constructor(samples: readonly Sample[], onPick: (sample: Sample) => void) {
    this.element.className = 'sample-wall';
    this.element.append(...samples.map((sample) => frame(sample, onPick)));
  }
}

/**
 * One framed painting. It is a div acting as a button rather than a <button>, which Firefox
 * won't let the user drag.
 */
function frame(sample: Sample, onPick: (sample: Sample) => void): HTMLElement {
  const element = document.createElement('div');
  element.className = `sample frame-${sample.frame}`;
  element.setAttribute('role', 'button');
  element.tabIndex = 0;
  element.draggable = true;
  element.setAttribute('aria-label', `${sample.title}, ${sample.artist}`);
  const picture = document.createElement('img');
  picture.src = sample.thumbnail;
  picture.alt = '';
  picture.draggable = false;
  picture.style.objectPosition = sample.focus;
  const label = document.createElement('span');
  label.className = 'sample-label';
  label.setAttribute('aria-hidden', 'true');
  const title = document.createElement('b');
  title.textContent = sample.title;
  label.append(title, `${sample.artist}, ${sample.date} · ${sample.museum}`);
  element.append(picture, label);

  element.addEventListener('click', () => onPick(sample));
  element.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    onPick(sample);
  });
  element.addEventListener('dragstart', (event) => {
    event.dataTransfer?.setData(SAMPLE_DRAG_TYPE, sample.id);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'copy';
  });
  return element;
}
