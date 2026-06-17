/**
 * Global native-context-menu guard.
 *
 * WebView2 shows a browser context menu (Reload / Back / Inspect / Save image)
 * on right-click anywhere the app doesn't handle it. The editor and brainstorm
 * board already render their own custom menus; every other surface leaked the
 * native one. This guard suppresses the native menu app-wide — EXCEPT inside
 * editable text fields, where the native Cut/Copy/Paste/spellcheck menu is the
 * expected, useful behaviour (there is no custom replacement for it there).
 *
 * Custom in-app menus call preventDefault on their own inner handlers first, so
 * this document-level listener never interferes with them.
 *
 * Call once at startup, production only (dev keeps right-click→Inspect).
 */

/** True when the target is an editable field whose native menu we preserve. */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return true;
  // Coerce to a real boolean — some environments (jsdom) leave isContentEditable
  // undefined on non-editable elements, and the declared return type is boolean.
  return target.isContentEditable === true;
}

/**
 * Install the guard on `doc` (defaults to the global document). Returns a
 * disposer that removes the listener.
 */
export function installContextMenuGuard(
  doc: Document = document,
): () => void {
  const handler = (e: MouseEvent): void => {
    if (!isEditableTarget(e.target)) e.preventDefault();
  };
  doc.addEventListener("contextmenu", handler);
  return () => doc.removeEventListener("contextmenu", handler);
}
