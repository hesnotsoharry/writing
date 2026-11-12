// @vitest-environment jsdom
/**
 * The .docx reader keeps every clue the classifier needs: heading and custom
 * outline styles, hand formatting, lists, page breaks and scene-break markers.
 * Fixtures are real .docx bytes written by the `docx` library.
 */
import { AlignmentType, Document, HeadingLevel, Packer, PageBreak, Paragraph, TextRun } from "docx";
import { describe, expect, it } from "vitest";

import { OutlineImportError } from "../../features/import/outlinePlan";
import type { ImportLine } from "../../features/import/pipeline/importLine";
import { readDocxLines } from "../../features/import/pipeline/readDocxLines";

type DocOpts = ConstructorParameters<typeof Document>[0];

async function lines(children: Paragraph[], extra: Partial<DocOpts> = {}): Promise<ImportLine[]> {
  const doc = new Document({ sections: [{ children }], ...extra });
  return readDocxLines(new Uint8Array(await Packer.toBuffer(doc)));
}

const pick = (l: ImportLine, keys: (keyof ImportLine)[]) => Object.fromEntries(keys.map((k) => [k, l[k]]));

describe("readDocxLines", () => {
  it("reads Heading 1/2 levels and plain body text", async () => {
    const got = await lines([
      new Paragraph({ text: "Chapter One", heading: HeadingLevel.HEADING_1 }),
      new Paragraph({ text: "The storm", heading: HeadingLevel.HEADING_2 }),
      new Paragraph({ text: "Rain hits the harbour." }),
    ]);
    expect(got.map((l) => [l.text, l.level])).toEqual([["Chapter One", 1], ["The storm", 2], ["Rain hits the harbour.", null]]);
    expect(got[2]).toMatchObject({ bold: false, relSize: 1, listLevel: null, sceneBreak: false });
  });

  it("treats a custom style with an outline level as a heading, and keeps its name", async () => {
    const got = await lines([new Paragraph({ text: "The Tide", style: "ChapterTitle" })], {
      styles: { paragraphStyles: [{ id: "ChapterTitle", name: "Chapter Title", basedOn: "Normal",
        paragraph: { outlineLevel: 0 }, run: { bold: true, size: 36 } }] },
    });
    expect(pick(got[0], ["text", "style", "level", "bold"])).toEqual({ text: "The Tide", style: "Chapter Title", level: 1, bold: true });
    expect(got[0].relSize).toBeGreaterThan(1.4);
  });

  it("captures hand-formatted titles: bold, larger, centred, capitals", async () => {
    const got = await lines([
      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "CHAPTER SEVEN", bold: true, size: 32 })] }),
      new Paragraph({ children: [new TextRun({ text: "Some ", bold: true }), new TextRun("mixed text")] }),
    ]);
    expect(pick(got[0], ["level", "bold", "caps", "centered"])).toEqual({ level: null, bold: true, caps: true, centered: true });
    expect(got[0].relSize).toBeGreaterThan(1.3);
    expect(got[1].bold).toBe(false);
  });

  it("records list nesting", async () => {
    const got = await lines([
      new Paragraph({ text: "Act One", bullet: { level: 0 } }),
      new Paragraph({ text: "Maren finds the letter", bullet: { level: 1 } }),
    ]);
    expect(got.map((l) => l.listLevel)).toEqual([0, 1]);
  });

  it("carries page breaks onto the next line with text", async () => {
    const got = await lines([
      new Paragraph({ text: "End of chapter one." }),
      new Paragraph({ children: [new PageBreak()] }),
      new Paragraph({ text: "Chapter Two" }),
      new Paragraph({ text: "Starts fresh", pageBreakBefore: true }),
      new Paragraph({ text: "Same page" }),
    ]);
    expect(got.map((l) => [l.text, l.pageBreakBefore])).toEqual([
      ["End of chapter one.", false], ["Chapter Two", true], ["Starts fresh", true], ["Same page", false],
    ]);
  });

  it("marks scene-break lines and drops empty paragraphs", async () => {
    const got = await lines([
      new Paragraph({ text: "Before." }), new Paragraph({ text: "" }),
      new Paragraph({ text: "* * *" }), new Paragraph({ text: "#" }), new Paragraph({ text: "After." }),
    ]);
    expect(got.map((l) => [l.text, l.sceneBreak])).toEqual([["Before.", false], ["* * *", true], ["#", true], ["After.", false]]);
  });

  it("rejects bytes that aren't a .docx", async () => {
    await expect(readDocxLines(new TextEncoder().encode("plain text"))).rejects.toBeInstanceOf(OutlineImportError);
  });
});
