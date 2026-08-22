import { createContext, useContext } from "react";

/** True inside a `Sheet`. Read by `TextField`/`SearchField` so an input can pick
 *  the component its container actually needs, without every call site having
 *  to know or remember which one it is sitting in. */
const InSheetContext = createContext(false);

export const InSheetProvider = InSheetContext.Provider;

export function useInSheet(): boolean {
  return useContext(InSheetContext);
}
