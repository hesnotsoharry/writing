import type { AppliedEpochs } from "../db/syncEpochStore";
import type { EngineOptions } from "./engineTypes";

export class LocalContentSubscriptions {
  private unsubscribers: Array<() => void> = [];

  constructor(
    private readonly options: EngineOptions,
    private readonly onMeta: (projectId: string, epochs: AppliedEpochs) => void,
    private readonly onBible: (projectId: string, stateBase64: string) => void,
    private readonly onScene: (sceneId: string) => void,
  ) {}

  start(): void {
    const candidates = [
      this.options.subscribeMetaSaves?.(this.onMeta),
      this.options.subscribeBibleSaves?.(this.onBible),
      this.options.subscribeSceneWrites?.(this.onScene),
    ];
    this.unsubscribers = candidates.filter((value): value is () => void => Boolean(value));
  }

  stop(): void {
    this.unsubscribers.forEach((unsubscribe) => unsubscribe());
    this.unsubscribers = [];
  }
}
