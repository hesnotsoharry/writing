// @vitest-environment jsdom
/**
 * The import test collection: real-world-shaped files, each with the chapters
 * and scenes it should produce using only the default guesses (no user changes).
 * When a real user's file imports badly, add a case shaped like it here.
 */
import { AlignmentType, Document, HeadingLevel, Packer, PageBreak, Paragraph, TextRun } from "docx";
import { describe, expect, it } from "vitest";

import type { OutlinePlan } from "../../features/import/outlinePlan";
import { buildPlan, defaultRoles, guessBodyMode } from "../../features/import/pipeline/buildPlan";
import { classifyFile } from "../../features/import/readImportFile";

type DocOpts = ConstructorParameters<typeof Document>[0];

async function docx(children: Paragraph[], extra: Partial<DocOpts> = {}): Promise<Uint8Array> {
  return new Uint8Array(await Packer.toBuffer(new Document({ sections: [{ children }], ...extra })));
}

async function importDefault(name: string, bytes: Uint8Array) {
  const c = await classifyFile(name, bytes);
  const mode = guessBodyMode(c);
  return { mode, plan: buildPlan(c, defaultRoles(c), mode) };
}

const tree = (plan: OutlinePlan) => plan.chapters.map((ch) => [ch.title, ch.scenes.map((s) => s.title)]);
const text = (s: string) => new TextEncoder().encode(s);
/** ~60 words of prose, so a file reads as a draft. */
const prose = (seed: string) => `${seed} ` + "The harbour lights flickered as the tide came in over the old stones and the gulls wheeled overhead, crying out against the wind that pushed the fishing boats hard against their moorings while Maren watched from the sea wall and wondered whether the letter in her pocket would change everything she knew. ".repeat(1);
const p = (t: string) => new Paragraph({ text: t });
const h = (t: string, heading: (typeof HeadingLevel)[keyof typeof HeadingLevel]) => new Paragraph({ text: t, heading });

describe("import collection — Word", () => {
  it("Heading 1/2 outline with notes → outline", async () => {
    const { mode, plan } = await importDefault("outline.docx", await docx([
      p("Working title: The Salt Road"),
      h("Chapter 1: The Tide", HeadingLevel.HEADING_1), p("Maren grows up on the island."),
      h("Opening", HeadingLevel.HEADING_2), p("Maren finds the letter."),
      h("The river", HeadingLevel.HEADING_2), p("Tomas arrives."),
      h("Chapter 2: Arrival", HeadingLevel.HEADING_1), h("Harbour", HeadingLevel.HEADING_2),
    ]));
    expect(mode).toBe("synopsis");
    expect(tree(plan)).toEqual([
      ["Chapter 1: The Tide", ["Chapter notes", "Opening", "The river"]],
      ["Chapter 2: Arrival", ["Harbour"]],
    ]);
    expect(plan.chapters[0].scenes[1].synopsis).toBe("Maren finds the letter.");
    expect(plan.notes).toMatchObject({ title: "Outline notes", synopsis: "Working title: The Salt Road" });
  });

  it("custom template chapter style + *** scene breaks → draft with numbered scenes", async () => {
    const styles = { paragraphStyles: [{ id: "ChapterTitle", name: "Chapter Title", basedOn: "Normal", paragraph: { outlineLevel: 0 } }] };
    const { mode, plan } = await importDefault("draft.docx", await docx([
      new Paragraph({ text: "The Tide", style: "ChapterTitle" }), p(prose("One.")), p(prose("Two.")),
      p("***"), p(prose("Three.")), p(prose("Four.")),
      new Paragraph({ text: "Arrival", style: "ChapterTitle" }), p(prose("Five.")), p(prose("Six.")),
    ], { styles }));
    expect(mode).toBe("scene");
    expect(tree(plan)).toEqual([["The Tide", ["Scene 1", "Scene 2"]], ["Arrival", ["Arrival"]]]);
    expect(plan.chapters[0].scenes[1].body).toHaveLength(2);
    expect(plan.chapters[0].scenes[1].synopsis).toBeNull();
  });

  it("hand-formatted CHAPTER ONE titles (bold, centred, larger) with no styles", async () => {
    const title = (t: string) => new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: t, bold: true, size: 32 })] });
    const { plan } = await importDefault("hand.docx", await docx([
      title("CHAPTER ONE"), p(prose("A.")), p(prose("B.")), title("CHAPTER TWO"), p(prose("C.")), p(prose("D.")),
    ]));
    expect(tree(plan)).toEqual([["CHAPTER ONE", ["CHAPTER ONE"]], ["CHAPTER TWO", ["CHAPTER TWO"]]]);
  });

  it("CHAPTER lines with bold scene titles under them → chapters and scenes", async () => {
    const title = (t: string) => new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: t, bold: true, size: 32 })] });
    const scene = (t: string) => new Paragraph({ children: [new TextRun({ text: t, bold: true })] });
    const { plan } = await importDefault("beats.docx", await docx([
      title("CHAPTER ONE"), scene("The letter"), p("Maren finds it."), scene("The sea wall"), p("She reads it."),
      title("CHAPTER TWO"), scene("Arrival"), p("Tomas comes."),
    ]));
    expect(tree(plan)).toEqual([["CHAPTER ONE", ["The letter", "The sea wall"]], ["CHAPTER TWO", ["Arrival"]]]);
    expect(plan.chapters[0].scenes[0].synopsis).toBe("Maren finds it.");
  });

  it("plain short titles that start a new page → chapters", async () => {
    const { plan } = await importDefault("pages.docx", await docx([
      p("The Tide"), p(prose("A.")), p(prose("B.")), new Paragraph({ children: [new PageBreak()] }),
      p("Arrival"), p(prose("C.")), p(prose("D.")), new Paragraph({ children: [new PageBreak()] }),
      p("The Storm"), p(prose("E.")),
    ]));
    expect(tree(plan)).toEqual([["The Tide", ["The Tide"]], ["Arrival", ["Arrival"]], ["The Storm", ["The Storm"]]]);
    expect(plan.notes).toBeNull();
  });

  it("nested bullets → chapters and scenes, deeper bullets → synopsis", async () => {
    const b = (t: string, level: number) => new Paragraph({ text: t, bullet: { level } });
    const { plan } = await importDefault("bullets.docx", await docx([
      b("Act One", 0), b("Maren finds the letter", 1), b("She reads it at night", 2), b("Act Two", 0), b("Tomas arrives", 1),
    ]));
    expect(tree(plan)).toEqual([["Act One", ["Maren finds the letter"]], ["Act Two", ["Tomas arrives"]]]);
    expect(plan.chapters[0].scenes[0].synopsis).toBe("    • She reads it at night");
  });

  it("a one-off bold sentence in prose is not a chapter", async () => {
    const { plan } = await importDefault("story.docx", await docx([
      p(prose("A.")), p(prose("B.")), p(prose("C.")),
      new Paragraph({ children: [new TextRun({ text: "He was gone", bold: true })] }),
      p(prose("D.")), p(prose("E.")), p(prose("F.")),
    ]));
    expect(tree(plan)).toEqual([["Imported", ["Imported"]]]);
    expect(plan.chapters[0].scenes[0].body).toHaveLength(7);
  });
});

describe("import collection — Markdown and text", () => {
  it("# / ## Markdown outline with bullets", async () => {
    const { plan } = await importDefault("outline.md", text("# The Salt Road\n\n## Opening\n- Maren finds the letter\n- Edda notices\n\n## The river\n\n# Arrival\n\n## Harbour\n"));
    expect(tree(plan)).toEqual([["The Salt Road", ["Opening", "The river"]], ["Arrival", ["Harbour"]]]);
    expect(plan.chapters[0].scenes[0].synopsis).toBe("• Maren finds the letter\n• Edda notices");
  });

  it("underlined (setext) Markdown headings", async () => {
    const { plan } = await importDefault("setext.md", text("Part One\n========\n\nOpening\n-------\n\nNotes here.\n"));
    expect(tree(plan)).toEqual([["Part One", ["Opening"]]]);
  });

  it("plain text 'Chapter 7' lines with * * * breaks and hard-wrapped prose", async () => {
    const wrapped = "The harbour lights flickered as the tide came in over the old stones\nand the gulls wheeled overhead, crying out against the wind that pushed\nthe fishing boats hard against their moorings while Maren watched on.";
    const body = `${wrapped}\n\n${wrapped}\n\n${wrapped}`;
    const { mode, plan } = await importDefault("novel.txt", text(`THE SALT ROAD\n\nChapter 1\n\n${body}\n\n* * *\n\n${body}\n\nChapter Two: Arrival\n\n${body}\n`));
    expect(mode).toBe("scene");
    expect(tree(plan)).toEqual([["Chapter 1", ["Scene 1", "Scene 2"]], ["Chapter Two: Arrival", ["Chapter Two: Arrival"]]]);
    expect(plan.chapters[0].scenes[0].body).toHaveLength(3);
    expect(plan.notes).toMatchObject({ title: "Front matter", body: ["THE SALT ROAD"] });
  });

  it("bare numbered chapters (1, 2, 3)", async () => {
    const { plan } = await importDefault("numbers.txt", text("1\n\nIt began.\n\n2\n\nIt went on.\n\n3\n\nIt ended.\n"));
    expect(tree(plan).map(([t]) => t)).toEqual(["1", "2", "3"]);
  });

  it("Part lines stay text when Chapter lines exist", async () => {
    const { plan } = await importDefault("parts.txt", text("Part One\n\nChapter 1\n\nA.\n\nChapter 2\n\nB.\n\nPart Two\n\nChapter 3\n\nC.\n"));
    expect(tree(plan).map(([t]) => t)).toEqual(["Chapter 1", "Chapter 2", "Chapter 3"]);
  });

  it("prose with no structure still imports, as one scene", async () => {
    const { plan } = await importDefault("story.txt", text("It was late.\n\nShe left.\n"));
    expect(tree(plan)).toEqual([["Imported", ["Imported"]]]);
  });
});
