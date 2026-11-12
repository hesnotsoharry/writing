// @vitest-environment jsdom
/**
 * Import pipeline seams: the classifier's default guesses, the plan builder's
 * naming rules and user role changes, the text reader, and writing a plan
 * (outline or draft) into the binder. Whole-file behaviour lives in
 * import/corpus.test.ts.
 */
import { afterEach, describe, expect, it } from "vitest";

import { InMemoryBinderStore } from "../db/binderStore";
import { InMemorySceneDocStore } from "../db/sceneDocStore";
import { ensureDailyBaselineScoped, excludeImportedWords, readDailyWordsScoped } from "../features/goals/goalModel";
import { applyOutlinePlan, importIntoNewProject, PartialImportError } from "../features/import/applyOutlinePlan";
import { CHAPTER_NOTES_TITLE, FALLBACK_CHAPTER_TITLE, type OutlinePlan, planProblem } from "../features/import/outlinePlan";
import { buildPlan, defaultRoles, guessBodyMode } from "../features/import/pipeline/buildPlan";
import { classify } from "../features/import/pipeline/classify";
import { plainLine } from "../features/import/pipeline/importLine";
import { textToLines } from "../features/import/pipeline/readTextLines";

const md = (source: string) => classify(textToLines(source));
const roleOf = (source: string) => Object.fromEntries(md(source).groups.map((g) => [g.key, g.role]));
const outline = (source: string) => { const c = md(source); return buildPlan(c, defaultRoles(c), "synopsis"); };
const titles = (plan: OutlinePlan) => plan.chapters.map((ch) => [ch.title, ch.scenes.map((s) => s.title)]);

describe("classify — default guesses", () => {
  it("top heading level → chapter, next used level → scene", () => {
    expect(roleOf("## A\n\n#### B\n\n## C\n")).toEqual({ "level:2": "chapter", "level:4": "scene" });
  });

  it("'Chapter N' and bare numbers are chapters; 'Part' lines stay text beside them", () => {
    expect(roleOf("Part One\n\nChapter 1\n\nx\n\n2\n\ny\n")).toMatchObject({
      "pattern:chapter": "chapter", "pattern:number": "chapter", "pattern:part": "text",
    });
  });

  it("a look seen only once is not a chapter", () => {
    const c = classify([plainLine("Title", { bold: true }), plainLine("Some prose here.")]);
    expect(c.groups.map((g) => [g.key, g.role])).toEqual([["look:bold", "text"]]);
  });

  it("strongest repeated look → chapter, a more frequent weaker look after it → scene", () => {
    const big = (t: string) => plainLine(t, { bold: true, relSize: 1.5 });
    const bold = (t: string) => plainLine(t, { bold: true });
    const c = classify([big("The Tide"), bold("Dawn"), bold("Dusk"), big("Arrival"), bold("Night")]);
    expect(Object.fromEntries(c.groups.map((g) => [g.key, g.role]))).toEqual({ "look:large+bold": "chapter", "look:bold": "scene" });
  });

  it("a flat list becomes scenes; scene breaks split", () => {
    expect(roleOf("- a\n- b\n\n***\n")).toEqual({ "list:0": "scene", break: "split" });
  });

  it("sentences are never titles", () => {
    expect(md("Chapter 1 was the hardest part, she said.\n").groups).toEqual([]);
  });
});

describe("buildPlan — naming and placement", () => {
  it("names untitled text before titled scenes 'Chapter notes' in an outline", () => {
    expect(titles(outline("# One\n\nIntro.\n\n## A\n\n## B\n"))).toEqual([["One", [CHAPTER_NOTES_TITLE, "A", "B"]]]);
  });

  it("puts scenes that come before any chapter into a fallback chapter", () => {
    const plan = outline("Notes first.\n\n## Prologue\n\nNight.\n\n# Part One\n\n## Morning\n");
    expect(titles(plan)).toEqual([[FALLBACK_CHAPTER_TITLE, ["Prologue"]], ["Part One", ["Morning"]]]);
    expect(plan.notes).toMatchObject({ synopsis: "Notes first." });
  });

  it("keeps a chapter with no scenes empty", () => {
    expect(titles(outline("# One\n\n## A\n\n# Two\n"))).toEqual([["One", ["A"]], ["Two", []]]);
  });

  it("follows the user's role changes", () => {
    const c = md("# One\n\n## A\n\n## B\n");
    expect(titles(buildPlan(c, { ...defaultRoles(c), "level:2": "chapter" }, "synopsis")))
      .toEqual([["One", []], ["A", []], ["B", []]]);
    expect(titles(buildPlan(c, { ...defaultRoles(c), "level:2": "text" }, "synopsis"))).toEqual([["One", ["One"]]]);
  });

  it("draft mode puts text in the scene as paragraphs, not the synopsis", () => {
    const c = md("# One\n\nFirst paragraph.\n\nSecond paragraph.\n");
    expect(buildPlan(c, defaultRoles(c), "scene").chapters[0].scenes[0])
      .toEqual({ title: "One", synopsis: null, body: ["First paragraph.", "Second paragraph."] });
  });

  it("guesses draft only for long prose paragraphs", () => {
    const para = "word ".repeat(80).trim();
    expect(guessBodyMode(md(`# One\n\n${para}\n\n${para}\n\n${para}\n\n${para}\n`))).toBe("scene");
    expect(guessBodyMode(md("# One\n\nShort note.\n\nAnother.\n"))).toBe("synopsis");
  });

  it("flags plans that are empty or too big", () => {
    expect(planProblem({ chapters: [], notes: null })).toMatch(/Nothing/i);
    expect(planProblem(outline("# Ch\n\n" + "## S\n\n".repeat(1001)))).toMatch(/1000 scenes/);
  });
});

describe("readTextLines", () => {
  it("joins hard-wrapped prose lines into one paragraph", () => {
    const wrapped = "a line that runs on for a good long while and only then\nwraps onto the next one like plain text files do";
    expect(textToLines(wrapped).map((l) => l.text)).toEqual([wrapped.replace("\n", " ")]);
  });

  it("reads bold-only lines and indented short lines as looks, and strips inline marks", () => {
    const lines = textToLines("**The Tide**\n\n                    ARRIVAL\n\nShe *ran* to `the` [shore](x).\n");
    expect(lines.map((l) => [l.text, l.bold, l.centered])).toEqual([
      ["The Tide", true, false], ["ARRIVAL", false, true], ["She ran to the shore.", false, false],
    ]);
  });

  it("nests list items by indent", () => {
    expect(textToLines("- a\n  - b\n    - c\n").map((l) => l.listLevel)).toEqual([0, 1, 2]);
  });
});

async function setup() {
  const binder = new InMemoryBinderStore();
  const docs = new InMemorySceneDocStore();
  const projectId = await binder.createProject({ title: "P", type: "novel" });
  return { binder, docs, projectId };
}

describe("applyOutlinePlan", () => {
  const plan = outline("Notes\n\n# One\n\n## A\n\nSyn A\n\n## B\n\n# Two\n\n## C\n");

  it("appends chapters and outline-status scenes in order, plus a notes short piece", async () => {
    const { binder, docs, projectId } = await setup();
    await binder.createFolder({ projectId, title: "Existing" });
    expect(await applyOutlinePlan({ binder, docs }, projectId, plan)).toEqual({ chapters: 2, scenes: 4, words: 0 });
    const { folders, scenes } = await binder.loadProject(projectId);
    expect(folders.map((f) => f.title)).toEqual(["Existing", "One", "Two"]);
    const one = folders.find((f) => f.title === "One")!;
    const inOne = scenes.filter((s) => s.folder_id === one.id).sort((a, b) => a.sort_order - b.sort_order);
    expect(inOne.map((s) => [s.title, s.synopsis, s.status])).toEqual([["A", "Syn A", "outline"], ["B", null, "outline"]]);
    expect(scenes.find((s) => s.folder_id === null)).toMatchObject({ title: "Outline notes", synopsis: "Notes" });
    expect(docs.saveCount).toBe(0);
  });

  it("writes a draft's text into each scene with its word count and draft status", async () => {
    const { binder, docs, projectId } = await setup();
    const c = md("# One\n\nThe tide came in.\n\nShe ran.\n");
    const result = await applyOutlinePlan({ binder, docs }, projectId, buildPlan(c, defaultRoles(c), "scene"));
    expect(result).toEqual({ chapters: 1, scenes: 1, words: 6 });
    const [scene] = (await binder.loadProject(projectId)).scenes;
    expect([scene.status, scene.word_count, scene.synopsis]).toEqual(["draft", 6, null]);
    expect(await docs.loadProjection(scene.id)).toBe("The tide came in.\nShe ran.");
    expect(await docs.load(scene.id)).toBeTruthy();
  });

  it("reports how much was created when a write fails part-way", async () => {
    const { binder, docs, projectId } = await setup();
    let calls = 0;
    const flaky = Object.assign(Object.create(binder) as InMemoryBinderStore, {
      createScene: (a: Parameters<InMemoryBinderStore["createScene"]>[0]) => {
        calls += 1; if (calls === 2) return Promise.reject(new Error("disk full"));
        return binder.createScene(a);
      },
    });
    const err = await applyOutlinePlan({ binder: flaky, docs }, projectId, plan).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(PartialImportError);
    expect((err as PartialImportError).created).toEqual({ chapters: 1, scenes: 1, words: 0 });
  });
});

describe("importIntoNewProject", () => {
  const plan = outline("# One\n\n## A\n\n# Two\n\n## B\n");

  it("creates a titled novel, fills it, then hands its id over", async () => {
    const { binder, docs, projectId: existing } = await setup();
    const after: string[] = [];
    const result = await importIntoNewProject({ binder, docs }, plan, "  The Salt Road ", (id) => { after.push(id); return Promise.resolve(); });
    expect(result).toEqual({ chapters: 2, scenes: 2, words: 0 });
    const created = (await binder.listProjects()).find((pr) => pr.id !== existing)!;
    expect([created.title, created.type, after]).toEqual(["The Salt Road", "novel", [created.id]]);
    expect((await binder.loadProject(created.id)).folders.map((f) => f.title)).toEqual(["One", "Two"]);
    expect((await binder.loadProject(existing)).folders).toEqual([]);
  });

  it("still hands the new project over when the import stops part-way", async () => {
    const { binder, docs } = await setup();
    const flaky = Object.assign(Object.create(binder) as InMemoryBinderStore, {
      createFolder: () => Promise.reject(new Error("disk full")),
    });
    const after: string[] = [];
    await expect(importIntoNewProject({ binder: flaky, docs }, plan, "Book", (id) => { after.push(id); return Promise.resolve(); }))
      .rejects.toBeInstanceOf(PartialImportError);
    expect(after).toHaveLength(1);
  });
});

describe("excludeImportedWords", () => {
  afterEach(() => localStorage.clear());

  it("imported words don't count toward today's goal", () => {
    const key = { projectId: "p1", scope: "manuscript", targetId: null } as const;
    ensureDailyBaselineScoped(key, 100);
    excludeImportedWords("p1", 2500);
    expect(readDailyWordsScoped(key, 2650)).toBe(50);
  });

  it("does nothing before today's baseline exists", () => {
    excludeImportedWords("p1", 2500);
    expect(localStorage.length).toBe(0);
  });
});
