import type { AssistantMode } from "../types";

export type ParsedAssistantResult =
  | { kind: "rewrite"; markdown: string }
  | { kind: "diff"; patch: string }
  | { kind: "suggestions"; suggestions: string };

export function parseAssistantResponse(
  mode: AssistantMode,
  response: string,
): ParsedAssistantResult {
  const content = stripMarkdownFence(response.trim());

  if (mode === "rewrite") {
    return { kind: "rewrite", markdown: content };
  }

  if (mode === "diff") {
    return { kind: "diff", patch: content };
  }

  return { kind: "suggestions", suggestions: content };
}

function stripMarkdownFence(value: string): string {
  const match = value.match(
    /^```(?:markdown|md|diff)?[ \t]*\r?\n([\s\S]*?)\r?\n```[ \t]*$/i,
  );

  return match ? match[1].trim() : value;
}
