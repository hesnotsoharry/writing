// @vitest-environment jsdom — annotation for the test file; not needed here
import type { ReactElement } from "react";
import { useEffect, useState } from "react";

import { Icon } from "../../components/Icon";
import type { ArchivedItem, BinderStore } from "../../db/binderStore";
import { SqliteBinderStore } from "../../db/sqliteBinderStore";

const defaultStore: BinderStore = new SqliteBinderStore();

// ---------------------------------------------------------------------------
// ArchiveRow — one item in the list
// ---------------------------------------------------------------------------

interface ArchiveRowProps {
  item: ArchivedItem;
  onRestore: (id: string) => void;
  onPurge: (id: string) => void;
}

function ArchiveRow({ item, onRestore, onPurge }: ArchiveRowProps): ReactElement {
  const kindLabel = item.kind === "chapter" ? "Chapter" : "Scene";
  const subText = item.sub ? ` · ${item.sub}` : "";
  return (
    <div style={{
      border: "1px solid var(--line)", borderRadius: "var(--r-md)", padding: "10px 12px",
      background: "var(--paper)", display: "flex", gap: 12, alignItems: "center",
    }}>
      <Icon
        name={item.kind === "chapter" ? "book" : "fileText"}
        style={{ width: 16, height: 16, color: "var(--ink-3)", flexShrink: 0 }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {item.title}
        </div>
        <div style={{ fontSize: 11, color: "var(--ink-4)" }}>{kindLabel}{subText}</div>
      </div>
      <button type="button" className="btn btn-ghost" onClick={() => onRestore(item.id)} style={{ padding: "5px 10px" }}>
        <Icon name="rotate" className="ic" /> Restore
      </button>
      <button type="button" className="iconbtn" title="Delete forever" onClick={() => onPurge(item.id)}>
        <Icon name="trash" className="ic" style={{ width: 15, height: 15, color: "var(--danger)" }} />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ArchiveSheet — sheet chrome (extracted to keep Archive under 40-line limit)
// ---------------------------------------------------------------------------

interface ArchiveSheetProps {
  items: ArchivedItem[] | null;
  onClose: () => void;
  onRestore: (id: string) => void;
  onPurge: (id: string) => void;
}

function ArchiveSheet({ items, onClose, onRestore, onPurge }: ArchiveSheetProps): ReactElement {
  return (
    <div className="scrim" onClick={onClose}>
      <div className="sheet" style={{ width: 540 }} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <div>
            <div className="sheet-title"><Icon name="archive" className="ic" />Archived</div>
            <div className="sheet-sub">Out of the way, not gone. Restore any item or remove it for good.</div>
          </div>
          <button type="button" className="iconbtn sheet-x" onClick={onClose}><Icon name="x" className="ic" /></button>
        </div>
        <div className="sheet-body" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {items !== null && items.length === 0 && (
            <div className="empty-hint" style={{ textAlign: "center", padding: 28 }}>Nothing archived.</div>
          )}
          {items !== null && items.map((it) => (
            <ArchiveRow key={it.id} item={it} onRestore={onRestore} onPurge={onPurge} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Archive overlay (public export — DI seam: test injects fake store)
// ---------------------------------------------------------------------------

export function Archive({
  projectId,
  store = defaultStore,
  onClose,
  onChanged,
}: {
  projectId?: string;
  store?: BinderStore;
  onClose: () => void;
  onChanged?: () => void;
}): ReactElement {
  const [items, setItems] = useState<ArchivedItem[] | null>(null);

  function loadItems(): Promise<void> {
    return store.listArchived(projectId!).then(setItems).catch((err: unknown) => {
      console.error("[archive] listArchived failed", err);
      setItems([]);
    });
  }

  useEffect(() => {
    if (!projectId) { return; }
    void loadItems();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // Treat missing projectId the same as an empty list — no query should run.
  const displayItems: ArchivedItem[] | null = projectId ? items : [];

  async function handleRestore(id: string): Promise<void> {
    await store.restoreArchived(id);
    await loadItems();
    onChanged?.();
  }

  async function handlePurge(id: string): Promise<void> {
    await store.purgeArchived(id);
    await loadItems();
    onChanged?.();
  }

  return <ArchiveSheet items={displayItems} onClose={onClose} onRestore={handleRestore} onPurge={handlePurge} />;
}
