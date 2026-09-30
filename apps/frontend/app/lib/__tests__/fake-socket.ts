import { vi } from 'vitest';
import { type AckResult } from '@campus-pubquiz/types';

type Handler = (...args: unknown[]) => void;
type AckCallback = (result: AckResult<unknown>) => void;

export interface SentEmit {
  event: string;
  payload: unknown;
  /** Undefined when the client emitted without an acknowledgement callback. */
  ack: AckCallback | undefined;
}

/**
 * A faked socket.io-client transport. Every emit is recorded together with
 * its acknowledgement callback, so a test plays the server: answer it with
 * `acknowledge`/`reject`, or leave it unanswered to exercise the timeout.
 * Starts disconnected, like a real socket; `serverConnects` flips it.
 */
export function createFakeSocket() {
  const handlers = new Map<string, Handler[]>();
  const sent: SentEmit[] = [];
  const socket = {
    connected: false,
    id: 'fake-socket-id',
    sent,
    on: vi.fn((event: string, handler: Handler) => {
      const list = handlers.get(event) ?? [];
      list.push(handler);
      handlers.set(event, list);
    }),
    emit: vi.fn((event: string, payload?: unknown, ack?: AckCallback) => {
      sent.push({ event, payload, ack });
    }),
    disconnect: vi.fn(() => {
      socket.connected = false;
    }),
    connect: vi.fn(() => {
      socket.connected = true;
    }),
    trigger(event: string, payload?: unknown) {
      for (const handler of handlers.get(event) ?? []) {
        handler(payload);
      }
    },
    /** The server accepted the handshake. */
    serverConnects() {
      socket.connected = true;
      socket.trigger('connect');
    },
    /** The connection dropped (or the server refused it). */
    serverDisconnects(reason = 'transport close') {
      socket.connected = false;
      socket.trigger('disconnect', reason);
    },
    /** Every emit of `event` so far, oldest first. */
    emitsOf(event: string): SentEmit[] {
      return sent.filter((entry) => entry.event === event);
    },
    lastEmitOf(event: string): SentEmit {
      const entries = socket.emitsOf(event);
      const last = entries[entries.length - 1];
      if (!last) throw new Error(`No ${event} emit was sent`);
      return last;
    },
    /** Answers the most recent emit of `event` with success. */
    acknowledge(event: string, data?: unknown) {
      socket.lastEmitOf(event).ack?.({ success: true, data });
    },
    /** Answers the most recent emit of `event` with a rejection. Like today's backend, also pushes the legacy untagged 'exception'. */
    reject(event: string, message: string) {
      socket.lastEmitOf(event).ack?.({ success: false, error: message });
      socket.trigger('exception', { message });
    },
  };
  return socket;
}

export type FakeSocket = ReturnType<typeof createFakeSocket>;
