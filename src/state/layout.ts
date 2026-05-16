export interface PaneLayout {
  filePaneWidth: number;
  assistantPaneWidth: number;
}

export type ResizePane = "file" | "assistant";

export const defaultPaneLayout: PaneLayout = {
  filePaneWidth: 440,
  assistantPaneWidth: 560,
};

const paneLimits: Record<keyof PaneLayout, { min: number; max: number }> = {
  filePaneWidth: { min: 210, max: 440 },
  assistantPaneWidth: { min: 320, max: 560 },
};

export function resizePaneLayout({
  layout,
  pane,
  deltaX,
}: {
  layout: PaneLayout;
  pane: ResizePane;
  deltaX: number;
}): PaneLayout {
  if (pane === "file") {
    return {
      ...layout,
      filePaneWidth: clampPaneWidth(
        "filePaneWidth",
        layout.filePaneWidth + deltaX,
      ),
    };
  }

  return {
    ...layout,
    assistantPaneWidth: clampPaneWidth(
      "assistantPaneWidth",
      layout.assistantPaneWidth - deltaX,
    ),
  };
}

export function resetPaneLayout(): PaneLayout {
  return defaultPaneLayout;
}

function clampPaneWidth(key: keyof PaneLayout, value: number): number {
  const { min, max } = paneLimits[key];

  return Math.min(max, Math.max(min, Math.round(value)));
}
