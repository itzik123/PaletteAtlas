import type { SearchStep } from '@palette-atlas/hnsw';
import type { LabData } from './lab-data.ts';
import { LabPanel, NEAREST_COUNT } from './lab-panel.ts';
import type { LabQuery } from './lab-query.ts';
import { LabStage } from './lab-stage.ts';
import { ReplayClock } from './replay-clock.ts';
import { ReplayControls } from './replay-controls.ts';
import { SearchReplay } from './search-replay.ts';
import { StackView } from './stack-view.ts';

/** As many as the Atlas's search asks for: its 600 matches, and one more for a painting searched by its own colors. */
const SEARCHED = 601;
/** The media query by which a visitor's system asks for less motion. */
const LESS_MOTION = '(prefers-reduced-motion: reduce)';

/**
 * The Lab: the very search that hangs a query's matches on the Atlas, replayed over the index's
 * layers (LabStage) beside what it found and measured (LabPanel), played as it opens (or shown
 * at its end, for less motion), and paused or moved along by its controls.
 *
 * Mediator: the stage, the panel and the controls know nothing of one another; the Lab tells each
 * what the replay shows at every frame.
 */
export class Lab {
  readonly element = document.createElement('main');
  readonly #data: LabData;
  readonly #stage: LabStage;
  readonly #view: StackView;
  readonly #panel: LabPanel;
  readonly #controls: ReplayControls;
  #query: LabQuery | undefined;
  #steps: readonly SearchStep[] = [];
  #clock = new ReplayClock([]);
  #replay = SearchReplay.of([], 0);
  /** How many steps the replay shows. */
  #shownSteps = 0;
  #time = 0;
  /** The next frame asked for, while playing. */
  #frameRequest: number | undefined;
  /** When the last frame was drawn, while playing. */
  #lastFrame = 0;

  constructor(data: LabData, onNewImage: () => void) {
    this.#data = data;
    const entry = (position: number) => data.gallery.entry(position);
    this.#view = new StackView(data.map, data.layers);
    this.#stage = new LabStage(this.#view, data.layers, entry);
    this.#controls = new ReplayControls({
      onToggle: () => this.#toggle(),
      onSeek: (time) => {
        this.#setPlaying(false);
        this.#show(time);
      },
    });
    this.#panel = new LabPanel({ layers: data.layers.topLevel + 1, paintings: data.gallery.count, entry, onNewImage }, this.#controls);
    this.element.className = 'lab';
    this.element.append(this.#stage.element, this.#panel.element);
    new ResizeObserver(() => {
      if (!this.#query) return;
      this.#stage.layout();
      this.#show(this.#time);
    }).observe(this.#stage.element);
  }

  /** Replays the search for a query from its start: the search worker runs it, recording its steps, beside the exact answer. */
  async search(query: LabQuery): Promise<void> {
    const traced = await this.#data.search.traced(query.colors, SEARCHED);
    const firstOf = (found: readonly { id: number }[]): number[] =>
      found
        .map(({ id }) => id)
        .filter((id) => id !== query.leaveOut)
        .slice(0, NEAREST_COUNT);
    const nearest = firstOf(traced.found);
    const exact = firstOf(traced.exact);
    this.#query = query;
    this.#steps = traced.steps;
    this.#clock = new ReplayClock(traced.steps);
    this.#view.aim(this.#data.map.place(traced.vector), nearest);
    this.#panel.showQuery(query, nearest.filter((id) => exact.includes(id)).length, exact.length);
    this.#stage.showQuery(query);
    this.#controls.setClock(this.#clock);
    this.#stage.layout();
    this.#replay = SearchReplay.of([], 0);
    this.#shownSteps = 0;
    // Played as it opens, unless the visitor's system asks for less motion: then it opens on its end.
    if (matchMedia(LESS_MOTION).matches) {
      this.#show(this.#clock.duration);
    } else {
      this.#show(0);
      this.#setPlaying(true);
    }
  }

  /** Shows the replay at a time, in milliseconds from its start. */
  #show(time: number): void {
    this.#time = Math.min(Math.max(0, time), this.#clock.duration);
    const steps = this.#clock.stepAt(this.#time);
    if (steps !== this.#shownSteps) {
      this.#shownSteps = steps;
      this.#replay = SearchReplay.of(this.#steps, steps);
    }
    const nearest = this.#replay.nearest(NEAREST_COUNT, this.#query?.leaveOut);
    this.#stage.show(this.#replay, nearest);
    this.#panel.showProgress(this.#replay, nearest);
    this.#controls.showTime(this.#time);
  }

  get #playing(): boolean {
    return this.#frameRequest !== undefined;
  }

  #toggle(): void {
    if (!this.#playing && this.#time >= this.#clock.duration) this.#show(0);
    this.#setPlaying(!this.#playing);
  }

  #setPlaying(playing: boolean): void {
    if (playing === this.#playing) return;
    if (playing) {
      this.#lastFrame = performance.now();
      this.#frameRequest = requestAnimationFrame((now) => this.#frame(now));
    } else {
      cancelAnimationFrame(this.#frameRequest ?? 0);
      this.#frameRequest = undefined;
    }
    this.#controls.showPlaying(playing);
  }

  /** Moves the replay on by the time since the last frame, and stops at its end. */
  #frame(now: number): void {
    this.#show(this.#time + (now - this.#lastFrame));
    this.#lastFrame = now;
    if (this.#time < this.#clock.duration) this.#frameRequest = requestAnimationFrame((later) => this.#frame(later));
    else this.#setPlaying(false);
  }
}
