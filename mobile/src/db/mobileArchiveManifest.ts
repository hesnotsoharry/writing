export interface RestoredScene {
  id: string;
  title: string;
  synopsis: string | null;
  status: string;
  sortOrder: number;
  wordCount: number;
  stateBase64: string | null;
  folderId: string | null;
}

export interface ArchiveRestorePlan {
  archiveId: string;
  projectId: string;
  kind: "scene" | "chapter";
  folder: { id: string; title: string; sortOrder: number } | null;
  scenes: RestoredScene[];
}

export interface ArchivePayload {
  id: string;
  projectId: string;
  kind: "scene" | "chapter";
  originalId: string | null;
  title: string;
  stateBase64: string | null;
}

function object(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null
    ? value as Record<string, unknown> : {};
}

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function finiteNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function nullableText(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function sceneFrom(
  raw: unknown, fallbackId: string, fallbackTitle: string, folderId: string | null,
): RestoredScene {
  const row = object(raw);
  const meta = object(row.meta);
  return {
    id: text(row.id, fallbackId), title: text(row.title, fallbackTitle), folderId,
    synopsis: nullableText(row.synopsis ?? meta.synopsis),
    status: text(row.status ?? meta.status, "blank"),
    sortOrder: finiteNumber(row.sortOrder ?? meta.sort_order, 1000),
    wordCount: finiteNumber(row.wordCount ?? meta.word_count, 0),
    stateBase64: nullableText(row.doc ?? row.stateBase64),
  };
}

export function parseArchiveManifest(payload: ArchivePayload): ArchiveRestorePlan {
  const manifest = object(JSON.parse(payload.stateBase64 ?? "{}") as unknown);
  if (payload.kind === "scene") {
    const id = payload.originalId ?? crypto.randomUUID();
    return {
      archiveId: payload.id, projectId: payload.projectId, kind: "scene", folder: null,
      scenes: [sceneFrom(manifest, id, payload.title, null)],
    };
  }
  const folderId = payload.originalId ?? crypto.randomUUID();
  const folder = object(manifest.folder);
  const entries = Array.isArray(manifest.scenes) ? manifest.scenes : [];
  return {
    archiveId: payload.id, projectId: payload.projectId, kind: "chapter",
    folder: {
      id: folderId, title: payload.title,
      sortOrder: finiteNumber(manifest.folderSortOrder ?? folder.sort_order, 1000),
    },
    scenes: entries.map((entry) => sceneFrom(
      entry, crypto.randomUUID(), "Untitled", folderId,
    )),
  };
}
