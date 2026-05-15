import { describe, expect, it } from "vitest";
import { buildAssistantPrompt } from "./promptBuilder";

describe("buildAssistantPrompt", () => {
  it("builds a rewrite prompt with target and context", () => {
    const prompt = buildAssistantPrompt({
      mode: "rewrite",
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

    expect(prompt).toContain("Mode: Full rewrite");
    expect(prompt).toContain("Instruction: Make this more tense.");
    expect(prompt).toContain("Target: chapter.md");
    expect(prompt).toContain("The door opened.");
    expect(prompt).toContain("Project files visible in the file pane:");
    expect(prompt).toContain("- notes.md");
    expect(prompt).toContain("The house is haunted.");
    expect(prompt).toContain("Return only the rewritten Markdown");
  });

  it("builds mode-specific diff output instructions", () => {
    const prompt = buildAssistantPrompt({
      mode: "diff",
      instruction: "Tighten this scene.",
      targetLabel: "scene.md",
      targetMarkdown: "Old line.",
      projectFiles: [],
      context: [],
    });

    expect(prompt).toContain("Mode: Proposed diff edits");
    expect(prompt).toContain("No project files are currently visible.");
    expect(prompt).toContain("No extra context selected.");
    expect(prompt).toContain("Return a unified diff");
  });

  it("builds mode-specific suggestions output instructions", () => {
    const prompt = buildAssistantPrompt({
      mode: "suggestions",
      instruction: "Find pacing problems.",
      targetLabel: "scene.md",
      targetMarkdown: "Old line.",
      projectFiles: [],
      context: [],
    });

    expect(prompt).toContain("Mode: Suggestions only");
    expect(prompt).toContain("Return concise suggestions");
    expect(prompt).toContain("Do not rewrite the passage");
  });
});
