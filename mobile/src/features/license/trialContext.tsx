import { createContext, type ReactNode, useContext } from "react";

const TrialDaysContext = createContext<number | null>(null);

export function TrialDaysProvider({ children, daysLeft }: { children: ReactNode; daysLeft: number | null }) {
  return <TrialDaysContext.Provider value={daysLeft}>{children}</TrialDaysContext.Provider>;
}

export function useTrialDaysLeft(): number | null { return useContext(TrialDaysContext); }
