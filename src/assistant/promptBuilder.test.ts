import { describe, expect, it } from "vitest";
import { buildAssistantPrompt } from "./promptBuilder";

describe("buildAssistantPrompt", () => {
  it("builds an edit prompt with target and context", () => {
    const prompt = buildAssistantPrompt({
      mode: "edit",
      instruction: "Make this more tense.",
      targetLabel: "chapter.md",
      targetMarkdown: "The door opened.",
      projectFiles: ["chapter.md", "notes.md"],
      context: [
        {
          relativePath: "notes.md",
          title: "Notes",
          chunks: ["The house is haunted."],
        },
      ],
    });

    expect(prompt).toContain("Mode: Direct edit");
    expect(prompt).toContain("Instruction: Make this more tense.");
    expect(prompt).toContain("Target: chapter.md");
    expect(prompt).toContain("The door opened.");
    expect(prompt).toContain("Project files visible in the file pane:");
    expect(prompt).toContain("- notes.md");
    expect(prompt).toContain("The house is haunted.");
    expect(prompt).toContain("Return only the rewritten Markdown");
    expect(prompt).toContain("<scriptorium_edit>");
    expect(prompt).toContain("</scriptorium_edit>");
  });

  it("builds chat prompts that suggest without editing the document", () => {
    const prompt = buildAssistantPrompt({
      mode: "chat",
      instruction: "What should I change?",
      targetLabel: "scene.md",
      targetMarkdown: "Old line.",
      projectFiles: [],
      context: [],
    });

    expect(prompt).toContain("Mode: Conversation");
    expect(prompt).toContain("Respond conversationally");
    expect(prompt).toContain("You may suggest edits in the conversation");
    expect(prompt).toContain("do not rewrite or edit the target Markdown");
  });

  it("includes prior conversation turns for iterative CLI-backed chats", () => {
    const prompt = buildAssistantPrompt({
      mode: "chat",
      instruction: "Can you explain the second point?",
      targetLabel: "scene.md",
      targetMarkdown: "Old line.",
      projectFiles: [],
      context: [],
      conversation: [
        {
          role: "user",
          content: "Read this document.",
        },
        {
          role: "assistant",
          content: "The scene is clear, but the motive arrives too late.",
        },
      ],
    });

    expect(prompt).toContain("Conversation so far:");
    expect(prompt).toContain("User: Read this document.");
    expect(prompt).toContain(
      "Assistant: The scene is clear, but the motive arrives too late.",
    );
    expect(prompt).toContain("Can you explain the second point?");
  });
});
