// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { EditorHeader } from "../editor/EditorHeader";

afterEach(cleanup);

// ---------------------------------------------------------------------------
// EditorHeader — presentational contract
// ---------------------------------------------------------------------------

describe("EditorHeader — byline text shape", () => {
  it("renders word count in '1,234 words' format", () => {
    render(
      <EditorHeader
        chapterTitle="Chapter One"
        title="The Scene"
        status="draft"
        words={1234}
        characters={3}
        locations={2}
      />,
    );
    expect(screen.getByText("1,234 words")).toBeInTheDocument();
  });

  it("renders 'N characters · N locations present' byline with correct counts", () => {
    render(
      <EditorHeader
        chapterTitle="Chapter One"
        title="The Scene"
        status="draft"
        words={10}
        characters={3}
        locations={2}
      />,
    );
    expect(screen.getByText("3 characters · 2 locations present")).toBeInTheDocument();
  });

  it("renders 0 characters and 0 locations when scene has no links", () => {
    render(
      <EditorHeader
        chapterTitle="Opening"
        title="Untitled"
        status="blank"
        words={0}
        characters={0}
        locations={0}
      />,
    );
    expect(screen.getByText("0 characters · 0 locations present")).toBeInTheDocument();
  });

  it("renders the scene title in the .scene-h1 heading", () => {
    render(
      <EditorHeader
        chapterTitle="Part I"
        title="The Title Scene"
        status="draft"
        words={5}
        characters={1}
        locations={1}
      />,
    );
    expect(screen.getByRole("heading", { name: "The Title Scene" })).toBeInTheDocument();
  });
});

describe("EditorHeader — status display", () => {
  it("renders the status label text for a non-final status (dot path)", () => {
    render(
      <EditorHeader
        chapterTitle="Ch"
        title="Sc"
        status="draft"
        words={0}
        characters={0}
        locations={0}
      />,
    );
    // STATUS_META['draft'].label = 'Drafting'
    expect(screen.getByText("Drafting")).toBeInTheDocument();
  });

  it("renders a check icon (no dot span) for isFinal status", () => {
    const { container } = render(
      <EditorHeader
        chapterTitle="Ch"
        title="Sc"
        status="final"
        words={0}
        characters={0}
        locations={0}
      />,
    );
    // The check path renders an <svg> (Icon), not a dot <span>.
    // We assert the SVG is present and no 7×7 dot span exists.
    const svgEl = container.querySelector("svg");
    expect(svgEl).toBeTruthy();
    const dotSpan = container.querySelector(
      'span[style*="border-radius: 50%"]',
    );
    expect(dotSpan).toBeNull();
  });

  it("renders a dot span (no svg) for a non-final status", () => {
    const { container } = render(
      <EditorHeader
        chapterTitle="Ch"
        title="Sc"
        status="outline"
        words={0}
        characters={0}
        locations={0}
      />,
    );
    const dotSpan = container.querySelector(
      'span[style*="border-radius: 50%"]',
    );
    expect(dotSpan).toBeTruthy();
    // No SVG icon for non-final
    const svgEl = container.querySelector("svg");
    expect(svgEl).toBeNull();
  });
});
