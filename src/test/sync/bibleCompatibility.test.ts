import { fromUint8Array, toUint8Array } from "js-base64";
import { describe, expect, it } from "vitest";
import * as Y from "yjs";

import { buildBibleFromSql } from "../../sync/bible/bibleDoc";
import { bibleChannel, metaChannel, sceneChannel } from "../../sync/messages";

interface V12Update { t: "diff" | "live"; c: string; u: string }

function parseV12Channel(channel: string): { kind: string; id: string } | null {
  const separator = channel.indexOf(":");
  if (separator <= 0) return null;
  const kind = channel.slice(0, separator); const id = channel.slice(separator + 1);
  if (!id || (kind !== "scene" && kind !== "board" && kind !== "meta")) return null;
  return { kind, id };
}

class V12Peer {
  readonly docs = new Map<string, Y.Doc>();
  receive(frame: V12Update): void {
    if (!parseV12Channel(frame.c)) return;
    const doc = this.docs.get(frame.c) ?? new Y.Doc();
    Y.applyUpdate(doc, toUint8Array(frame.u)); this.docs.set(frame.c, doc);
  }
  frame(channel: string): V12Update {
    return { t: "diff", c: channel, u: fromUint8Array(Y.encodeStateAsUpdate(this.docs.get(channel)!)) };
  }
}

function mapDoc(key: string, value: string): Y.Doc {
  const doc = new Y.Doc(); doc.getMap<string>("state").set(key, value); return doc;
}

function frame(channel: string, doc: Y.Doc): V12Update {
  return { t: "diff", c: channel, u: fromUint8Array(Y.encodeStateAsUpdate(doc)) };
}

describe("Bible channel v1.2 compatibility", () => {
  it("a v1.2-shaped peer ignores Bible frames while scenes and meta converge both ways", () => {
    const oldPeer = new V12Peer();
    const scene = mapDoc("desktop", "scene from v1.3");
    const meta = mapDoc("desktop", "meta from v1.3");
    const bible = buildBibleFromSql({
      entities: [], entityTypes: [], fields: [], sceneLinks: [], entityLinks: [], relations: [],
    });
    oldPeer.receive(frame(bibleChannel("p1"), bible));
    oldPeer.receive(frame(sceneChannel("s1"), scene));
    oldPeer.receive(frame(metaChannel("p1"), meta));
    expect(oldPeer.docs.has(bibleChannel("p1"))).toBe(false);

    oldPeer.docs.get(sceneChannel("s1"))?.getMap<string>("state").set("old", "scene from v1.2");
    oldPeer.docs.get(metaChannel("p1"))?.getMap<string>("state").set("old", "meta from v1.2");
    Y.applyUpdate(scene, toUint8Array(oldPeer.frame(sceneChannel("s1")).u));
    Y.applyUpdate(meta, toUint8Array(oldPeer.frame(metaChannel("p1")).u));

    expect(scene.getMap("state").toJSON()).toEqual({ desktop: "scene from v1.3", old: "scene from v1.2" });
    expect(meta.getMap("state").toJSON()).toEqual({ desktop: "meta from v1.3", old: "meta from v1.2" });
    expect(oldPeer.docs.get(sceneChannel("s1"))?.getMap("state").toJSON())
      .toEqual(scene.getMap("state").toJSON());
    expect(oldPeer.docs.get(metaChannel("p1"))?.getMap("state").toJSON())
      .toEqual(meta.getMap("state").toJSON());
  });
});
