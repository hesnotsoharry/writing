// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as Y from "yjs";

import { buildTree } from "../binder/buildTree";
import type { Folder, Scene } from "../db/binderStore";
import { InMemorySceneDocStore } from "../db/sceneDocStore";
import { ExportOverlay } from "../features/export/Export";
import { encodeDoc } from "../yjs/serialize";

// ---------------------------------------------------------------------------
// Mock blobDownloadSave so the fallback path is verifiable without real DOM
// download machinery (URL.createObjectURL is not implemented in jsdom).
// ---------------------------------------------------------------------------
vi.mock("../features/export/blobDownloadSave", () => ({
  blobDownloadSave: vi.fn().mockResolvedValue(undefined),
}));

// Import AFTER mock registration so we get the mocked version.
import { blobDownloadSave } from "../features/export/blobDownloadSave";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeScene(
  id: string,
  title: string,
  sortOrder: number,
  folderId: string | null = null
): Scene {
  return {
    id,
    project_id: "proj-test",
    folder_id: folderId,
    title,
    synopsis: null,
    sort_order: sortOrder,
    word_count: 0,
    status: "blank",
  };
}

function makeFolder(id: string, title: string, sortOrder: number): Folder {
  return { id, project_id: "proj-test", title, sort_order: sortOrder };
}

/** Build a Y.Doc with text in a single XmlFragment paragraph. */
function docWithText(text: string): Y.Doc {
  const doc = new Y.Doc();
  const frag = doc.getXmlFragment("content");
  const p = new Y.XmlElement("paragraph");
  const t = new Y.XmlText();
  t.insert(0, text);
  p.insert(0, [t]);
  frag.insert(0, [p]);
  return doc;
}

async function seedDoc(
  store: InMemorySceneDocStore,
  sceneId: string,
  text: string
): Promise<void> {
  const doc = docWithText(text);
  await store.save(sceneId, encodeDoc(doc), text);
}

/** Build a minimal single-scene store + tree for test use. */
async function makeMinimalFixture(): Promise<{
  store: InMemorySceneDocStore;
  tree: ReturnType<typeof buildTree>;
  sceneId: string;
}> {
  const store = new InMemorySceneDocStore();
  const folder = makeFolder("f1", "Chapter One", 1000);
  const scene = makeScene("s1", "Scene One", 1000, "f1");
  await seedDoc(store, "s1", "The scene content.");
  const tree = buildTree([folder], [scene]);
  return { store, tree, sceneId: "s1" };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("ExportOverlay — structure", () => {
  it("renders .scrim and .sheet with all three format radio options", async () => {
    const { store, tree } = await makeMinimalFixture();
    const { container } = render(
      <ExportOverlay
        projectId="proj-test"
        initialScope="scene"
        sceneId="s1"
        chapterId="f1"
        sceneDocStore={store}
        tree={tree}
        onClose={() => {}}
      />
    );
    expect(container.querySelector(".scrim")).toBeInTheDocument();
    expect(container.querySelector(".sheet")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Markdown (.md)" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Word (.docx)" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "PDF" })).toBeInTheDocument();
  });

  it("renders Export and Cancel buttons", async () => {
    const { store, tree } = await makeMinimalFixture();
    render(
      <ExportOverlay
        projectId="proj-test"
        initialScope="scene"
        sceneId="s1"
        chapterId="f1"
        sceneDocStore={store}
        tree={tree}
        onClose={() => {}}
      />
    );
    expect(screen.getByRole("button", { name: "Export" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });

  it("shows the scope label 'Scene' in the sheet sub-header", async () => {
    const { store, tree } = await makeMinimalFixture();
    const { container } = render(
      <ExportOverlay
        projectId="proj-test"
        initialScope="scene"
        sceneId="s1"
        chapterId="f1"
        sceneDocStore={store}
        tree={tree}
        onClose={() => {}}
      />
    );
    expect(container.querySelector(".sheet-sub")?.textContent).toBe("Scene");
  });

  it("shows 'Chapter' sub-header when initialScope='chapter'", async () => {
    const store = new InMemorySceneDocStore();
    const folder = makeFolder("f1", "Chapter One", 1000);
    const tree = buildTree([folder], []);
    const { container } = render(
      <ExportOverlay
        projectId="proj-test"
        initialScope="chapter"
        sceneId={null}
        chapterId="f1"
        sceneDocStore={store}
        tree={tree}
        onClose={() => {}}
      />
    );
    expect(container.querySelector(".sheet-sub")?.textContent).toBe("Chapter");
  });

  it("shows 'Whole manuscript' sub-header when initialScope='manuscript'", async () => {
    const store = new InMemorySceneDocStore();
    const tree = buildTree([], []);
    const { container } = render(
      <ExportOverlay
        projectId="proj-test"
        initialScope="manuscript"
        sceneId={null}
        chapterId={null}
        sceneDocStore={store}
        tree={tree}
        onClose={() => {}}
      />
    );
    expect(container.querySelector(".sheet-sub")?.textContent).toBe("Whole manuscript");
  });

  it("Markdown is selected by default", async () => {
    const { store, tree } = await makeMinimalFixture();
    render(
      <ExportOverlay
        projectId="proj-test"
        initialScope="scene"
        sceneId="s1"
        chapterId="f1"
        sceneDocStore={store}
        tree={tree}
        onClose={() => {}}
      />
    );
    expect(screen.getByRole("radio", { name: "Markdown (.md)" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Word (.docx)" })).not.toBeChecked();
    expect(screen.getByRole("radio", { name: "PDF" })).not.toBeChecked();
  });
});

describe("ExportOverlay — PDF format pick calls onSave with the right args", () => {
  it("picking PDF and clicking Export calls onSave with (title.pdf, Uint8Array, application/pdf)", async () => {
    const user = userEvent.setup();
    const { store, tree } = await makeMinimalFixture();
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();

    render(
      <ExportOverlay
        projectId="proj-test"
        initialScope="scene"
        sceneId="s1"
        chapterId="f1"
        sceneDocStore={store}
        tree={tree}
        onClose={onClose}
        onSave={onSave}
      />
    );

    await user.click(screen.getByRole("radio", { name: "PDF" }));
    await user.click(screen.getByRole("button", { name: "Export" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledOnce());

    const [filename, data, mime] = onSave.mock.calls[0] as [string, unknown, string];
    expect(filename).toBe("Scene One.pdf");
    expect(data).toBeInstanceOf(Uint8Array);
    expect(mime).toBe("application/pdf");
    expect(onClose).toHaveBeenCalledOnce();
  });
});

describe("ExportOverlay — Markdown format calls onSave with the right args", () => {
  it("default Markdown format calls onSave with (title.md, string, text/markdown)", async () => {
    const user = userEvent.setup();
    const { store, tree } = await makeMinimalFixture();
    const onSave = vi.fn().mockResolvedValue(undefined);

    render(
      <ExportOverlay
        projectId="proj-test"
        initialScope="scene"
        sceneId="s1"
        chapterId="f1"
        sceneDocStore={store}
        tree={tree}
        onClose={() => {}}
        onSave={onSave}
      />
    );

    // Markdown is the default — click Export immediately
    await user.click(screen.getByRole("button", { name: "Export" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledOnce());

    const [filename, data, mime] = onSave.mock.calls[0] as [string, unknown, string];
    expect(filename).toBe("Scene One.md");
    expect(typeof data).toBe("string");
    expect((data as string).startsWith("# Scene One")).toBe(true);
    expect(mime).toBe("text/markdown");
  });
});

describe("ExportOverlay — docx format calls onSave with the right args", () => {
  it("picking Word (.docx) calls onSave with (title.docx, Uint8Array, docx mime)", async () => {
    const user = userEvent.setup();
    const { store, tree } = await makeMinimalFixture();
    const onSave = vi.fn().mockResolvedValue(undefined);

    render(
      <ExportOverlay
        projectId="proj-test"
        initialScope="scene"
        sceneId="s1"
        chapterId="f1"
        sceneDocStore={store}
        tree={tree}
        onClose={() => {}}
        onSave={onSave}
      />
    );

    await user.click(screen.getByRole("radio", { name: "Word (.docx)" }));
    await user.click(screen.getByRole("button", { name: "Export" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledOnce());

    const [filename, data, mime] = onSave.mock.calls[0] as [string, unknown, string];
    expect(filename).toBe("Scene One.docx");
    expect(data).toBeInstanceOf(Uint8Array);
    expect(mime).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );
  });
});

describe("ExportOverlay — onSave omitted uses blobDownloadSave fallback", () => {
  it("omitting onSave routes the export through blobDownloadSave", async () => {
    const user = userEvent.setup();
    const { store, tree } = await makeMinimalFixture();
    const onClose = vi.fn();

    render(
      <ExportOverlay
        projectId="proj-test"
        initialScope="scene"
        sceneId="s1"
        chapterId="f1"
        sceneDocStore={store}
        tree={tree}
        onClose={onClose}
        // no onSave — fallback should engage
      />
    );

    await user.click(screen.getByRole("button", { name: "Export" }));

    await waitFor(() => expect(blobDownloadSave).toHaveBeenCalledOnce());

    const [filename, data, mime] = (blobDownloadSave as ReturnType<typeof vi.fn>).mock.calls[0] as [string, unknown, string];
    expect(filename).toBe("Scene One.md");
    expect(typeof data).toBe("string");
    expect((data as string).startsWith("# ")).toBe(true);
    expect(mime).toBe("text/markdown");
    expect(onClose).toHaveBeenCalledOnce();
  });
});

describe("ExportOverlay — chapter context scope gating and empty-content defense", () => {
  it("does NOT render the Scene option when opened in chapter context (sceneId=null)", async () => {
    const store = new InMemorySceneDocStore();
    const folder = makeFolder("f1", "Chapter One", 1000);
    const tree = buildTree([folder], []);
    const { container } = render(
      <ExportOverlay
        projectId="proj-test"
        initialScope="chapter"
        sceneId={null}
        chapterId="f1"
        sceneDocStore={store}
        tree={tree}
        onClose={() => {}}
      />
    );
    // "Scene" radio must be absent — the target id would be empty
    const radios = container.querySelectorAll('[role="radio"]');
    const labels = Array.from(radios).map((el) => el.textContent ?? "");
    expect(labels.some((l) => l.includes("Scene"))).toBe(false);
    // "Chapter" and "Whole manuscript" must be present
    expect(labels.some((l) => l.includes("Chapter"))).toBe(true);
    expect(labels.some((l) => l.includes("Whole manuscript"))).toBe(true);
  });

  it("does not call onSave and shows an error when the chapter has no scenes (empty content)", async () => {
    const user = userEvent.setup();
    const store = new InMemorySceneDocStore();
    const folder = makeFolder("f1", "Empty Chapter", 1000);
    // no scenes — collectBlocks will return []
    const tree = buildTree([folder], []);
    const onSave = vi.fn().mockResolvedValue(undefined);
    const { container } = render(
      <ExportOverlay
        projectId="proj-test"
        initialScope="chapter"
        sceneId={null}
        chapterId="f1"
        sceneDocStore={store}
        tree={tree}
        onClose={() => {}}
        onSave={onSave}
      />
    );

    await user.click(screen.getByRole("button", { name: "Export" }));

    await waitFor(() =>
      expect(container.querySelector("[role='alert']")).toBeInTheDocument()
    );
    expect(onSave).not.toHaveBeenCalled();
  });
});

describe("ExportOverlay — cancel / scrim close", () => {
  it("Cancel button calls onClose", async () => {
    const user = userEvent.setup();
    const { store, tree } = await makeMinimalFixture();
    const onClose = vi.fn();

    render(
      <ExportOverlay
        projectId="proj-test"
        initialScope="scene"
        sceneId="s1"
        chapterId="f1"
        sceneDocStore={store}
        tree={tree}
        onClose={onClose}
      />
    );

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("clicking the scrim (outside the sheet) calls onClose", async () => {
    const { store, tree } = await makeMinimalFixture();
    const onClose = vi.fn();

    const { container } = render(
      <ExportOverlay
        projectId="proj-test"
        initialScope="scene"
        sceneId="s1"
        chapterId="f1"
        sceneDocStore={store}
        tree={tree}
        onClose={onClose}
      />
    );

    const scrim = container.querySelector(".scrim") as HTMLElement;
    fireEvent.click(scrim);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("clicking inside the sheet does NOT call onClose (stopPropagation)", async () => {
    const { store, tree } = await makeMinimalFixture();
    const onClose = vi.fn();

    const { container } = render(
      <ExportOverlay
        projectId="proj-test"
        initialScope="scene"
        sceneId="s1"
        chapterId="f1"
        sceneDocStore={store}
        tree={tree}
        onClose={onClose}
      />
    );

    const sheet = container.querySelector(".sheet") as HTMLElement;
    fireEvent.click(sheet);
    expect(onClose).not.toHaveBeenCalled();
  });
});
