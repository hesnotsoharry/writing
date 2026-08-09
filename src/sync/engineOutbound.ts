import type { LwwDomainRegistry } from "./lww/registry";
import { bibleChannel, type InnerMessage } from "./messages";
import type { DurableOutbox } from "./outbox";

type SendMessage = (message: InnerMessage) => Promise<void>;

export async function publishBibleSave(
  outbox: DurableOutbox | null, send: SendMessage, projectId: string, stateBase64: string,
): Promise<void> {
  const message: InnerMessage = { t: "diff", c: bibleChannel(projectId), u: stateBase64 };
  await outbox?.enqueue({ domain: "bible", projectId, itemId: projectId, kind: "doc", message });
  await send(message);
}

export async function sendEligibleOutboxMessage(
  message: InnerMessage, registry: LwwDomainRegistry, send: SendMessage,
): Promise<void> {
  if (message.t === "row" && !registry.get(message.domain)) return;
  await send(message);
}
