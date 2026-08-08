import { Asset } from "expo-asset";

declare const require: (path: string) => number;

function getEditorWebModule(): number {
  return require("../../../editor-web/dist/index.html");
}

export async function getEditorWebAssetUri(
  editorWebModule: number = getEditorWebModule(),
): Promise<string> {
  const asset = Asset.fromModule(editorWebModule);
  await asset.downloadAsync();
  if (!asset.localUri) throw new Error("Editor WebView asset has no local URI");
  return asset.localUri;
}
