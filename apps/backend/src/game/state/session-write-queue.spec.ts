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

describe('SessionWriteQueue.hold', () => {
  it('waits for a write already running on either join code', async () => {
    const queue = new SessionWriteQueue();
    const running = gate();
    void queue.run('BBBB', () => running.opened);
    const work = jest.fn(() => Promise.resolve('done'));

    const held = queue.hold(['AAAA', 'BBBB'], work);

    expect(await isPending(held)).toBe(true);
    expect(work).not.toHaveBeenCalled();
    running.open();
    await expect(held).resolves.toBe('done');
  });

  it('runs a write queued on either join code during the hold only after the work finishes', async () => {
    const queue = new SessionWriteQueue();
    const work = gate();
    const order: string[] = [];
    const held = queue.hold(['AAAA', 'BBBB'], () =>
      work.opened.then(() => order.push('hold')),
    );
    const writeA = queue.run('AAAA', () => Promise.resolve(order.push('a')));
    const writeB = queue.run('BBBB', () => Promise.resolve(order.push('b')));

    expect(await isPending(writeA)).toBe(true);
    expect(await isPending(writeB)).toBe(true);
    work.open();
    await Promise.all([held, writeA, writeB]);

    expect(order[0]).toBe('hold');
    expect(order.slice(1).sort()).toEqual(['a', 'b']);
  });

  it('completes two holds on the same join codes given in opposite orders', async () => {
    const queue = new SessionWriteQueue();
    const running = gate();
    void queue.run('AAAA', () => running.opened);
    void queue.run('BBBB', () => running.opened);

    const first = queue.hold(['AAAA', 'BBBB'], () => Promise.resolve(1));
    const second = queue.hold(['BBBB', 'AAAA'], () => Promise.resolve(2));
    running.open();

    await expect(Promise.all([first, second])).resolves.toEqual([1, 2]);
  });

  it('does not hold up a write on a join code outside the set', async () => {
    const queue = new SessionWriteQueue();
    const work = gate();
    const held = queue.hold(['AAAA', 'BBBB'], () => work.opened);

    await expect(queue.run('CCCC', () => Promise.resolve('ok'))).resolves.toBe(
      'ok',
    );

    work.open();
    await held;
  });

  it('releases every held queue and rejects the caller when the work throws', async () => {
    const queue = new SessionWriteQueue();
    const held = queue.hold(['AAAA', 'BBBB'], () =>
      Promise.reject(new Error('boom')),
    );

    await expect(held).rejects.toThrow('boom');
    await expect(queue.run('AAAA', () => Promise.resolve('a'))).resolves.toBe(
      'a',
    );
    await expect(queue.run('BBBB', () => Promise.resolve('b'))).resolves.toBe(
      'b',
    );
  });
});

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
