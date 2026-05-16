import type { AssistantMode } from "../types";

export type ParsedAssistantResult =
  | { kind: "edit"; markdown: string }
  | { kind: "chat"; content: string };

export function parseAssistantResponse(
  mode: AssistantMode,
  response: string,
): ParsedAssistantResult {
  const content = stripMarkdownFence(response.trim());

  if (mode === "edit") {
    return { kind: "edit", markdown: extractTaggedEdit(content) };
  }

  return { kind: "chat", content };
}

function extractTaggedEdit(value: string): string {
  const match = value.match(
    /<scriptorium_(?:edit|rewrite)>\s*([\s\S]*?)\s*<\/scriptorium_(?:edit|rewrite)>/i,
  );

  return match ? stripMarkdownFence(match[1].trim()) : value;
}

function stripMarkdownFence(value: string): string {
  const match = value.match(
    /^```(?:markdown|md|diff)?[ \t]*\r?\n([\s\S]*?)\r?\n```[ \t]*$/i,
  );

  return match ? match[1].trim() : value;
}
