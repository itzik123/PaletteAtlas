import { keepInHistory, keptInHistory } from '../history-state.ts';

/**
 * Where a visitor was on the Atlas's wall: how many paintings were hung, and which one was at the
 * top of the screen, its tile this far below the screen's top (less than 0 when partly scrolled
 * past). A painting rather than a scroll offset marks the place, so it holds even if the window has
 * changed width and the rows break differently.
 */
export interface WallPlace {
  readonly hung: number;
  readonly painting: number;
  readonly offset: number;
}

/** The key of the place in its history entry's state. */
const STATE_KEY = 'wallPlace';

/**
 * Memento: the Atlas saves its place in the page's own history entry, and the browser keeps it
 * there, so going back to the Atlas (by the back button, or a painting page's back link) finds it,
 * while a fresh visit starts at the top.
 */
export const WallPlaces = {
  saved: (): WallPlace | undefined => keptInHistory<WallPlace>(STATE_KEY),
  save: (place: WallPlace): void => keepInHistory(STATE_KEY, place),
} as const;
