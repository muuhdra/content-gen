/**
 * Mutex — proves concurrent writes are serialized.
 *
 * Without the mutex, two concurrent read-modify-write operations on the same
 * array would clobber each other (one read sees the stale snapshot and
 * overwrites the other's change). With the mutex every write runs atomically.
 */
const { test } = require("node:test");
const assert = require("node:assert/strict");

const { Mutex } = require("../src/lib/mutex");

test("lock sérialise les opérations concurrentes (pas de clobber)", async () => {
  const mutex = new Mutex();
  const log = [];

  // Fire 5 concurrent tasks that each append to `log` in two steps
  // (to give the event loop a chance to interleave if unlocked).
  await Promise.all(
    Array.from({ length: 5 }, (_, i) =>
      mutex.lock(async () => {
        log.push(`start-${i}`);
        // Yield to event loop — without a mutex another task could sneak in here
        await new Promise((r) => setImmediate(r));
        log.push(`end-${i}`);
      })
    )
  );

  // Every start must be immediately followed by its own end (no interleaving).
  for (let i = 0; i < log.length; i += 2) {
    const start = log[i];
    const end = log[i + 1];
    const id = start.replace("start-", "");
    assert.equal(end, `end-${id}`,
      `Interleaving détecté: "${start}" suivi de "${end}" (attendu "end-${id}")`
    );
  }

  assert.equal(log.length, 10, "toutes les tâches ont été exécutées");
});

test("une tâche qui échoue libère le lock pour la suivante", async () => {
  const mutex = new Mutex();
  const results = [];

  await Promise.allSettled([
    mutex.lock(async () => {
      throw new Error("échec intentionnel");
    }),
    mutex.lock(async () => {
      results.push("second exécuté");
    }),
  ]);

  assert.deepEqual(results, ["second exécuté"],
    "la deuxième tâche doit s'exécuter même si la première a échoué"
  );
});

test("opérations read-only (pas sous lock) ne bloquent pas les writers", async () => {
  const mutex = new Mutex();
  const order = [];

  // Un writer long
  const writer = mutex.lock(async () => {
    await new Promise((r) => setTimeout(r, 20));
    order.push("writer");
  });

  // Un reader free-threaded — démarre pendant que le writer tourne
  const reader = (async () => {
    order.push("reader");
  })();

  await Promise.all([writer, reader]);

  // Le reader n'est pas bloqué, il s'exécute avant la fin du writer
  assert.equal(order[0], "reader", "le reader free-threaded ne doit pas attendre le writer");
  assert.equal(order[1], "writer");
});
