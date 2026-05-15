import type { AssistantMode, IndexedDocument } from "../types";

interface PromptInput {
  mode: AssistantMode;
  instruction: string;
  targetLabel: string;
  targetMarkdown: string;
  context: Pick<IndexedDocument, "relativePath" | "title" | "chunks">[];
}

const modeLabels: Record<AssistantMode, string> = {
  rewrite: "Full rewrite",
  diff: "Proposed diff edits",
  suggestions: "Suggestions only",
};

export function buildAssistantPrompt(input: PromptInput): string {
  const contextText = input.context
    .map(
      (doc) =>
        `### ${doc.relativePath}\nTitle: ${doc.title}\n${doc.chunks
          .slice(0, 3)
          .join("\n\n")}`,
    )
    .join("\n\n");

  return [
    "You are helping revise a novel draft.",
    `Mode: ${modeLabels[input.mode]}`,
    `Instruction: ${input.instruction.trim() || "Use your best editorial judgment."}`,
    "",
    `Target: ${input.targetLabel}`,
    "```markdown",
    input.targetMarkdown,
    "```",
    "",
    "Relevant context:",
    contextText || "No extra context selected.",
    "",
    outputInstructions(input.mode),
  ].join("\n");
}

function outputInstructions(mode: AssistantMode): string {
  if (mode === "rewrite") {
    return [
      "Return only the rewritten Markdown for the target.",
      "Preserve Markdown structure unless the instruction asks otherwise.",
    ].join("\n");
  }

  if (mode === "diff") {
    return [
      "Return a unified diff against the target Markdown.",
      "Keep edits minimal and anchored to the supplied target.",
    ].join("\n");
  }

  return [
    "Return concise suggestions.",
    "Do not rewrite the passage unless asked.",
  ].join("\n");
}
