import { ColorSearch } from '../atlas/color-search.ts';
import { GalleryData } from '../atlas/gallery-data.ts';
import type { IndexLayers } from './index-layers.ts';
import { StackMap } from './stack-map.ts';

/**
 * All the Lab draws: the gallery, its search (which runs in the search worker, see ColorSearch),
 * the search index's layers, and the paintings' map.
 */
export class LabData {
  readonly gallery: GalleryData;
  readonly search: ColorSearch;
  readonly layers: IndexLayers;
  readonly map: StackMap;

  private constructor(gallery: GalleryData, search: ColorSearch, layers: IndexLayers, map: StackMap) {
    this.gallery = gallery;
    this.search = search;
    this.layers = layers;
    this.map = map;
  }

  /** Loads the gallery, then the index's layers (from the search worker) and the map. */
  static async load(): Promise<LabData> {
    const gallery = await GalleryData.load();
    const search = new ColorSearch(gallery.searchIndexUrl);
    const [layers, map] = await Promise.all([search.layers(), gallery.paintingMap()]);
    return new LabData(gallery, search, layers, new StackMap(map));
  }
}
