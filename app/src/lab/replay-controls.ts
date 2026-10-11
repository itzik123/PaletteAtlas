import { PAUSE_ICON, PLAY_ICON } from '../icons.ts';
import type { ReplayClock } from './replay-clock.ts';

/** Hears what the visitor does with the replay's controls. */
export interface ReplayListener {
  /** Play, or pause. */
  onToggle(): void;
  /** The scrubber was moved to a time, in milliseconds from the replay's start. */
  onSeek(time: number): void;
}

/**
 * Play and pause, and a scrubber along the replay with a notch where each layer's part begins,
 * which tells a screen reader the layer it is at.
 *
 * Observer: reports the visitor's moves to its listener, and shows what it is told.
 */
export class ReplayControls {
  readonly element = document.createElement('div');
  readonly #play = document.createElement('button');
  readonly #scrubber = document.createElement('input');
  readonly #notches = document.createElement('div');
  #clock: ReplayClock | undefined;

  constructor(listener: ReplayListener) {
    this.element.className = 'lab-transport';
    this.#play.className = 'round-button play';
    this.#play.type = 'button';
    this.#play.addEventListener('click', () => listener.onToggle());
    this.#scrubber.className = 'scrubber';
    this.#scrubber.type = 'range';
    this.#scrubber.min = '0';
    this.#scrubber.step = '1';
    this.#scrubber.setAttribute('aria-label', 'Replay');
    this.#scrubber.addEventListener('input', () => listener.onSeek(this.#scrubber.valueAsNumber));
    this.#notches.className = 'notches';
    const scrub = document.createElement('div');
    scrub.className = 'scrub';
    scrub.append(this.#scrubber, this.#notches);
    this.element.append(this.#play, scrub);
    this.showPlaying(false);
  }

  /** Sets the scrubber's length to a replay's, notched where each layer after the first begins. */
  setClock(clock: ReplayClock): void {
    const { duration, segments } = clock;
    this.#clock = clock;
    this.#scrubber.max = String(Math.round(duration));
    this.#notches.replaceChildren(
      ...segments.slice(1).map(({ start }) => {
        const notch = document.createElement('i');
        notch.style.left = `${(100 * start) / duration}%`;
        return notch;
      }),
    );
  }

  showTime(time: number): void {
    this.#scrubber.value = String(Math.round(time));
    const duration = Number(this.#scrubber.max) || 1;
    this.#scrubber.style.setProperty('--done', `${(100 * time) / duration}%`);
    const level = this.#clock?.levelAt(time);
    if (level === undefined) this.#scrubber.removeAttribute('aria-valuetext');
    else this.#scrubber.setAttribute('aria-valuetext', `Layer ${level}`);
  }

  showPlaying(playing: boolean): void {
    this.#play.innerHTML = playing ? PAUSE_ICON : PLAY_ICON;
    this.#play.setAttribute('aria-label', playing ? 'Pause' : 'Play');
  }
}
