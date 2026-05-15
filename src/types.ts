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
export type AssistantMode = "rewrite" | "diff" | "suggestions";

export interface AssistantMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface AppSettings {
  defaultProvider: ProviderId;
  openaiUrl: string;
  anthropicUrl: string;
  lmStudioBaseUrl: string;
  lmStudioModel: string;
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
