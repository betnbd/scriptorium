import { describe, expect, it } from "vitest";
import {
  defaultPaneLayout,
  resetPaneLayout,
  resizePaneLayout,
} from "./layout";

describe("pane layout", () => {
  it("resizes the file pane in pointer direction", () => {
    expect(
      resizePaneLayout({
        layout: defaultPaneLayout,
        pane: "file",
        deltaX: 34,
      }).filePaneWidth,
    ).toBe(defaultPaneLayout.filePaneWidth + 34);
  });

  it("resizes the assistant pane opposite the pointer direction", () => {
    expect(
      resizePaneLayout({
        layout: defaultPaneLayout,
        pane: "assistant",
        deltaX: -40,
      }).assistantPaneWidth,
    ).toBe(defaultPaneLayout.assistantPaneWidth + 40);
  });

  it("keeps panes inside usable limits", () => {
    expect(
      resizePaneLayout({
        layout: defaultPaneLayout,
        pane: "file",
        deltaX: -500,
      }).filePaneWidth,
    ).toBe(220);
    expect(
      resizePaneLayout({
        layout: defaultPaneLayout,
        pane: "assistant",
        deltaX: -500,
      }).assistantPaneWidth,
    ).toBe(560);
  });

  it("can reset to the default pane layout", () => {
    expect(resetPaneLayout()).toEqual(defaultPaneLayout);
  });
});
