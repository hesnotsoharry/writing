/**
 * ImportOutlineButton.tsx — the binder's "Import outline…" entry point, under
 * "New chapter". Owns the dialog's open state; the write itself is the
 * BinderCallbacks.onImportOutline callback (App wires store + reload/switch).
 */
import { type ReactElement, useState } from "react";

import { Icon } from "../components/Icon";
import type { ImportOutlineResult, ImportTarget } from "../features/import/applyOutlinePlan";
import { ImportOutlineDialog } from "../features/import/ImportOutlineDialog";
import type { OutlinePlan } from "../features/import/outlinePlan";
import { useBinderToast } from "./binderToast";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

type OnImport = (plan: OutlinePlan, target: ImportTarget) => Promise<ImportOutlineResult>;

export function ImportOutlineButton({ onImport }: { onImport: OnImport }): ReactElement {
  const [open, setOpen] = useState(false);
  const toast = useBinderToast();
  async function importAndReport(plan: OutlinePlan, target: ImportTarget): Promise<ImportOutlineResult> {
    const result = await onImport(plan, target);
    const where = target.kind === "new" ? ` into “${target.title}”` : "";
    toast(`Imported ${plural(result.chapters, "chapter")} and ${plural(result.scenes, "scene")}${where}`);
    return result;
  }
  return (
    <>
      <button className="add-chapter" onClick={() => setOpen(true)}>
        <Icon name="download" style={{ width: 13, height: 13 }} /> Import outline…
      </button>
      {open && <ImportOutlineDialog onImport={importAndReport} onClose={() => setOpen(false)} />}
    </>
  );
}
