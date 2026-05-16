export type FileKind = "file" | "directory";

export interface FileNode {
  path: string;
  relativePath: string;
  name: string;
  extension: string;
  kind: FileKind;
  isMarkdown: boolean;
  modifiedAt: number;
  size: number;
  children?: FileNode[];
}

export interface IndexedDocument {
  path: string;
  relativePath: string;
  title: string;
  headings: string[];
  links: string[];
  chunks: string[];
  modifiedAt: number;
}

export type ProviderId =
  | "openai-subscription"
  | "anthropic-subscription"
  | "lm-studio";
export type AssistantMode = "chat" | "rewrite" | "diff" | "suggestions";
export type ThemeId =
  | "paper"
  | "catppuccin-latte"
  | "catppuccin-mocha"
  | "gruvbox-light"
  | "gruvbox-dark"
  | "dracula"
  | "nord"
  | "solarized-light"
  | "solarized-dark"
  | "tokyo-night"
  | "rose-pine"
  | "everforest";
export type EditorFont = "literary" | "system" | "mono";

export interface AssistantMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface AssistantPendingEdit {
  mode: Extract<AssistantMode, "rewrite" | "diff">;
  response: string;
  nextMarkdown: string;
}

export interface ProviderStatus {
  provider: Extract<ProviderId, "openai-subscription" | "anthropic-subscription">;
  installed: boolean;
  authenticated: boolean;
  detail: string;
}

export interface AppSettings {
  defaultProvider: ProviderId;
  openaiUrl: string;
  openaiModel: string;
  openaiEffort: string;
  anthropicUrl: string;
  anthropicModel: string;
  anthropicEffort: string;
  lmStudioBaseUrl: string;
  lmStudioModel: string;
  themeId: ThemeId;
  editorFont: EditorFont;
  editorFontSize: number;
  editorLineWidth: number;
  ignoreHidden: boolean;
  ignoreLargeFiles: boolean;
  ignoreBinaryFiles: boolean;
  projectEnvEnabled: boolean;
}

export interface OpenFile {
  file: FileNode;
  markdown: string;
}
