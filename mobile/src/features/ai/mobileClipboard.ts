interface ClipboardPort { setStringAsync(text: string): Promise<boolean> }

export async function copyText(
  text: string, clipboard?: ClipboardPort,
): Promise<boolean> {
  if (!text) return false;
  const port = clipboard ?? await import("expo-clipboard");
  return port.setStringAsync(text);
}
