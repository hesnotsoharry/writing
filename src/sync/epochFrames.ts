import { fromUint8Array, toUint8Array } from "js-base64";
import * as Y from "yjs";

import type { EpochManager } from "./epochManager";
import { type DiffMessage, type HelloDoc, parseChannel } from "./messages";

export interface ChannelDoc { stateBase64: string; channel: string }

/**
 * True when a restore elsewhere bumped this scene's epoch and we have not applied
 * the replacement yet — our copy IS the content the restore discarded.
 */
function owesReplacement(channelName: string, epochs: EpochManager): boolean {
  const channel = parseChannel(channelName);
  return channel?.kind === "scene" && epochs.isBehind(channel.id);
}

/**
 * What we advertise for one doc. A scene we owe a replacement for advertises an
 * EMPTY state vector — "send me everything" — so the peer replies with a full
 * state we can swap in wholesale rather than a diff we would merge.
 */
export function helloDoc(
  doc: ChannelDoc & { updatedAt: string | null }, epochs: EpochManager
): HelloDoc {
  const vector = owesReplacement(doc.channel, epochs)
    ? Y.encodeStateVector(new Y.Doc())
    : Y.encodeStateVectorFromUpdate(toUint8Array(doc.stateBase64));
  return { c: doc.channel, sv: fromUint8Array(vector), at: doc.updatedAt };
}

function sceneEpoch(channelName: string, epochs: EpochManager): number {
  const channel = parseChannel(channelName);
  return channel?.kind === "scene" ? epochs.epoch(channel.id) : 0;
}

function sceneOwner(channelName: string, epochs: EpochManager): string {
  const channel = parseChannel(channelName);
  return channel?.kind === "scene" ? epochs.owner(channel.id) : "";
}

/**
 * The diff we owe a peer for one doc given the state vector it advertised, or
 * null when we owe it nothing.
 *
 * Withholding a scene we are behind on is load-bearing: `EpochManager.accepts()`
 * cannot distinguish our stale copy from the restored one (both carry the new
 * epoch), so sending ours would merge the discarded content back into the device
 * that performed the restore and silently undo it.
 */
export function answerFrame(
  doc: ChannelDoc, peerVector: string | undefined, epochs: EpochManager
): DiffMessage | null {
  if (owesReplacement(doc.channel, epochs)) return null;
  const state = toUint8Array(doc.stateBase64);
  const epoch = sceneEpoch(doc.channel, epochs);
  const sendFull = !peerVector || epoch > 0;
  const update = sendFull ? state : Y.diffUpdate(state, toUint8Array(peerVector));
  if (!sendFull && update.length <= 2) return null;
  // v1.4: epoch'd frames carry the OWNER too, so receivers can reject a
  // same-counter frame from a losing concurrent restorer (audit P1.2).
  const owner = sceneOwner(doc.channel, epochs);
  return {
    t: "diff", c: doc.channel, u: fromUint8Array(update),
    ...(epoch > 0 ? { e: epoch, ...(owner ? { o: owner } : {}) } : {}),
  };
}

/** Content a targeted local-save hello should deliver immediately. */
export function targetedSaveFrame(
  doc: ChannelDoc, epochs: EpochManager, openSceneId: string | null
): DiffMessage | null {
  const channel = parseChannel(doc.channel);
  if (!channel || channel.kind === "board") return null;
  if (channel.kind === "scene" && channel.id === openSceneId) return null;
  return answerFrame(doc, undefined, epochs);
}
