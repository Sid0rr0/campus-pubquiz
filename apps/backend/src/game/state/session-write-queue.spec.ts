import { SessionWriteQueue } from '@/game/state/session-write-queue';

interface Gate {
  opened: Promise<void>;
  open: () => void;
}

function gate(): Gate {
  let open!: () => void;
  const opened = new Promise<void>((resolve) => (open = resolve));
  return { opened, open };
}

async function isPending(promise: Promise<unknown>): Promise<boolean> {
  const marker = Symbol('pending');
  const winner = await Promise.race([
    promise,
    new Promise((resolve) => setImmediate(() => resolve(marker))),
  ]);
  return winner === marker;
}

describe('SessionWriteQueue.idle', () => {
  it('resolves immediately when nothing is queued', async () => {
    const queue = new SessionWriteQueue();

    await expect(queue.idle('ABCD')).resolves.toBeUndefined();
  });

  it('waits for a running write', async () => {
    const queue = new SessionWriteQueue();
    const running = gate();
    void queue.run('ABCD', () => running.opened);

    const idle = queue.idle('ABCD');

    expect(await isPending(idle)).toBe(true);
    running.open();
    await expect(idle).resolves.toBeUndefined();
  });

  it('waits for a write queued behind the running one', async () => {
    const queue = new SessionWriteQueue();
    const first = gate();
    const second = gate();
    const order: string[] = [];
    void queue.run('ABCD', () => first.opened.then(() => order.push('first')));
    void queue.run('ABCD', () =>
      second.opened.then(() => order.push('second')),
    );

    const idle = queue.idle('ABCD');
    first.open();
    expect(await isPending(idle)).toBe(true);
    second.open();
    await idle;

    expect(order).toEqual(['first', 'second']);
  });

  it('waits for a write that a running write queues', async () => {
    const queue = new SessionWriteQueue();
    const inner = gate();
    const order: string[] = [];
    void queue.run('ABCD', () => {
      order.push('outer');
      void queue.run('ABCD', () =>
        inner.opened.then(() => order.push('inner')),
      );
      return Promise.resolve();
    });

    const idle = queue.idle('ABCD');
    expect(await isPending(idle)).toBe(true);
    inner.open();
    await idle;

    expect(order).toEqual(['outer', 'inner']);
  });

  it('still resolves when a queued write throws', async () => {
    const queue = new SessionWriteQueue();
    const failing = queue.run('ABCD', () => Promise.reject(new Error('boom')));
    const failure = expect(failing).rejects.toThrow('boom');

    await expect(queue.idle('ABCD')).resolves.toBeUndefined();
    await failure;
  });

  it('does not wait for another join code’s writes', async () => {
    const queue = new SessionWriteQueue();
    const other = gate();
    void queue.run('OTHR', () => other.opened);

    await expect(queue.idle('ABCD')).resolves.toBeUndefined();

    other.open();
    await queue.idle('OTHR');
  });
});
