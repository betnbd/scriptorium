import type { ParsedAssistantResult } from "./responseParser";

export function applyAssistantResult(
  currentMarkdown: string,
  result: ParsedAssistantResult,
): string {
  if (result.kind === "edit") {
    return result.markdown;
  }

  return currentMarkdown;
}
