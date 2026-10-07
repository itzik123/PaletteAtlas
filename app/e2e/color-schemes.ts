import type { RgbaImage } from '@palette-atlas/color';
import { GALLERY_FILES } from '@palette-atlas/gallery';
import { COLOR_SCHEME_LENGTH, colorSchemeDistance, colorSchemeVector } from '@palette-atlas/vectorize';
import type { Page } from '@playwright/test';
import { FIXTURE_PAINTINGS } from './fixture-gallery.ts';
import { storedStrip } from './stored-strips.ts';

/**
 * The fixture's paintings by their positions in the gallery, ordered by how near their stored
 * color strips lie to some colors (four bytes per segment), by the distance the site searches by.
 * Over four paintings, the search index finds them all, in exactly this order.
 */
export async function byColorScheme(page: Page, colors: readonly number[]): Promise<number[]> {
  const query = colorSchemeVector(stripImage(colors));
  const distances = await Promise.all(
    FIXTURE_PAINTINGS.map(async (_, position) =>
      colorSchemeDistance(query, 0, colorSchemeVector(stripImage(await storedStrip(page, GALLERY_FILES.gallery, position))), 0, COLOR_SCHEME_LENGTH),
    ),
  );
  return FIXTURE_PAINTINGS.map((_, position) => position).sort((a, b) => (distances[a] ?? 0) - (distances[b] ?? 0) || a - b);
}

function stripImage(colors: readonly number[]): RgbaImage {
  return { width: colors.length / 4, height: 1, data: Uint8ClampedArray.from(colors) };
}
