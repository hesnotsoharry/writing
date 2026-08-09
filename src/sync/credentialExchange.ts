import type {
  CredentialAckMessage, CredentialOfferMessage, InnerMessage, ManagedCredentialState,
} from "./messages";

export type CredentialOfferHandler = (
  offer: CredentialOfferMessage,
) => Promise<CredentialAckMessage>;
export type CredentialAckHandler = (ack: CredentialAckMessage) => void;

export class CredentialExchange {
  private offerHandler: CredentialOfferHandler | null = null;
  private ackHandler: CredentialAckHandler | null = null;

  constructor(
    private readonly send: (message: InnerMessage) => Promise<void>,
    private readonly canSend: () => boolean,
  ) {}

  onOffer(handler: CredentialOfferHandler | null): void { this.offerHandler = handler; }
  onAck(handler: CredentialAckHandler | null): void { this.ackHandler = handler; }

  async sendOffer(managed: ManagedCredentialState, id: string): Promise<string | null> {
    if (!this.canSend()) return null;
    await this.send({ t: "credential-offer", id, managed });
    return id;
  }

  async receive(message: InnerMessage): Promise<boolean> {
    if (message.t === "credential-offer") {
      const ack = await this.offerHandler?.(message);
      if (ack) await this.send(ack);
      return true;
    }
    if (message.t !== "credential-ack") return false;
    this.ackHandler?.(message);
    return true;
  }
}

export type { ManagedCredentialState } from "./messages";
