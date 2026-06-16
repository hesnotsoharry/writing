import { describe, expect, it } from "vitest";
import * as Y from "yjs";

import { runMigrations } from "../db/migrations";
import type { DbHandle } from "../db/schema";
import {
  sqliteGetManuscriptAbout,
  sqliteGetSceneText,
} from "../db/sqliteAiContextStore";
import { EMPTY_ABOUT } from "../features/ai/ai.types";
import { encodeDoc } from "../yjs/serialize";
import { makeSqlJsDb } from "./support/sqljsDb";

const PROJECT = "proj-ai-context-1";
const OTHER_PROJECT = "proj-ai-context-2";

async function freshDb(): Promise<DbHandle & { close(): void }> {
  const db = await makeSqlJsDb();
  await runMigrations(db);
  // Projects must exist (FK targets).
  await db.execute(
    "INSERT INTO projects (id, title, type, sort_order, created_at, updated_at) VALUES (?,?,?,?,?,?)",
    [PROJECT, "Test Project", "novel", 0, Date.now(), Date.now()],
  );
  await db.execute(
    "INSERT INTO projects (id, title, type, sort_order, created_at, updated_at) VALUES (?,?,?,?,?,?)",
    [OTHER_PROJECT, "Other Project", "novel", 1, Date.now(), Date.now()],
  );
  return db;
}

describe("sqliteGetManuscriptAbout", () => {
  it("returns EMPTY_ABOUT when no row exists for the project", async () => {
    const db = await freshDb();
    try {
      const result = await sqliteGetManuscriptAbout(db, PROJECT);
      expect(result).toEqual(EMPTY_ABOUT);
      expect(result).toEqual({
        synopsis: "",
        genre: "",
        tone: "",
        pov: "",
        notes: "",
      });
    } finally {
      db.close();
    }
  });

  it("returns the persisted row's fields when one exists", async () => {
    const db = await freshDb();
    try {
      // Insert a manuscript_about row.
      await db.execute(
        "INSERT INTO manuscript_about (project_id, synopsis, genre, tone, pov, notes) VALUES (?,?,?,?,?,?)",
        [PROJECT, "A tale of mystery", "fantasy", "introspective", "first person", "High stakes"],
      );

      const result = await sqliteGetManuscriptAbout(db, PROJECT);
      expect(result).toEqual({
        synopsis: "A tale of mystery",
        genre: "fantasy",
        tone: "introspective",
        pov: "first person",
        notes: "High stakes",
      });
    } finally {
      db.close();
    }
  });

  it("converts null columns to empty strings", async () => {
    const db = await freshDb();
    try {
      // Insert with nulls (the schema allows TEXT without NOT NULL).
      await db.execute(
        "INSERT INTO manuscript_about (project_id, synopsis, genre, tone, pov, notes) VALUES (?,?,?,?,?,?)",
        [PROJECT, "Summary", null, "dark", null, "Notes here"],
      );

      const result = await sqliteGetManuscriptAbout(db, PROJECT);
      expect(result.synopsis).toBe("Summary");
      expect(result.genre).toBe("");
      expect(result.tone).toBe("dark");
      expect(result.pov).toBe("");
      expect(result.notes).toBe("Notes here");
    } finally {
      db.close();
    }
  });

  it("scopes to the requested project", async () => {
    const db = await freshDb();
    try {
      await db.execute(
        "INSERT INTO manuscript_about (project_id, synopsis, genre, tone, pov, notes) VALUES (?,?,?,?,?,?)",
        [PROJECT, "First project", "sci-fi", "hopeful", "third person", ""],
      );
      await db.execute(
        "INSERT INTO manuscript_about (project_id, synopsis, genre, tone, pov, notes) VALUES (?,?,?,?,?,?)",
        [OTHER_PROJECT, "Other project", "romance", "light", "omniscient", ""],
      );

      const result = await sqliteGetManuscriptAbout(db, PROJECT);
      expect(result.synopsis).toBe("First project");
      expect(result.genre).toBe("sci-fi");
    } finally {
      db.close();
    }
  });
});

describe("sqliteGetSceneText", () => {
  it("returns null when the scene does not exist", async () => {
    const db = await freshDb();
    try {
      const result = await sqliteGetSceneText(db, "nonexistent-scene-id");
      expect(result).toBeNull();
    } finally {
      db.close();
    }
  });

  it("returns { title, text: '' } when scene exists but has no scene_docs row", async () => {
    const db = await freshDb();
    try {
      // Insert a scene without a corresponding scene_docs row.
      const sceneId = "scene-no-doc";
      await db.execute(
        "INSERT INTO scenes (id, project_id, folder_id, title, synopsis, sort_order, word_count) VALUES (?,?,?,?,?,?,?)",
        [sceneId, PROJECT, null, "Scene Without Doc", null, 0, 0],
      );

      const result = await sqliteGetSceneText(db, sceneId);
      expect(result).toEqual({ title: "Scene Without Doc", text: "" });
    } finally {
      db.close();
    }
  });

  it("returns { title, text } after decoding scene_docs state_base64", async () => {
    const db = await freshDb();
    try {
      const sceneId = "scene-with-content";
      const sceneTitle = "Opening Chapter";

      // Create a Y.Doc with some content (TipTap-style XmlFragment).
      const doc = new Y.Doc();
      const fragment = doc.getXmlFragment("content");
      const para = new Y.XmlElement("p");
      const text = new Y.XmlText();
      text.insert(0, "The morning light crept through the window.");
      para.push([text]);
      fragment.push([para]);

      // Encode the doc to base64.
      const stateBase64 = encodeDoc(doc);

      // Insert scene and scene_docs.
      await db.execute(
        "INSERT INTO scenes (id, project_id, folder_id, title, synopsis, sort_order, word_count) VALUES (?,?,?,?,?,?,?)",
        [sceneId, PROJECT, null, sceneTitle, null, 0, 0],
      );
      await db.execute(
        "INSERT INTO scene_docs (scene_id, state_base64) VALUES (?,?)",
        [sceneId, stateBase64],
      );

      const result = await sqliteGetSceneText(db, sceneId);
      expect(result).not.toBeNull();
      expect(result?.title).toBe(sceneTitle);
      expect(result?.text).toBe("The morning light crept through the window.");
    } finally {
      db.close();
    }
  });

  it("handles multiple block elements (paragraphs) with newline joining", async () => {
    const db = await freshDb();
    try {
      const sceneId = "scene-multi-block";
      const sceneTitle = "Multi-block Scene";

      // Create a Y.Doc with multiple paragraphs.
      const doc = new Y.Doc();
      const fragment = doc.getXmlFragment("content");

      const para1 = new Y.XmlElement("p");
      const text1 = new Y.XmlText();
      text1.insert(0, "First paragraph.");
      para1.push([text1]);

      const para2 = new Y.XmlElement("p");
      const text2 = new Y.XmlText();
      text2.insert(0, "Second paragraph.");
      para2.push([text2]);

      fragment.push([para1, para2]);

      const stateBase64 = encodeDoc(doc);

      await db.execute(
        "INSERT INTO scenes (id, project_id, folder_id, title, synopsis, sort_order, word_count) VALUES (?,?,?,?,?,?,?)",
        [sceneId, PROJECT, null, sceneTitle, null, 0, 0],
      );
      await db.execute(
        "INSERT INTO scene_docs (scene_id, state_base64) VALUES (?,?)",
        [sceneId, stateBase64],
      );

      const result = await sqliteGetSceneText(db, sceneId);
      expect(result?.text).toBe("First paragraph.\nSecond paragraph.");
    } finally {
      db.close();
    }
  });

  it("extracts plain text from nested XmlElements", async () => {
    const db = await freshDb();
    try {
      const sceneId = "scene-nested";
      const sceneTitle = "Nested Elements Scene";

      // Create a Y.Doc with nested structure (e.g., list items).
      const doc = new Y.Doc();
      const fragment = doc.getXmlFragment("content");

      const ul = new Y.XmlElement("ul");
      const li1 = new Y.XmlElement("li");
      const text1 = new Y.XmlText();
      text1.insert(0, "First item");
      li1.push([text1]);

      const li2 = new Y.XmlElement("li");
      const text2 = new Y.XmlText();
      text2.insert(0, "Second item");
      li2.push([text2]);

      ul.push([li1, li2]);
      fragment.push([ul]);

      const stateBase64 = encodeDoc(doc);

      await db.execute(
        "INSERT INTO scenes (id, project_id, folder_id, title, synopsis, sort_order, word_count) VALUES (?,?,?,?,?,?,?)",
        [sceneId, PROJECT, null, sceneTitle, null, 0, 0],
      );
      await db.execute(
        "INSERT INTO scene_docs (scene_id, state_base64) VALUES (?,?)",
        [sceneId, stateBase64],
      );

      const result = await sqliteGetSceneText(db, sceneId);
      expect(result?.text).toBe("First itemSecond item");
    } finally {
      db.close();
    }
  });

  it("redacts aiExclude-marked runs via extractAiSafeText — placeholder present, raw marked text absent", async () => {
    const db = await freshDb();
    try {
      const sceneId = "scene-ai-exclude";
      const sceneTitle = "Redaction Scene";

      // Build a Yjs doc with a marked run using insert+format (TipTap-style).
      const doc = new Y.Doc();
      const fragment = doc.getXmlFragment("content");
      doc.transact(() => {
        const para = new Y.XmlElement("p");
        const xt = new Y.XmlText();
        para.push([xt]);
        fragment.push([para]);
        xt.insert(0, "Safe text. Hidden passage. More safe text.", undefined);
        xt.format(11, 15, { aiExclude: true }); // "Hidden passage." (15 chars at pos 11)
      });

      const stateBase64 = encodeDoc(doc);
      await db.execute(
        "INSERT INTO scenes (id, project_id, folder_id, title, synopsis, sort_order, word_count) VALUES (?,?,?,?,?,?,?)",
        [sceneId, PROJECT, null, sceneTitle, null, 0, 0],
      );
      await db.execute(
        "INSERT INTO scene_docs (scene_id, state_base64) VALUES (?,?)",
        [sceneId, stateBase64],
      );

      const result = await sqliteGetSceneText(db, sceneId);
      expect(result).not.toBeNull();
      expect(result?.text).toContain("[passage hidden by author]");
      expect(result?.text).toContain("Safe text.");
      expect(result?.text).toContain("More safe text.");
      expect(result?.text).not.toContain("Hidden passage.");
    } finally {
      db.close();
    }
  });

  it("returns empty text for a doc with no content in the fragment", async () => {
    const db = await freshDb();
    try {
      const sceneId = "scene-empty-doc";
      const sceneTitle = "Empty Doc Scene";

      // Create a Y.Doc with an empty content fragment.
      const doc = new Y.Doc();
      doc.getXmlFragment("content"); // Access but don't populate.
      const stateBase64 = encodeDoc(doc);

      await db.execute(
        "INSERT INTO scenes (id, project_id, folder_id, title, synopsis, sort_order, word_count) VALUES (?,?,?,?,?,?,?)",
        [sceneId, PROJECT, null, sceneTitle, null, 0, 0],
      );
      await db.execute(
        "INSERT INTO scene_docs (scene_id, state_base64) VALUES (?,?)",
        [sceneId, stateBase64],
      );

      const result = await sqliteGetSceneText(db, sceneId);
      expect(result?.title).toBe(sceneTitle);
      expect(result?.text).toBe("");
    } finally {
      db.close();
    }
  });
});
