/**
 * In-process mutex — serializes concurrent async operations.
 *
 * Works as a Promise chain: each `lock(fn)` call enqueues `fn` behind the
 * currently running one. If `fn` throws, the error propagates to the caller
 * but the lock is released so the next queued operation can proceed.
 *
 * Usage:
 *   const m = new Mutex();
 *   const result = await m.lock(async () => { ... });
 *
 * Why this and not a file-system lock?
 *   This app is a single Node process. A per-file in-memory mutex is the
 *   lightest correct solution: no dependency, no filesystem overhead, and
 *   it serializes exactly what needs serializing — read-then-write operations
 *   on the same JSON file that would otherwise race.
 */
class Mutex {
  constructor() {
    this._queue = Promise.resolve();
  }

  /**
   * Acquire the lock, run `fn`, then release.
   * @param {() => Promise<T>} fn
   * @returns {Promise<T>}
   */
  lock(fn) {
    const next = this._queue.then(() => fn());
    // Absorb rejection on the chain so a failure doesn't permanently stall
    // the queue, but still propagates to the original caller via `next`.
    this._queue = next.catch(() => {});
    return next;
  }
}

module.exports = { Mutex };
