import './benchmark.css';
import { BenchmarkCard } from './benchmark-card.ts';
import { BENCHMARK_IMAGES } from './benchmark-images.ts';
import { loadImage } from './load-image.ts';

const root = document.querySelector<HTMLElement>('#benchmark');
if (!root) throw new Error('Missing #benchmark element');

root.innerHTML = `
  <header>
    <h1>Benchmark</h1>
    <p>Itzik's ray-traced renders, with the color library's output for each.</p>
    <ul>
      <li><b>Average of all pixels.</b> sRGB averages the stored values, which comes out too dark.
        Linear light averages the light itself: the color the image blends into from a distance.
        OKLab averages perceived lightness and color.</li>
      <li><b>Gradient from A to B.</b> Click an image to move A, then B. sRGB dips dark between
        saturated colors, linear light leans toward the lighter end, and OKLab changes evenly.</li>
      <li><b>Shrunk to 256 px.</b> Our area averaging in linear light keeps the image's light: its
        mean matches the linear-light average above. The browser's canvas scaling blends stored
        values, so fine bright detail comes out darker.</li>
      <li><b>Palette.</b> k-means in OKLab on our shrunk image; each color's share is the part of
        the image it stands for.</li>
    </ul>
  </header>
`;

for (const entry of BENCHMARK_IMAGES) {
  root.append(new BenchmarkCard(entry, await loadImage(entry.url)).element);
}
