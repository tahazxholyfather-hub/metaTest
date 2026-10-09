type Handler<T> = (payload: T) => void;

export class EventEmitter<EventMap extends Record<string, unknown>> {
  private readonly handlers = new Map<keyof EventMap, Set<Handler<EventMap[keyof EventMap]>>>();

  on<K extends keyof EventMap>(event: K, handler: Handler<EventMap[K]>): () => void {
    const set = this.handlers.get(event) ?? new Set();
    set.add(handler as Handler<EventMap[keyof EventMap]>);
    this.handlers.set(event, set);
    return () => this.off(event, handler);
  }

  off<K extends keyof EventMap>(event: K, handler: Handler<EventMap[K]>): void {
    this.handlers.get(event)?.delete(handler as Handler<EventMap[keyof EventMap]>);
  }

  emit<K extends keyof EventMap>(event: K, payload: EventMap[K]): void {
    const set = this.handlers.get(event);
    if (!set) return;
    for (const handler of set) {
      (handler as Handler<EventMap[K]>)(payload);
    }
  }

  clear(): void {
    this.handlers.clear();
  }
}
