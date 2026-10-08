/** The first two bytes of a gzipped file. */
const GZIP_MAGIC = [0x1f, 0x8b] as const;

/**
 * Fetches a file the pipeline gzipped (the search index and the paintings' map, see GALLERY_FILES)
 * and unzips it: hosts serve a binary file as it is (Cloudflare Pages does), unless they serve it
 * as gzip-encoded and the browser has unzipped it already (Vite does), when the bytes come as they
 * are. Works on the page and in a Web Worker alike.
 */
export async function fetchGunzipped(url: string): Promise<Uint8Array> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: ${response.status}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes[0] !== GZIP_MAGIC[0] || bytes[1] !== GZIP_MAGIC[1]) return bytes;
  const unzipped = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(unzipped).arrayBuffer());
}
