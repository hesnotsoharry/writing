// @vitest-environment jsdom
/**
 * Outline import, end to end from real .docx bytes: the `docx` library (already
 * used for export) writes a Word file, mammoth reads it, planOutline maps it.
 */
import { Document, HeadingLevel, Packer, Paragraph } from "docx";
import { describe, expect, it } from "vitest";

import { InMemoryBinderStore } from "../db/binderStore";
import { applyOutlinePlan, OUTLINE_NOTES_TITLE, PartialImportError } from "../features/import/applyOutlinePlan";
import { CHAPTER_NOTES_TITLE, FALLBACK_CHAPTER_TITLE, OutlineImportError, planOutline } from "../features/import/outlinePlan";
import { planFromDocx } from "../features/import/readDocxOutline";

const h1 = (text: string) => new Paragraph({ text, heading: HeadingLevel.HEADING_1 });
const h2 = (text: string) => new Paragraph({ text, heading: HeadingLevel.HEADING_2 });
const h3 = (text: string) => new Paragraph({ text, heading: HeadingLevel.HEADING_3 });
const p = (text: string) => new Paragraph({ text });
const bullet = (text: string, level = 0) => new Paragraph({ text, bullet: { level } });

async function docxBytes(children: Paragraph[]): Promise<Uint8Array> {
  const doc = new Document({ sections: [{ children }] });
  return new Uint8Array(await Packer.toBuffer(doc));
}

describe("planFromDocx — Word headings", () => {
  it("maps Heading 1 → chapters, Heading 2 → scenes, body → synopsis", async () => {
    const plan = await planFromDocx(await docxBytes([
      p("Working title: The Salt Road"),
      h1("Chapter 1: The Tide"),
      p("Maren grows up on the island."),
      h2("Opening"), p("Maren finds the letter."), p("She hides it from Edda."),
      h2("The river"), h3("Beat"), p("Tomas arrives."),
      h1("Chapter 2: Arrival"),
      h2("Harbour"),
    ]));
    expect(plan.source).toBe("headings");
    expect(plan.notes).toBe("Working title: The Salt Road");
    expect(plan.chapters).toEqual([
      { title: "Chapter 1: The Tide", scenes: [
        { title: CHAPTER_NOTES_TITLE, synopsis: "Maren grows up on the island." },
        { title: "Opening", synopsis: "Maren finds the letter.\nShe hides it from Edda." },
        { title: "The river", synopsis: "Beat\nTomas arrives." },
      ] },
      { title: "Chapter 2: Arrival", scenes: [{ title: "Harbour", synopsis: null }] },
    ]);
  });

  it("uses only one heading level as chapters, each with one scene holding its text", async () => {
    const plan = await planFromDocx(await docxBytes([
      h1("Chapter 1"), p("The storm hits."), h1("Chapter 2"),
    ]));
    expect(plan.chapters).toEqual([
      { title: "Chapter 1", scenes: [{ title: "Chapter 1", synopsis: "The storm hits." }] },
      { title: "Chapter 2", scenes: [] },
    ]);
  });

  it("puts scene headings that come before any chapter heading into a fallback chapter", () => {
    const plan = planOutline("<h2>Prologue</h2><p>Night.</p><h1>Part One</h1><h2>Morning</h2>");
    expect(plan.chapters.map((c) => c.title)).toEqual([FALLBACK_CHAPTER_TITLE, "Part One"]);
    expect(plan.chapters[0].scenes).toEqual([{ title: "Prologue", synopsis: "Night." }]);
  });
});

describe("planFromDocx — bulleted outline (no headings)", () => {
  it("maps top bullets → chapters, indented → scenes, deeper → synopsis", async () => {
    const plan = await planFromDocx(await docxBytes([
      bullet("Act One"), bullet("Maren finds the letter", 1), bullet("She reads it at night", 2),
      bullet("Act Two"), bullet("Tomas arrives", 1),
    ]));
    expect(plan.source).toBe("lists");
    expect(plan.chapters).toEqual([
      { title: "Act One", scenes: [{ title: "Maren finds the letter", synopsis: "• She reads it at night" }] },
      { title: "Act Two", scenes: [{ title: "Tomas arrives", synopsis: null }] },
    ]);
  });

  it("makes a flat list one chapter of scenes", () => {
    const plan = planOutline("<ul><li>Storm</li><li>Shipwreck</li></ul>");
    expect(plan.chapters).toEqual([{ title: FALLBACK_CHAPTER_TITLE, scenes: [
      { title: "Storm", synopsis: null }, { title: "Shipwreck", synopsis: null },
    ] }]);
  });
});

describe("planFromDocx — refusals", () => {
  it("explains how to mark up a document with no headings or lists", async () => {
    await expect(planFromDocx(await docxBytes([p("Just prose."), p("More prose.")])))
      .rejects.toThrow(/Heading 1/);
  });

  it("rejects a file that isn't a .docx", async () => {
    await expect(planFromDocx(new TextEncoder().encode("not a zip"))).rejects.toBeInstanceOf(OutlineImportError);
  });

  it("refuses an outline that would create more than 1000 scenes", () => {
    const html = "<h1>Ch</h1>" + "<h2>S</h2>".repeat(1001);
    expect(() => planOutline(html)).toThrow(/more than 1000 scenes/);
  });
});

describe("applyOutlinePlan", () => {
  const plan = planOutline("<p>Notes</p><h1>One</h1><h2>A</h2><p>Syn A</p><h2>B</h2><h1>Two</h1><h2>C</h2>");

  it("appends chapters and outline-status scenes in order, plus a notes short piece", async () => {
    const store = new InMemoryBinderStore();
    const projectId = await store.createProject({ title: "P", type: "novel" });
    await store.createFolder({ projectId, title: "Existing" });
    const result = await applyOutlinePlan(store, projectId, plan);
    expect(result).toEqual({ chapters: 2, scenes: 4 });
    const { folders, scenes } = await store.loadProject(projectId);
    expect(folders.map((f) => f.title)).toEqual(["Existing", "One", "Two"]);
    const one = folders.find((f) => f.title === "One")!;
    const inOne = scenes.filter((s) => s.folder_id === one.id).sort((a, b) => a.sort_order - b.sort_order);
    expect(inOne.map((s) => [s.title, s.synopsis, s.status])).toEqual([["A", "Syn A", "outline"], ["B", null, "outline"]]);
    const notes = scenes.find((s) => s.folder_id === null);
    expect([notes?.title, notes?.synopsis]).toEqual([OUTLINE_NOTES_TITLE, "Notes"]);
  });

  it("reports how much was created when a write fails part-way", async () => {
    const store = new InMemoryBinderStore();
    const projectId = await store.createProject({ title: "P", type: "novel" });
    let calls = 0;
    const flaky = Object.assign(Object.create(store) as InMemoryBinderStore, {
      createScene: (a: Parameters<InMemoryBinderStore["createScene"]>[0]) => {
        calls += 1; if (calls === 2) return Promise.reject(new Error("disk full"));
        return store.createScene(a);
      },
    });
    const err = await applyOutlinePlan(flaky, projectId, plan).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(PartialImportError);
    expect((err as PartialImportError).created).toEqual({ chapters: 1, scenes: 1 });
  });
});
