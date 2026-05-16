import type { EditorFont, ThemeId } from "./types";

export interface ThemeOption {
  id: ThemeId;
  label: string;
}

export interface EditorFontOption {
  id: EditorFont;
  label: string;
}

export const themeOptions: ThemeOption[] = [
  { id: "paper", label: "Paper" },
  { id: "catppuccin-latte", label: "Catppuccin Latte" },
  { id: "catppuccin-mocha", label: "Catppuccin Mocha" },
  { id: "gruvbox-light", label: "Gruvbox Light" },
  { id: "gruvbox-dark", label: "Gruvbox Dark" },
  { id: "dracula", label: "Dracula" },
  { id: "nord", label: "Nord" },
  { id: "solarized-light", label: "Solarized Light" },
  { id: "solarized-dark", label: "Solarized Dark" },
  { id: "tokyo-night", label: "Tokyo Night" },
  { id: "rose-pine", label: "Rose Pine" },
  { id: "everforest", label: "Everforest" },
];

export const editorFontOptions: EditorFontOption[] = [
  { id: "literary", label: "Literary serif" },
  { id: "system", label: "System sans" },
  { id: "mono", label: "Monospace" },
];

export function themeLabel(themeId: ThemeId) {
  return themeOptions.find((theme) => theme.id === themeId)?.label ?? "Paper";
}
