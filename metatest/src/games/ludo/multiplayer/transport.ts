export interface GameTransport {
  send(event: { type: string; payload?: unknown }): void
  subscribe(handler: (event: { type: string; payload?: unknown }) => void): () => void
}

/**
 * Local stand-in for a later Socket.IO transport.
 * Game logic never talks to the network — only to this interface.
 */
export function createLocalTransport(): GameTransport {
  const handlers = new Set<(event: { type: string; payload?: unknown }) => void>()
  return {
    send(event) {
      for (const handler of handlers) handler(event)
    },
    subscribe(handler) {
      handlers.add(handler)
      return () => handlers.delete(handler)
    },
  }
}
