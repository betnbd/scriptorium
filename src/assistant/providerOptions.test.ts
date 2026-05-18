import { describe, expect, it } from "vitest";
import {
  anthropicEffortOptions,
  effortOptionsForProvider,
  modelOptionsForProvider,
  openaiEffortOptions,
} from "./providerOptions";

describe("providerOptions", () => {
  it("keeps subscription provider model options centralized", () => {
    expect(modelOptionsForProvider("openai-subscription")).toEqual(
      expect.arrayContaining([
        { value: "gpt-5.5", label: "GPT-5.5" },
        { value: "gpt-5.3-codex-spark", label: "GPT-5.3 Codex Spark" },
      ]),
    );
    expect(modelOptionsForProvider("anthropic-subscription")).toEqual([
      { value: "sonnet", label: "Claude Sonnet 4" },
      { value: "opus", label: "Claude Opus 4.1" },
    ]);
  });

  it("offers Claude max effort without adding it to OpenAI", () => {
    expect(openaiEffortOptions.map((option) => option.value)).not.toContain(
      "max",
    );
    expect(anthropicEffortOptions.map((option) => option.value)).toContain(
      "max",
    );
    expect(effortOptionsForProvider("openai-subscription")).toBe(
      openaiEffortOptions,
    );
    expect(effortOptionsForProvider("anthropic-subscription")).toBe(
      anthropicEffortOptions,
    );
  });
});
