import { describe, expect, it } from 'vitest';
import { RealtimeSessionManager, type RealtimeSessionEvent } from './realtimeSessionManager.js';

describe('RealtimeSessionManager', () => {
  it('replays history to new subscribers and supports unsubscribe', () => {
    const manager = new RealtimeSessionManager();
    const historyEvent: RealtimeSessionEvent = {
      type: 'status',
      status: 'initializing',
      conversationId: 'conv-1'
    };

    manager.emit('conv-1', historyEvent);

    const received: RealtimeSessionEvent[] = [];
    const unsubscribe = manager.subscribe('conv-1', (event) => received.push(event));

    expect(received).toHaveLength(1);
    expect(received[0]).toEqual(historyEvent);

    manager.emit('conv-1', {
      type: 'session.started',
      conversationId: 'conv-1',
      model: 'test-model',
      timestamp: new Date().toISOString()
    });

    expect(received).toHaveLength(2);

    unsubscribe();
    manager.emit('conv-1', {
      type: 'status',
      status: 'after-unsubscribe',
      conversationId: 'conv-1'
    });

    expect(received).toHaveLength(2);
  });
});
