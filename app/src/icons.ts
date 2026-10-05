import type { AxisName } from '@palette-atlas/strip';

// Icons as inline SVG, drawn in currentColor so they take the color of the text around them.

const OUTLINE = 'fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"';

function icon(shapes: string, attributes = OUTLINE): string {
  return `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" ${attributes}>${shapes}</svg>`;
}

/** One icon per axis, a picture of the path it takes through the image. */
export const AXIS_ICONS: Readonly<Record<AxisName, string>> = {
  // Three overlapping lights, as colors mix.
  color: icon('<circle cx="8.5" cy="9" r="5"/><circle cx="15.5" cy="9" r="5"/><circle cx="12" cy="15.5" r="5"/>'),
  // A Hilbert curve on a 4 × 4 grid, as the space axis walks it.
  hilbert: icon('<polyline points="3,3 9,3 9,9 3,9 3,15 3,21 9,21 9,15 15,15 15,21 21,21 21,15 21,9 15,9 15,3 21,3"/>'),
  columns: icon('<path d="M4 3v18M12 3v18M20 3v18"/>'),
  radial: icon('<circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="12" r="5.5"/><circle cx="12" cy="12" r="9.5"/>'),
};

export const QUESTION_ICON = icon(
  '<circle cx="12" cy="12" r="10"/><path d="M9.2 9.2a3 3 0 1 1 4 2.8c-.8.4-1.2 1-1.2 1.8v.7"/><circle cx="12" cy="17.6" r=".6" fill="currentColor"/>',
);

export const CLOSE_ICON = icon('<path d="M5 5l14 14M19 5L5 19"/>', OUTLINE.replace('2.5', '3'));

export const UPLOAD_ICON = icon('<path d="M12 16V4M6.5 9.5 12 4l5.5 5.5M4 20h16"/>');

/** GitHub's mark, for the link to the project's repository. */
export const GITHUB_ICON = icon(
  '<path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.05-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.68 0-1.25.45-2.28 1.19-3.08-.12-.3-.52-1.46.11-3.04 0 0 .97-.31 3.17 1.18a10.9 10.9 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.58.23 2.74.11 3.04.74.8 1.19 1.83 1.19 3.08 0 4.41-2.69 5.38-5.25 5.67.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5Z"/>',
  'fill="currentColor"',
);
