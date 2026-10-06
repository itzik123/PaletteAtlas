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
  saved(): WallPlace | undefined {
    const state: unknown = history.state;
    return state && typeof state === 'object' && STATE_KEY in state ? (state[STATE_KEY] as WallPlace) : undefined;
  },

  save(place: WallPlace): void {
    const state: unknown = history.state;
    history.replaceState({ ...(state && typeof state === 'object' ? state : {}), [STATE_KEY]: place }, '');
  },
} as const;
