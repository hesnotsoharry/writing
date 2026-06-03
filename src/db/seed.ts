import type { BinderStore } from "./binderStore";

let seedPromise: Promise<void> | null = null;

/**
 * Seed a sample project when the projects table is empty — at most ONCE per
 * process. Memoized like getDb's dbPromise: React StrictMode double-invokes the
 * init effect (mount→cleanup→remount), firing two seedIfEmpty calls that both
 * await `listProjects()` before either inserts — so both see an empty table and
 * both seed, producing a duplicate. Sharing one promise means the second caller
 * reuses the first's in-flight seed instead of starting its own.
 *
 * The seeded project doubles as a smoke fixture: two chapters + scenes + one
 * short piece, demonstrating the tree structure immediately on first run.
 */
export function seedIfEmpty(store: BinderStore): Promise<void> {
  if (!seedPromise) {
    seedPromise = doSeed(store).catch((err) => {
      seedPromise = null; // allow a retry on the next launch after a failure
      throw err;
    });
  }
  return seedPromise;
}

async function doSeed(store: BinderStore): Promise<void> {
  const existing = await store.listProjects();
  if (existing.length > 0) return;

  const projectId = await store.createProject({
    title: "The Salt Road",
    type: "novel",
  });

  const ch1 = await store.createFolder({ projectId, title: "Chapter 1" });
  const ch2 = await store.createFolder({ projectId, title: "Chapter 2" });

  await store.createScene({ projectId, folderId: ch1, title: "Opening" });
  await store.createScene({ projectId, folderId: ch1, title: "The river" });
  await store.createScene({ projectId, folderId: ch2, title: "Arrival" });
  // One short piece (null folder) to exercise that section of the tree.
  await store.createScene({ projectId, folderId: null, title: "A stray idea" });
}
