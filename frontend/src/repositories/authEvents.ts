type Listener = () => void;

const listeners = new Set<Listener>();

/** Subscribes to "the server rejected our session"; returns the unsubscribe. */
export function onSessionExpired(listener: Listener): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function emitSessionExpired(): void {
  listeners.forEach(listener => listener());
}
