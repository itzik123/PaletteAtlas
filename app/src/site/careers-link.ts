import { BARCODE_ICON } from '../icons.ts';

/** A pill leading to the painters' Career Barcodes, marked as the page shown when it is. */
export function careersLink(current = false): HTMLAnchorElement {
  const link = document.createElement('a');
  link.className = 'pill careers-link';
  link.href = './artist.html';
  link.innerHTML = `${BARCODE_ICON}<span>Career Barcodes</span>`;
  if (current) link.setAttribute('aria-current', 'page');
  return link;
}
