import { type ComponentType, createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { SheetProps } from "./Sheet";
import { resolveSheetFraction, resolveSheetHeight, resolveSheetLayout } from "./Sheet.logic";

vi.mock("@gorhom/bottom-sheet", async () => {
  const { createElement: create } = await import("react");
  const Host = ({ children }: { children?: ReactNode }) => create("bottom-sheet", null, children);
  const ScrollHost = ({ children, style }: { children?: ReactNode; style?: { flex?: number } }) =>
    create("bottom-sheet-scroll-view", { "data-flex": style?.flex }, children);
  const ViewHost = ({ children, style }: { children?: ReactNode; style?: { flex?: number }[] }) =>
    create("bottom-sheet-view", { "data-flex": style?.find((item) => item.flex)?.flex }, children);
  return { default: Host, BottomSheetScrollView: ScrollHost, BottomSheetView: ViewHost };
});
vi.mock("expo-blur", async () => {
  const { createElement: create } = await import("react");
  return { BlurView: ({ children }: { children?: ReactNode }) => create("blur-view", null, children) };
});
vi.mock("react-native", async () => {
  const { createElement: create } = await import("react");
  const Host = ({ children }: { children?: ReactNode }) => create("rn-view", null, children);
  return {
    Pressable: Host, View: Host,
    StyleSheet: { absoluteFill: {}, create: (styles: unknown) => styles },
    useWindowDimensions: () => ({ height: 1000, width: 500 }),
  };
});
vi.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ bottom: 0 }) }));
vi.mock("../theme/ThemeProvider", () => ({
  useTheme: () => ({ colors: { ink4: "gray", paper: "white", scrim: "black" }, name: "light", shadow: { sheet: {} } }),
}));

describe("sheet sizing", () => {
  it("preserves the design height as a screen fraction", () => {
    expect(resolveSheetFraction(648)).toBeCloseTo(648 / 844);
    expect(resolveSheetHeight(648, 1000)).toBeCloseTo((648 / 844) * 1000);
  });

  it("clamps invalid design heights", () => {
    expect(resolveSheetFraction(-10)).toBe(0);
    expect(resolveSheetFraction(900)).toBe(1);
  });

  it("bounds fixed-height content while leaving dynamic content measurable", () => {
    expect(resolveSheetLayout(648, 1000)).toEqual({
      contentFillsAvailableHeight: true,
      fixedHeight: (648 / 844) * 1000,
    });
    expect(resolveSheetLayout(undefined, 1000)).toEqual({
      contentFillsAvailableHeight: false,
      fixedHeight: undefined,
    });
  });
});

describe("scrollable sheet structure", () => {
  it("keeps the registered scroll view as the sheet's direct native child", async () => {
    const { Sheet } = await import("./Sheet");
    type RenderableSheetProps = Omit<SheetProps, "children"> & { children?: ReactNode };
    const RenderableSheet = Sheet as ComponentType<RenderableSheetProps>;
    const markup = renderToStaticMarkup(createElement(RenderableSheet, {
      designHeight: 648, onDismiss: () => undefined, open: true, scrollable: true,
    }, "content"));

    expect(markup).toContain("<bottom-sheet><bottom-sheet-scroll-view data-flex=\"1\">content");
    expect(markup).not.toContain("<bottom-sheet><rn-view><bottom-sheet-scroll-view>");
  });

  it("uses the registered view without flex-constraining non-scrollable content", async () => {
    const { Sheet } = await import("./Sheet");
    type RenderableSheetProps = Omit<SheetProps, "children"> & { children?: ReactNode };
    const RenderableSheet = Sheet as ComponentType<RenderableSheetProps>;
    const markup = renderToStaticMarkup(createElement(RenderableSheet, {
      designHeight: 230, onDismiss: () => undefined, open: true,
    }, "content"));

    expect(markup).toContain("<bottom-sheet><bottom-sheet-view>content");
    expect(markup).not.toContain("<bottom-sheet><rn-view>");
    expect(markup).not.toContain("<bottom-sheet-view data-flex=\"1\">");
  });
});
