import type { AssistantMessage, AssistantMode, IndexedDocument } from "../types";

interface PromptInput {
  mode: AssistantMode;
  instruction: string;
  targetLabel: string;
  targetMarkdown: string;
  projectFiles: string[];
  context: Pick<IndexedDocument, "relativePath" | "title" | "chunks">[];
  conversation?: AssistantMessage[];
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

  const conversationText = formatConversation(input.conversation ?? []);

  return [
    "You are helping revise a novel draft.",
    `Mode: ${modeLabels[input.mode]}`,
    `Instruction: ${input.instruction.trim() || "Use your best editorial judgment."}`,
    "",
    "Conversation so far:",
    conversationText || "No prior turns in this session.",
    "",
    `Target: ${input.targetLabel}`,
    "```markdown",
    input.targetMarkdown,
    "```",
    "",
    "Project files visible in the file pane:",
    formatProjectFiles(input.projectFiles),
    "",
    "Relevant context:",
    contextText || "No extra context selected.",
    "",
    outputInstructions(input.mode),
  ].join("\n");
}

function formatConversation(messages: AssistantMessage[]): string {
  return messages
    .filter((message) => message.role !== "system")
    .slice(-8)
    .map(
      (message) =>
        `${formatRole(message.role)}: ${formatMessageContent(message.content)}`,
    )
    .join("\n\n");
}

function formatRole(role: AssistantMessage["role"]): string {
  if (role === "user") {
    return "User";
  }

  if (role === "assistant") {
    return "Assistant";
  }

  return "DraftAgent";
}

function formatMessageContent(content: string): string {
  const trimmed = content.trim();
  const parts = trimmed.split(/\n{2,}/);

  return (parts[parts.length - 1] || trimmed).trim();
}

function formatProjectFiles(files: string[]): string {
  if (files.length === 0) {
    return "No project files are currently visible.";
  }

  return files.slice(0, 120).map((path) => `- ${path}`).join("\n");
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
