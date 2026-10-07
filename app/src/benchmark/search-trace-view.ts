import { type Random, SeededRandom } from '@palette-atlas/color';
import { BruteForceIndex, HnswIndex, type SearchStep, SearchRecorder, Vectors } from '@palette-atlas/hnsw';

/** Points on the plane, gathered in clusters, as the Lab's plane mode will have them. */
const POINTS = 1500;
const CLUSTERS = 12;
const CLUSTER_SPREAD = 0.06;
/** A small M, which the paper finds suits low-dimensional data, keeps the drawing readable. */
const M = 6;
const K = 10;
const SEED = 4;
/** Each upper layer's square, in CSS pixels; the bottom layer's, where the search ends, is twice as large. */
const PANEL_SIZE = 240;
/** The room left around the points within a panel, in CSS pixels. */
const PANEL_MARGIN = 8;
const PLAY_STEP_MS = 30;
/** Where the first query sits, between clusters. */
const FIRST_QUERY = [0.5, 0.5] as const;

const COLORS = {
  paper: '#f7f4ec',
  link: 'rgb(0 0 0 / 0.08)',
  node: 'rgb(0 0 0 / 0.35)',
  measured: '#e8590c',
  followed: '#1c4fd8',
  kept: '#2b9348',
  truth: '#111',
  current: '#111',
} as const;

/** What a search had done on one layer by some step of its record. */
interface LayerState {
  readonly measured: Set<number>;
  /** Each link followed: from the node expanded to a node it led to. */
  readonly followed: [from: number, to: number][];
  readonly expanded: Set<number>;
  /** The nearest found so far on the layer, the paper's W. */
  readonly kept: Set<number>;
}

/** The first `count` steps of a record, replayed: what happened on each layer, and the layer the search is on. */
function replay(steps: readonly SearchStep[], count: number): { layers: Map<number, LayerState>; level: number } {
  const layers = new Map<number, LayerState>();
  let layer: LayerState | undefined;
  let level = -1;
  let expanding = -1;
  for (const step of steps.slice(0, count)) {
    if (step.kind === 'layer') {
      level = step.level;
      layer = { measured: new Set(), followed: [], expanded: new Set(), kept: new Set() };
      layers.set(level, layer);
      expanding = -1;
    } else if (!layer) {
      throw new Error('A search step came before its layer');
    } else if (step.kind === 'measure') {
      layer.measured.add(step.node);
      if (expanding >= 0) layer.followed.push([expanding, step.node]);
    } else if (step.kind === 'expand') {
      expanding = step.node;
      layer.expanded.add(step.node);
    } else if (step.kind === 'keep') {
      layer.kept.add(step.node);
    } else {
      layer.kept.delete(step.node);
    }
  }
  return { layers, level };
}

function panelSize(level: number): number {
  return level === 0 ? 2 * PANEL_SIZE : PANEL_SIZE;
}

/** A standard normal sample (Box-Muller). */
function gaussian(random: Random): number {
  return Math.sqrt(-2 * Math.log(1 - random.next())) * Math.cos(2 * Math.PI * random.next());
}

/** POINTS points in the unit square, around CLUSTERS random centers. */
function clusteredPoints(random: Random): Vectors {
  const centers = Array.from({ length: CLUSTERS }, () => [random.next(), random.next()]);
  const data = new Float32Array(POINTS * 2);
  for (let point = 0; point < POINTS; point++) {
    const center = centers[Math.floor(random.next() * CLUSTERS)];
    for (let axis = 0; axis < 2; axis++) {
      data[point * 2 + axis] = Math.min(1, Math.max(0, center[axis] + gaussian(random) * CLUSTER_SPREAD));
    }
  }
  return new Vectors(2, data);
}

/**
 * The benchmark page's check of the search trace: an HNSW index of points on a plane, one square
 * per layer, top layer first. Clicking a square searches from that point; the slider replays the
 * search's record step by step, as the Lab will, and the bottom layer rings the true nearest.
 */
export class SearchTraceView {
  readonly element = document.createElement('section');
  readonly #points = clusteredPoints(new SeededRandom(SEED));
  readonly #index = HnswIndex.build(this.#points, { random: new SeededRandom(SEED), M });
  readonly #exact = new BruteForceIndex(this.#points);
  readonly #canvases: HTMLCanvasElement[] = [];
  readonly #slider = document.createElement('input');
  readonly #status = document.createElement('p');
  #query = Float32Array.from(FIRST_QUERY);
  #steps: readonly SearchStep[] = [];
  #truth = new Set<number>();
  #found = new Set<number>();
  #playing: number | undefined;

  constructor() {
    this.element.className = 'search-trace';
    const { graph } = this.#index;
    this.element.innerHTML = `
      <h2>HNSW: one search, step by step</h2>
      <p>${POINTS.toLocaleString('en')} points in clusters, indexed with M = ${M}: one square per layer, the top layer
        first. Click a square to search from that point; drag the slider to replay the search's record.
        <span style="color:${COLORS.measured}">●</span> measured,
        <span style="color:${COLORS.followed}">●</span> links followed,
        <span style="color:${COLORS.kept}">●</span> nearest found so far (large: the ${K} it answers with),
        ◯ the true ${K} nearest.</p>
    `;
    const layers = document.createElement('div');
    layers.className = 'layers';
    for (let level = graph.topLevel; level >= 0; level--) {
      const figure = document.createElement('figure');
      const canvas = document.createElement('canvas');
      const size = panelSize(level);
      canvas.style.width = canvas.style.height = `${size}px`;
      canvas.width = canvas.height = size * devicePixelRatio;
      canvas.addEventListener('click', (event) => this.#searchFrom(canvas, event));
      const caption = document.createElement('figcaption');
      const count = Array.from({ length: graph.count }, (_, node) => node).filter((node) => graph.levelOf(node) >= level).length;
      caption.textContent = `Layer ${level}: ${count.toLocaleString('en')} ${count === 1 ? 'node' : 'nodes'}`;
      figure.append(canvas, caption);
      layers.append(figure);
      this.#canvases[level] = canvas;
    }
    const controls = document.createElement('div');
    controls.className = 'controls';
    const play = document.createElement('button');
    play.type = 'button';
    play.textContent = 'Play';
    play.addEventListener('click', () => this.#play());
    this.#slider.type = 'range';
    this.#slider.min = '0';
    this.#slider.addEventListener('input', () => {
      this.#stop();
      this.#draw();
    });
    controls.append(play, this.#slider);
    this.element.append(layers, controls, this.#status);
    this.#search();
  }

  #searchFrom(canvas: HTMLCanvasElement, event: MouseEvent): void {
    const box = canvas.getBoundingClientRect();
    const span = box.width - 2 * PANEL_MARGIN;
    const x = (event.clientX - box.left - PANEL_MARGIN) / span;
    const y = (event.clientY - box.top - PANEL_MARGIN) / span;
    this.#query = Float32Array.of(Math.min(1, Math.max(0, x)), Math.min(1, Math.max(0, y)));
    this.#search();
    this.#play();
  }

  #search(): void {
    const recorder = new SearchRecorder();
    this.#found = new Set(this.#index.search(this.#query, K, { tracer: recorder }).map(({ id }) => id));
    this.#truth = new Set(this.#exact.search(this.#query, K).map(({ id }) => id));
    this.#steps = recorder.steps;
    this.#slider.max = String(this.#steps.length);
    this.#slider.value = this.#slider.max;
    this.#draw();
  }

  #play(): void {
    this.#stop();
    this.#slider.value = '0';
    this.#playing = window.setInterval(() => {
      this.#slider.valueAsNumber += 1;
      this.#draw();
      if (this.#slider.valueAsNumber >= this.#steps.length) this.#stop();
    }, PLAY_STEP_MS);
  }

  #stop(): void {
    window.clearInterval(this.#playing);
    this.#playing = undefined;
  }

  #draw(): void {
    const shown = this.#slider.valueAsNumber;
    const { layers, level: current } = replay(this.#steps, shown);
    const done = shown >= this.#steps.length;
    this.#canvases.forEach((canvas, level) => this.#drawLayer(canvas, level, layers.get(level), { active: level === current && !done, done }));
    const measured = this.#steps.filter((step) => step.kind === 'measure').length;
    const found = [...this.#found].filter((node) => this.#truth.has(node)).length;
    this.#status.textContent =
      `Step ${shown.toLocaleString('en')} of ${this.#steps.length.toLocaleString('en')}. ` +
      `The search measured ${measured.toLocaleString('en')} distances, where brute force measures ${POINTS.toLocaleString('en')}, ` +
      `and found ${found} of the true ${K} nearest.`;
  }

  #drawLayer(canvas: HTMLCanvasElement, level: number, state: LayerState | undefined, { active, done }: { active: boolean; done: boolean }): void {
    const context = canvas.getContext('2d');
    if (!context) return;
    const scale = devicePixelRatio;
    const span = panelSize(level) - 2 * PANEL_MARGIN;
    const at = (node: number): [number, number] => [
      (PANEL_MARGIN + this.#points.data[node * 2] * span) * scale,
      (PANEL_MARGIN + this.#points.data[node * 2 + 1] * span) * scale,
    ];
    const dot = (node: number, radius: number, color: string): void => {
      const [x, y] = at(node);
      context.fillStyle = color;
      context.beginPath();
      context.arc(x, y, radius * scale, 0, 2 * Math.PI);
      context.fill();
    };
    const line = (from: number, to: number, color: string, width: number): void => {
      context.strokeStyle = color;
      context.lineWidth = width * scale;
      context.beginPath();
      context.moveTo(...at(from));
      context.lineTo(...at(to));
      context.stroke();
    };
    const { graph } = this.#index;
    context.fillStyle = COLORS.paper;
    context.fillRect(0, 0, canvas.width, canvas.height);
    const nodes = Array.from({ length: graph.count }, (_, node) => node).filter((node) => graph.levelOf(node) >= level);
    for (const node of nodes) for (const link of graph.neighbors(node, level)) line(node, link, COLORS.link, 1);
    for (const node of nodes) dot(node, level === 0 ? 1.2 : 2, COLORS.node);
    if (state) {
      for (const [from, to] of state.followed) line(from, to, COLORS.followed, 1.5);
      for (const node of state.measured) dot(node, 2.5, COLORS.measured);
      for (const node of state.expanded) dot(node, 2.5, COLORS.followed);
      for (const node of state.kept) dot(node, 3.5, COLORS.kept);
    }
    if (level === 0 && done) for (const node of this.#found) dot(node, 5, COLORS.kept);
    if (level === 0) {
      context.strokeStyle = COLORS.truth;
      context.lineWidth = scale;
      for (const node of this.#truth) {
        const [x, y] = at(node);
        context.beginPath();
        context.arc(x, y, 6 * scale, 0, 2 * Math.PI);
        context.stroke();
      }
    }
    // The query: a cross.
    const [x, y] = [(PANEL_MARGIN + this.#query[0] * span) * scale, (PANEL_MARGIN + this.#query[1] * span) * scale];
    context.strokeStyle = COLORS.current;
    context.lineWidth = 2 * scale;
    context.beginPath();
    context.moveTo(x - 6 * scale, y);
    context.lineTo(x + 6 * scale, y);
    context.moveTo(x, y - 6 * scale);
    context.lineTo(x, y + 6 * scale);
    context.stroke();
    canvas.classList.toggle('active', active);
  }
}
