import { DEFAULT_MODEL } from "../../shared/aiCatalog";
import type { CredentialOfferMessage } from "../../shared/messages";

let offerSequence = 0;

export function createDevTrialOffer(): CredentialOfferMessage {
  offerSequence += 1;
  return {
    t: "credential-offer",
    id: `dev-trial-${Date.now()}-${offerSequence}`,
    managed: {
      aiTrialKey: "",
      aiModel: DEFAULT_MODEL,
      aiEnabled: true,
    },
  };
}
