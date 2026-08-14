import { readFileSync } from "node:fs";
import path from "node:path";

import { expect, it } from "vitest";

const MANIFEST = path.resolve(__dirname, "..", "..", "android", "app", "src", "main", "AndroidManifest.xml");

it("registers MainActivity as a plain-text share target", () => {
  const manifest = readFileSync(MANIFEST, "utf8");
  const filters = manifest.match(/<intent-filter>[\s\S]*?<\/intent-filter>/g) ?? [];
  const shareFilter = filters.find((filter) => filter.includes("android.intent.action.SEND"));

  expect(shareFilter).toContain('android:name="android.intent.category.DEFAULT"');
  expect(shareFilter).toContain('android:mimeType="text/*"');
});
