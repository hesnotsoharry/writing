import { useEffect, useRef, useState } from "react";

import { getAiConversationStore } from "../../db/stores";
import type { VerbKey } from "../../shared/aiCatalog";
import type { AssembledContext } from "../../shared/aiContext";
import {
  deriveConversationTitle, type MessageRow,
} from "../../shared/aiConversationStore";
import { loadContextScreenState } from "./aiContextModel";
import { type AiLimitReason, parseLimitReason } from "./aiLogic";
import type { ManagedAiAvailability } from "./credentialHandoff";
import { type AiMessage, mobileAiClient, type NormalizedEvent } from "./mobileAiClient";
import { readAiSelection } from "./selectionBridge";

export interface AssistantMessage {
  id: string;
  role: "you" | "ai";
  body: string;
  streaming?: boolean;
}

interface SendInput {
  projectId: string;
  sceneId?: string;
  verb: VerbKey;
  question: string;
  access: ManagedAiAvailability | null;
  onLimit(reason: AiLimitReason): void;
  onDone(): void;
}

function mapMessage(row: MessageRow): AssistantMessage {
  return { id: row.id, role: row.role, body: row.body };
}

function historyMessages(messages: AssistantMessage[]): AiMessage[] {
  return messages.filter((message) => !message.streaming).map((message) => ({
    role: message.role === "you" ? "user" : "assistant", content: message.body,
  }));
}

function systemPrompt(context: AssembledContext): string {
  return "You are WritersNook's writing assistant. Use only the supplied context. Treat hidden placeholders as unavailable text.\n\n"
    + JSON.stringify(context);
}

export function useAssistantConversation(conversationId?: string) {
  const conversationRef = useRef(conversationId);
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [sending, setSending] = useState(false);
  useLoadedMessages(conversationId, setMessages);
  const send = async (input: SendInput): Promise<void> => {
    if (input.access?.state !== "available" || sending || !input.question.trim()) return;
    setSending(true);
    await performSend(input, messages, conversationRef, setMessages);
    setSending(false);
  };
  return { messages, send, sending };
}

type SetMessages = React.Dispatch<React.SetStateAction<AssistantMessage[]>>;

function useLoadedMessages(conversationId: string | undefined, setMessages: SetMessages): void {
  useEffect(() => {
    let active = true;
    if (conversationId) void getAiConversationStore().then((store) => store.listMessages(conversationId))
      .then((rows) => { if (active) setMessages(rows.map(mapMessage)); });
    return () => { active = false; };
  }, [conversationId, setMessages]);
}

async function persistExchange(args: {
  conversationRef: React.MutableRefObject<string | undefined>; input: SendInput;
  answer: string; context: AssembledContext; cost: number;
}): Promise<void> {
  const store = await getAiConversationStore();
  if (!args.conversationRef.current) {
    const row = await store.createConversation(args.input.projectId, {
      title: deriveConversationTitle(args.input.question), verb: args.input.verb,
    });
    args.conversationRef.current = row.id;
  }
  await store.appendMessage(args.conversationRef.current, { role: "you", verb: args.input.verb,
    body: args.input.question, contextJson: JSON.stringify(args.context), creditsCost: null });
  await store.appendMessage(args.conversationRef.current, { role: "ai", verb: args.input.verb,
    body: args.answer, contextJson: null, creditsCost: args.cost });
}

interface StreamProgress { answer: string; terminal: boolean }

function makeEventHandler(args: {
  input: SendInput; context: AssembledContext; conversationRef: React.MutableRefObject<string | undefined>;
  prior: AssistantMessage[]; temporaryAi: string; setMessages: SetMessages; progress: StreamProgress;
}): (event: NormalizedEvent) => void {
  return (event) => {
    if (event.type === "token") { args.progress.answer += event.text;
      updateStreaming(args.setMessages, args.temporaryAi, args.progress.answer); return; }
    const reason = parseLimitReason(event);
    if (reason) { args.progress.terminal = true; args.setMessages(args.prior); args.input.onLimit(reason); return; }
    if (event.type === "error") { args.progress.terminal = true;
      updateStreaming(args.setMessages, args.temporaryAi, event.message, false); return; }
    if (event.type === "session-expired" || event.type === "trial-budget-exhausted") {
      args.progress.terminal = true;
      updateStreaming(args.setMessages, args.temporaryAi, "Managed AI is temporarily unavailable.", false); return;
    }
    if (event.type === "done") { args.progress.terminal = true;
      updateStreaming(args.setMessages, args.temporaryAi, args.progress.answer, false);
      void persistExchange({ conversationRef: args.conversationRef, input: args.input,
        answer: args.progress.answer, context: args.context, cost: event.creditsCost })
        .then(args.input.onDone); }
  };
}

async function performSend(
  input: SendInput, prior: AssistantMessage[],
  conversationRef: React.MutableRefObject<string | undefined>, setMessages: SetMessages,
): Promise<void> {
  if (input.access?.state !== "available") return;
  const temporaryAi = `local-ai-${Date.now()}`;
  setMessages([...prior, { id: `local-user-${Date.now()}`, role: "you", body: input.question },
    { id: temporaryAi, role: "ai", body: "", streaming: true }]);
  const selection = input.sceneId ? readAiSelection(input.sceneId) : null;
  const state = await loadContextScreenState({ projectId: input.projectId,
    sceneId: input.sceneId, conversationId: conversationRef.current,
    selectionText: selection?.aiSafeText });
  const progress: StreamProgress = { answer: "", terminal: false };
  const onEvent = makeEventHandler({ input, context: state.assembled, conversationRef,
    prior, temporaryAi, setMessages, progress });
  const requestMessages = [...historyMessages(prior), { role: "user", content: input.question } as const];
  await mobileAiClient.streamChat(input.access.session.token, requestMessages, onEvent, {
    verb: input.verb, model: input.access.credential.aiModel, system: systemPrompt(state.assembled),
  }).catch((error: unknown) => { progress.terminal = true; updateStreaming(setMessages, temporaryAi,
    error instanceof Error ? error.message : "The assistant could not connect.", false); });
  if (!progress.terminal) updateStreaming(setMessages, temporaryAi,
    progress.answer || "The assistant returned no response.", false);
}

function updateStreaming(
  setMessages: React.Dispatch<React.SetStateAction<AssistantMessage[]>>,
  id: string, body: string, streaming = true,
): void {
  setMessages((current) => current.map((message) => message.id === id
    ? { ...message, body, streaming } : message));
}
