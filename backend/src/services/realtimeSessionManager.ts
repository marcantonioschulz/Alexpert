export type RealtimeSessionEvent =
  | { type: 'session.started'; conversationId: string; model: string; timestamp: string }
  | { type: 'status'; status: string; conversationId: string; detail?: Record<string, unknown> }
  | { type: 'transcript.saved'; conversationId: string; transcript: string }
  | { type: 'score.completed'; conversationId: string; score: number; feedback: string }
  | { type: 'error'; conversationId: string; message: string; retryable?: boolean };

type Listener = (event: RealtimeSessionEvent) => void;

const HISTORY_LIMIT = 25;

export class RealtimeSessionManager {
  private listeners = new Map<string, Set<Listener>>();
  private history = new Map<string, RealtimeSessionEvent[]>();

  subscribe(conversationId: string, listener: Listener): () => void {
    const listeners = this.listeners.get(conversationId) ?? new Set<Listener>();
    listeners.add(listener);
    this.listeners.set(conversationId, listeners);

    const history = this.history.get(conversationId);
    if (history) {
      for (const event of history) {
        listener(event);
      }
    }

    return () => {
      const current = this.listeners.get(conversationId);
      if (current) {
        current.delete(listener);
        if (current.size === 0) {
          this.listeners.delete(conversationId);
        }
      }
    };
  }

  emit(conversationId: string, event: RealtimeSessionEvent) {
    const history = this.history.get(conversationId) ?? [];
    history.push(event);
    if (history.length > HISTORY_LIMIT) {
      history.shift();
    }
    this.history.set(conversationId, history);

    const listeners = this.listeners.get(conversationId);
    if (!listeners) {
      return;
    }

    for (const listener of listeners) {
      listener(event);
    }
  }

  complete(conversationId: string) {
    this.listeners.delete(conversationId);
    this.history.delete(conversationId);
  }
}

export const realtimeSessionManager = new RealtimeSessionManager();
