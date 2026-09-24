import { describe, expect, it } from 'vitest';
import { EventEmitter } from '@/src/utils/event-emitter';

describe('EventEmitter', () => {
  it('emits and unsubscribes', () => {
    const bus = new EventEmitter<{ ping: { n: number } }>();
    let seen = 0;
    const off = bus.on('ping', (payload) => {
      seen += payload.n;
    });
    bus.emit('ping', { n: 2 });
    off();
    bus.emit('ping', { n: 5 });
    expect(seen).toBe(2);
  });
});
