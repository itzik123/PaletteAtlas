import { BACK_ICON } from '../icons.ts';

/** What a page of the Atlas shows when what it should show isn't there: a word why, and the way back. */
export function missingPage(message: string): HTMLElement {
  const main = document.createElement('main');
  main.className = 'missing-page';
  main.innerHTML = `<h1></h1><a class="pill" href="./atlas.html">${BACK_ICON}<span>Atlas</span></a>`;
  main.querySelector('h1')!.textContent = message;
  return main;
}
