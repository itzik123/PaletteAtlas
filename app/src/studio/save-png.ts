/** How long the saved file's address stays valid: long enough for any browser to start the download. */
const ADDRESS_LIFETIME_MS = 60_000;

/** Saves a canvas as a PNG file in the user's downloads, without it ever leaving the computer. */
export async function savePng(canvas: HTMLCanvasElement, fileName: string): Promise<void> {
  const png = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!png) throw new Error('The browser could not encode the PNG');
  const address = URL.createObjectURL(png);
  const link = document.createElement('a');
  link.href = address;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(address), ADDRESS_LIFETIME_MS);
}
