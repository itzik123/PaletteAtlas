/**
 * The pixels of a decoded image, as canvas ImageData, which already has the shape of the
 * libraries' RgbaImage. Works on the page and in a Web Worker alike: both have OffscreenCanvas.
 */
export function bitmapPixels(bitmap: ImageBitmap): ImageData {
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D is not available');
  context.drawImage(bitmap, 0, 0);
  return context.getImageData(0, 0, canvas.width, canvas.height);
}
