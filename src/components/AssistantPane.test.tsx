import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultSettings } from "../state/appReducer";
import { AssistantPane } from "./AssistantPane";

function renderPane(overrides = {}) {
  const props = {
    settings: defaultSettings,
    messages: [],
    onSubmit: vi.fn(),
    onImport: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };

  render(<AssistantPane {...props} />);
  return props;
}

describe("AssistantPane", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts in chat mode and submits a clean in-app request", async () => {
    const user = userEvent.setup();
    const props = renderPane();

    expect(screen.getByRole("radio", { name: "Chat" })).toBeChecked();
    expect(screen.getByLabelText("Model")).toHaveValue("gpt-5.5");
    expect(screen.getByLabelText("Effort")).toHaveValue("medium");

    await user.type(screen.getByLabelText("Message"), "Make it sharper");
    await user.click(screen.getByRole("button", { name: "Send to OpenAI" }));

    expect(props.onSubmit).toHaveBeenCalledWith({
      provider: "openai-subscription",
      mode: "chat",
      instruction: "Make it sharper",
      model: "gpt-5.5",
      effort: "medium",
    });
    expect(screen.getByLabelText("Message")).toHaveValue("");
  });

  it("lets the user select provider, model, effort, and edit mode before sending", async () => {
    const user = userEvent.setup();
    const props = renderPane();

    await user.selectOptions(
      screen.getByLabelText("Provider"),
      "anthropic-subscription",
    );
    await user.selectOptions(screen.getByLabelText("Model"), "opus");
    await user.selectOptions(screen.getByLabelText("Effort"), "xhigh");
    await user.click(screen.getByRole("radio", { name: "Diff" }));
    await user.type(screen.getByLabelText("Message"), "Show exact edits");
    await user.click(screen.getByRole("button", { name: "Send to Claude" }));

    expect(props.onSubmit).toHaveBeenCalledWith({
      provider: "anthropic-subscription",
      mode: "diff",
      instruction: "Show exact edits",
      model: "opus",
      effort: "xhigh",
    });
  });

  it("uses the LM Studio model input for local requests", async () => {
    const user = userEvent.setup();
    const props = renderPane({
      settings: { ...defaultSettings, defaultProvider: "lm-studio" },
    });

    await user.clear(screen.getByLabelText("Model"));
    await user.type(screen.getByLabelText("Model"), "qwen-local");
    await user.type(screen.getByLabelText("Message"), "Read this scene");
    await user.click(screen.getByRole("button", { name: "Send to LM Studio" }));

    expect(props.onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "lm-studio",
        model: "qwen-local",
        effort: undefined,
      }),
    );
    expect(screen.queryByLabelText("Effort")).not.toBeInTheDocument();
  });

  it("imports a pasted assistant response using the selected mode", async () => {
    const user = userEvent.setup();
    const props = renderPane();

    await user.click(screen.getByRole("radio", { name: "Rewrite" }));
    await user.click(screen.getByText("Manual import"));
    await user.type(
      screen.getByLabelText("Import response"),
      "Use shorter sentences.",
    );
    await user.click(screen.getByRole("button", { name: "Import" }));

    expect(props.onImport).toHaveBeenCalledWith(
      "Use shorter sentences.",
      "rewrite",
    );
  });

  it("shows target, provider status, and clean message history", () => {
    renderPane({
      settings: { ...defaultSettings, defaultProvider: "anthropic-subscription" },
      messages: [
        { role: "user", content: "Can you read this document?" },
        { role: "assistant", content: "Yes. The glossary is readable." },
      ],
      providerStatuses: {
        "anthropic-subscription": {
          provider: "anthropic-subscription",
          installed: true,
          authenticated: true,
          detail: "Connected with claude.ai.",
        },
      },
      targetLabel: "chapter-1.md",
    });

    expect(screen.getByText("chapter-1.md")).toBeInTheDocument();
    expect(screen.getByText("Connected")).toBeInTheDocument();
    expect(screen.getByText("You")).toBeInTheDocument();
    expect(screen.getByText("Claude")).toBeInTheDocument();
    expect(screen.getByText("Can you read this document?")).toBeInTheDocument();
    expect(screen.queryByText(/Anthropic via Claude Code/)).not.toBeInTheDocument();
  });

  it("shows updating progress while a terminal agent is running", async () => {
    vi.useFakeTimers();

    renderPane({
      settings: { ...defaultSettings, defaultProvider: "anthropic-subscription" },
      isRunning: true,
      targetLabel: "COMPANION_NOTES.md",
    });

    expect(screen.getByText("Claude is working.")).toBeInTheDocument();
    expect(
      screen.getByText("Sent request to the terminal agent."),
    ).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });

    expect(screen.getByText("Reviewing COMPANION_NOTES.md.")).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(20_000);
    });

    expect(
      screen.getByText("Checking relevant project context."),
    ).toBeInTheDocument();
    expect(screen.getByText("Waiting for Claude's response.")).toBeInTheDocument();
  });

  it("shows pending assistant edits with apply and discard actions", async () => {
    const user = userEvent.setup();
    const onApplyPendingEdit = vi.fn();
    const onDiscardPendingEdit = vi.fn();
    renderPane({
      pendingEdit: {
        mode: "diff",
        response: "diff text",
        nextMarkdown: "# Revised",
      },
      onApplyPendingEdit,
      onDiscardPendingEdit,
    });

    expect(screen.getByText("Proposed edits ready")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Apply edits" }));
    await user.click(screen.getByRole("button", { name: "Discard" }));

    expect(onApplyPendingEdit).toHaveBeenCalledOnce();
    expect(onDiscardPendingEdit).toHaveBeenCalledOnce();
  });

  it("disables sending when there is no open file or no message", async () => {
    const user = userEvent.setup();
    renderPane({ canSubmit: false });

    expect(
      screen.getByRole("button", { name: "Open a file to send" }),
    ).toBeDisabled();

    cleanup();

    renderPane();
    expect(screen.getByRole("button", { name: "Send to OpenAI" })).toBeDisabled();
    await user.type(screen.getByLabelText("Message"), "Ready?");
    expect(screen.getByRole("button", { name: "Send to OpenAI" })).toBeEnabled();
  });

  it("closes the drawer on request", async () => {
    const user = userEvent.setup();
    const props = renderPane();

    await user.click(screen.getByRole("button", { name: "Hide" }));

    expect(props.onClose).toHaveBeenCalledOnce();
  });
});
