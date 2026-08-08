/// <reference types="vite/client" />

interface ReactNativeWebViewHost {
  postMessage(message: string): void;
}

interface Window {
  ReactNativeWebView?: ReactNativeWebViewHost;
}
