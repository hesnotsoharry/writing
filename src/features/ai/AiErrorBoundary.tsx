/**
 * AiErrorBoundary — class-based error boundary that contains render failures
 * in the AI assistant subtree so they never propagate to the editor or binder.
 *
 * Class components are the only React-supported mechanism for catching render
 * errors (getDerivedStateFromError / componentDidCatch); hooks cannot do this.
 */
import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class AiErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="ai-guardrail">
          Assistant hit a problem — reopen the tab to retry.
        </div>
      );
    }
    return this.props.children;
  }
}
