import type { BinderStore } from "./binderStore";

/**
 * Seed a sample project when the projects table is empty.
 * Idempotent — does nothing if at least one project already exists.
 *
 * The seeded project doubles as a smoke fixture: it demonstrates the tree
 * structure (two chapters + scenes + one short piece) immediately on first run.
 */
export async function seedIfEmpty(store: BinderStore): Promise<void> {
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
  await store.createScene({
    projectId,
    folderId: null,
    title: "A stray idea",
  });
}
