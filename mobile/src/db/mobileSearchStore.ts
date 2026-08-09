import type { DbClient } from "../shared/dbClient";

export interface MobileSearchMatch {
  domain: "manuscript" | "bible" | "note";
  id: string;
  title: string;
  subtitle: string;
  text: string;
  offsets: number[];
}
export interface MobileSearchOptions { caseSensitive?: boolean; wholeWord?: boolean }

function collectOffsets(text: string, query: string, options?: MobileSearchOptions): number[] {
  if (!query) return [];
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const source = options?.wholeWord
    ? `(?<![\\p{L}\\p{N}_])${escaped}(?![\\p{L}\\p{N}_])`
    : escaped;
  const regex = new RegExp(source, options?.caseSensitive ? "gu" : "giu");
  return [...text.matchAll(regex)].map((match) => match.index);
}

export class MobileSearchStore {
  constructor(private readonly db: DbClient) {}

  async searchManuscript(projectId: string, query: string, options?: MobileSearchOptions): Promise<MobileSearchMatch[]> {
    if (query.length < 2) return [];
    const rows = await this.db.select<Array<{
      id: string; title: string; folder_title: string | null; plaintext_projection: string | null;
    }>>(
      `SELECT s.id, s.title, f.title AS folder_title, sd.plaintext_projection
       FROM scenes s LEFT JOIN folders f ON f.id = s.folder_id
       LEFT JOIN scene_docs sd ON sd.scene_id = s.id
       WHERE s.project_id = ? ORDER BY s.sort_order`, [projectId],
    );
    return rows.flatMap((row) => {
      const text = row.plaintext_projection ?? "";
      const offsets = collectOffsets(text, query, options);
      return offsets.length === 0 ? [] : [{
        domain: "manuscript" as const, id: row.id, title: row.title,
        subtitle: row.folder_title ?? "Short pieces", text, offsets,
      }];
    });
  }

  async searchBible(projectId: string, query: string, options?: MobileSearchOptions): Promise<MobileSearchMatch[]> {
    if (query.length < 2) return [];
    const rows = await this.db.select<Array<{ id: string; type: string; name: string; text: string }>>(
      `WITH bible AS (
         SELECT id, 'character' AS type, name, COALESCE(notes, '') || ' ' || COALESCE(aliases, '') AS text
         FROM characters WHERE project_id = ? UNION ALL
         SELECT id, 'location', name, COALESCE(notes, '') || ' ' || COALESCE(aliases, '')
         FROM locations WHERE project_id = ? UNION ALL
         SELECT id, entity_type, name, COALESCE(notes, '') || ' ' || COALESCE(aliases, '')
         FROM entities WHERE project_id = ?
       ) SELECT b.id, b.type, b.name,
         b.text || ' ' || COALESCE((SELECT GROUP_CONCAT(field_value, ' ')
           FROM entity_fields ef WHERE ef.entity_id = b.id), '') AS text
       FROM bible b`, [projectId, projectId, projectId],
    );
    return rows.flatMap((row) => {
      const searchable = `${row.name} ${row.text}`;
      const offsets = collectOffsets(searchable, query, options);
      return offsets.length === 0 ? [] : [{
        domain: "bible" as const, id: row.id, title: row.name,
        subtitle: row.type, text: searchable, offsets,
      }];
    });
  }

  async searchNotes(projectId: string, query: string, options?: MobileSearchOptions): Promise<MobileSearchMatch[]> {
    if (query.length < 2) return [];
    const rows = await this.db.select<Array<{ id: string; body: string }>>(
      "SELECT id, body FROM quick_notes WHERE project_id = ? AND state = 'inbox' ORDER BY created_at DESC", [projectId],
    );
    return rows.flatMap((row) => {
      const offsets = collectOffsets(row.body, query, options);
      return offsets.length === 0 ? [] : [{
        domain: "note" as const, id: row.id, title: "Inbox note",
        subtitle: "Quick capture", text: row.body, offsets,
      }];
    });
  }

  async searchAll(projectId: string, query: string, options?: MobileSearchOptions): Promise<MobileSearchMatch[]> {
    const [manuscript, bible, notes] = await Promise.all([
      this.searchManuscript(projectId, query, options),
      this.searchBible(projectId, query, options),
      this.searchNotes(projectId, query, options),
    ]);
    return [...manuscript, ...bible, ...notes];
  }
}
