import { fromUint8Array, toUint8Array } from "js-base64";
import * as Y from "yjs";

import type { EpochManager } from "./epochManager";
import { type DiffMessage, parseChannel } from "./messages";

export interface ChannelDoc { stateBase64: string; channel: string }

/**
 * True when a restore elsewhere bumped this scene's epoch and we have not applied
 * the replacement yet — our copy IS the content the restore discarded.
 */
function owesReplacement(channelName: string, epochs: EpochManager): boolean {
  const channel = parseChannel(channelName);
  return channel?.kind === "scene" && epochs.isBehind(channel.id);
}

function sceneEpoch(channelName: string, epochs: EpochManager): number {
  const channel = parseChannel(channelName);
  return channel?.kind === "scene" ? epochs.epoch(channel.id) : 0;
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
  return {
    t: "diff", c: doc.channel, u: fromUint8Array(update),
    ...(epoch > 0 ? { e: epoch } : {}),
  };
}
