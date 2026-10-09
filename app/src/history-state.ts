// What a page keeps in its own history entry (history.state), each thing under a key of its own.
// The browser keeps the entry's state, so going back to the page, or reloading it, finds it again.

/** The value kept under a key in this page's history entry, if any. */
export function keptInHistory<T>(key: string): T | undefined {
  const state: unknown = history.state;
  return state && typeof state === 'object' && key in state ? (state as Readonly<Record<string, T>>)[key] : undefined;
}

/** Keeps a value under a key in this page's history entry, beside whatever else the entry keeps. */
export function keepInHistory(key: string, value: unknown): void {
  const state: unknown = history.state;
  history.replaceState({ ...(state && typeof state === 'object' ? state : {}), [key]: value }, '');
}
