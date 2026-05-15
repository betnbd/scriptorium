import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AssistantPane } from "./AssistantPane";

describe("AssistantPane", () => {
  it("submits a subscription handoff request", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(
      <AssistantPane
        defaultProvider="openai-subscription"
        onSubmit={onSubmit}
        onImport={vi.fn()}
      />,
    );

    await user.type(screen.getByLabelText("Instruction"), "Make it sharper");
    await user.click(screen.getByRole("button", { name: "Prepare" }));

    expect(onSubmit).toHaveBeenCalledWith({
      provider: "openai-subscription",
      mode: "rewrite",
      instruction: "Make it sharper",
    });
  });

  it("lets the user select provider and mode before preparing", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(
      <AssistantPane
        defaultProvider="openai-subscription"
        onSubmit={onSubmit}
        onImport={vi.fn()}
      />,
    );

    await user.selectOptions(
      screen.getByLabelText("Provider"),
      "anthropic-subscription",
    );
    await user.selectOptions(screen.getByLabelText("Mode"), "diff");
    await user.type(screen.getByLabelText("Instruction"), "Show exact edits");
    await user.click(screen.getByRole("button", { name: "Prepare" }));

    expect(onSubmit).toHaveBeenCalledWith({
      provider: "anthropic-subscription",
      mode: "diff",
      instruction: "Show exact edits",
    });
  });

  it("imports a pasted assistant response placeholder", async () => {
    const user = userEvent.setup();
    const onImport = vi.fn();

    render(
      <AssistantPane
        defaultProvider="lm-studio"
        onSubmit={vi.fn()}
        onImport={onImport}
      />,
    );

    await user.type(
      screen.getByLabelText("Import response"),
      "Use shorter sentences.",
    );
    await user.click(screen.getByRole("button", { name: "Import" }));

    expect(onImport).toHaveBeenCalledWith("Use shorter sentences.");
  });
});
