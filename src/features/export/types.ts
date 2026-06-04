export type ExportScope = "scene" | "chapter" | "manuscript";
export type ExportData = string | Uint8Array;
export type SaveCallback = (
  suggestedFilename: string,
  data: ExportData,
  mime: string
) => Promise<void>;
