/**
 * Lightweight registry for opening the AppSearch modal imperatively.
 * AppSearch registers itself on mount; any component calls openSearch() to trigger it.
 */
type Listener = () => void;
const listeners = new Set<Listener>();

export function onOpenSearch(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function openSearch(): void {
  listeners.forEach(fn => fn());
}
