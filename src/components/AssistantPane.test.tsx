import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AssistantPane } from "./AssistantPane";

describe("AssistantPane", () => {
  it("submits an in-app subscription-backed request", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(
      <AssistantPane
        defaultProvider="openai-subscription"
        messages={[]}
        onSubmit={onSubmit}
        onImport={vi.fn()}
      />,
    );

    await user.type(screen.getByLabelText("Instruction"), "Make it sharper");
    await user.click(screen.getByRole("button", { name: "Send to OpenAI" }));

    expect(onSubmit).toHaveBeenCalledWith({
      provider: "openai-subscription",
      mode: "rewrite",
      instruction: "Make it sharper",
    });
  });

  it("lets the user select provider and mode before sending", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(
      <AssistantPane
        defaultProvider="openai-subscription"
        messages={[]}
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
    await user.click(screen.getByRole("button", { name: "Send to Claude" }));

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
        messages={[]}
        onSubmit={vi.fn()}
        onImport={onImport}
      />,
    );

    await user.click(screen.getByText("Manual import"));
    await user.type(
      screen.getByLabelText("Import response"),
      "Use shorter sentences.",
    );
    await user.click(screen.getByRole("button", { name: "Import" }));

    expect(onImport).toHaveBeenCalledWith("Use shorter sentences.", "rewrite");
  });

  it("shows the built-in CLI provider route", () => {
    render(
      <AssistantPane
        defaultProvider="openai-subscription"
        messages={[]}
        onSubmit={vi.fn()}
        onImport={vi.fn()}
      />,
    );

    expect(screen.getByText("How this works")).toBeInTheDocument();
    expect(screen.getByText(/current file or selection/)).toBeInTheDocument();
  });

  it("shows target and provider status", () => {
    render(
      <AssistantPane
        defaultProvider="anthropic-subscription"
        messages={[]}
        providerStatuses={{
          "anthropic-subscription": {
            provider: "anthropic-subscription",
            installed: true,
            authenticated: true,
            detail: "Connected with claude.ai.",
          },
        }}
        targetLabel="chapter-1.md"
        onSubmit={vi.fn()}
        onImport={vi.fn()}
      />,
    );

    expect(screen.getByText("chapter-1.md")).toBeInTheDocument();
    expect(screen.getByText("Connected")).toBeInTheDocument();
  });

  it("disables sending when no file is open", () => {
    render(
      <AssistantPane
        defaultProvider="openai-subscription"
        canSubmit={false}
        messages={[]}
        onSubmit={vi.fn()}
        onImport={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Open a file to send" }),
    ).toBeDisabled();
  });

  it("disables sending while a request is running", () => {
    render(
      <AssistantPane
        defaultProvider="openai-subscription"
        isRunning
        messages={[]}
        onSubmit={vi.fn()}
        onImport={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Working..." })).toBeDisabled();
  });

  it("passes the selected mode when importing a response", async () => {
    const user = userEvent.setup();
    const onImport = vi.fn();

    render(
      <AssistantPane
        defaultProvider="openai-subscription"
        messages={[]}
        onSubmit={vi.fn()}
        onImport={onImport}
      />,
    );

    await user.selectOptions(screen.getByLabelText("Mode"), "suggestions");
    await user.click(screen.getByText("Manual import"));
    await user.type(screen.getByLabelText("Import response"), "Raise the stakes.");
    await user.click(screen.getByRole("button", { name: "Import" }));

    expect(onImport).toHaveBeenCalledWith("Raise the stakes.", "suggestions");
  });

  it("renders assistant message history", () => {
    render(
      <AssistantPane
        defaultProvider="openai-subscription"
        messages={[{ role: "assistant", content: "Imported assistant result." }]}
        onSubmit={vi.fn()}
        onImport={vi.fn()}
      />,
    );

    expect(screen.getByText("Imported assistant result.")).toBeInTheDocument();
  });
});
