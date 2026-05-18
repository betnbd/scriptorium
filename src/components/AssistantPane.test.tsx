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

  it("starts in edit mode on Anthropic Opus and submits a clean in-app request", async () => {
    const user = userEvent.setup();
    const props = renderPane();

    expect(screen.getByRole("radio", { name: "Edit" })).toBeChecked();
    expect(screen.getByLabelText("Provider")).toHaveValue("anthropic-subscription");
    expect(screen.getByLabelText("Model")).toHaveValue("opus");
    expect(screen.getByLabelText("Effort")).toHaveValue("medium");

    await user.type(screen.getByLabelText("Message"), "Make it sharper");
    await user.click(screen.getByRole("button", { name: "Send to Claude" }));

    expect(props.onSubmit).toHaveBeenCalledWith({
      provider: "anthropic-subscription",
      mode: "edit",
      instruction: "Make it sharper",
      model: "opus",
      effort: "medium",
    });
    expect(screen.getByLabelText("Message")).toHaveValue("");
  });

  it("lists Claude before OpenAI in the provider picker", () => {
    renderPane();

    const options = Array.from(
      screen.getByLabelText("Provider").querySelectorAll("option"),
    ).map((option) => option.textContent);

    expect(options).toEqual([
      "Anthropic subscription via Claude Code",
      "OpenAI subscription via Codex",
      "LM Studio",
    ]);
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
    await user.click(screen.getByRole("radio", { name: "Edit" }));
    await user.type(screen.getByLabelText("Message"), "Revise this scene");
    await user.click(screen.getByRole("button", { name: "Send to Claude" }));

    expect(props.onSubmit).toHaveBeenCalledWith({
      provider: "anthropic-subscription",
      mode: "edit",
      instruction: "Revise this scene",
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

    await user.click(screen.getByRole("radio", { name: "Edit" }));
    await user.click(screen.getByText("Paste response"));
    await user.type(
      screen.getByLabelText("Import response"),
      "Use shorter sentences.",
    );
    await user.click(screen.getByRole("button", { name: "Import" }));

    expect(props.onImport).toHaveBeenCalledWith(
      "Use shorter sentences.",
      "edit",
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
    const onRejectPendingEdit = vi.fn();
    const onPendingDiffVisibilityChange = vi.fn();
    renderPane({
      isPendingDiffVisible: true,
      pendingEdit: {
        mode: "edit",
        response: "edit text",
        previousMarkdown: "# Original line",
        nextMarkdown: "# Revised line",
      },
      onApplyPendingEdit,
      onRejectPendingEdit,
      onPendingDiffVisibilityChange,
    });

    expect(screen.getByText("Edit ready")).toBeInTheDocument();
    expect(screen.getByText("Review the staged edit before saving.")).toBeInTheDocument();
    expect(screen.getByText("Diff shown in the editor pane.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Hide diff" }));
    await user.click(screen.getByRole("button", { name: "Keep edits" }));
    await user.click(screen.getByRole("button", { name: "Reject edits" }));

    expect(onPendingDiffVisibilityChange).toHaveBeenCalledWith(false);
    expect(onApplyPendingEdit).toHaveBeenCalledOnce();
    expect(onRejectPendingEdit).toHaveBeenCalledOnce();
  });

  it("blocks a second edit request until the staged edit is resolved", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    renderPane({
      pendingEdit: {
        mode: "edit",
        response: "edit text",
        previousMarkdown: "Old",
        nextMarkdown: "New",
      },
      onSubmit,
    });

    await user.click(screen.getByRole("radio", { name: "Edit" }));
    await user.type(screen.getByLabelText("Message"), "Revise again");

    expect(
      screen.getByRole("button", { name: "Keep or reject edit first" }),
    ).toBeDisabled();
    await user.click(screen.getByText("Paste response"));
    expect(screen.getByRole("button", { name: "Import" })).toBeDisabled();

    await user.click(screen.getByRole("radio", { name: "Chat" }));
    expect(screen.getByRole("button", { name: "Send to Claude" })).toBeEnabled();
  });

  it("disables sending when there is no open file or no message", async () => {
    const user = userEvent.setup();
    renderPane({ canSubmit: false });

    expect(
      screen.getByRole("button", { name: "Open a file to send" }),
    ).toBeDisabled();

    cleanup();

    renderPane();
    expect(screen.getByRole("button", { name: "Send to Claude" })).toBeDisabled();
    await user.type(screen.getByLabelText("Message"), "Ready?");
    expect(screen.getByRole("button", { name: "Send to Claude" })).toBeEnabled();
  });

  it("closes the drawer on request", async () => {
    const user = userEvent.setup();
    const props = renderPane();

    await user.click(screen.getByRole("button", { name: "Hide" }));

    expect(props.onClose).toHaveBeenCalledOnce();
  });
});
