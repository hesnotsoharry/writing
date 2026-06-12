/**
 * ConsentWalkthrough — shown inside the Assistant tab on first open.
 *
 * Honest data-flow copy per Decision 4 (honest framing mandate):
 * manuscript text DOES transit the relay to Anthropic; the copy states
 * the actual path and the three promises (not stored, not logged, not trained on).
 *
 * Not a modal — renders inside the panel area. The user switches to the
 * Scene tab to dismiss without accepting.
 */

export interface ConsentWalkthroughProps {
  onAccept: () => void;
  onDismiss: () => void;
}

export function ConsentWalkthrough({ onAccept, onDismiss }: ConsentWalkthroughProps) {
  return (
    <div className="ai-consent">
      <div className="ai-consent-body">
        <h3 className="ai-consent-head">AI brainstorming assistant</h3>
        <p className="ai-consent-text">
          To answer your question, your prompt, the current scene, and any linked
          story-bible notes travel from this device through our relay to Anthropic.
          Your writing is{" "}
          <strong>never stored, never logged, and never used to train any AI model</strong>.
        </p>
        <p className="ai-consent-text">
          Usage is deducted from your prepaid credit balance — the panel shows the cost
          after each reply. At zero credits requests stop; no surprise charges.
        </p>
        <div className="ai-consent-flow">
          <span className="ai-consent-node">Your device</span>
          <span className="ai-consent-arrow">→</span>
          <span className="ai-consent-node">Our relay</span>
          <span className="ai-consent-arrow">→</span>
          <span className="ai-consent-node">Anthropic</span>
        </div>
      </div>
      <div className="ai-consent-actions">
        <button className="btn btn-primary" onClick={onAccept}>Accept</button>
        <button className="btn btn-soft" onClick={onDismiss}>Not now</button>
      </div>
    </div>
  );
}
