import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { defaultSettings } from "../state/appReducer";
import { SettingsDialog } from "./SettingsDialog";

describe("SettingsDialog", () => {
  it("saves edited settings", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();

    render(
      <SettingsDialog
        settings={defaultSettings}
        onSave={onSave}
        onClose={vi.fn()}
      />,
    );

    await user.selectOptions(
      screen.getByLabelText("Default provider"),
      "anthropic-subscription",
    );
    expect(screen.getByText("Provider connections")).toBeInTheDocument();
    expect(screen.getByText("codex login")).toBeInTheDocument();
    expect(screen.getByText("claude auth login")).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("OpenAI model"), "gpt-5.4");
    await user.selectOptions(screen.getByLabelText("OpenAI effort"), "high");
    await user.selectOptions(screen.getByLabelText("Claude model"), "opus");
    await user.selectOptions(screen.getByLabelText("Claude effort"), "max");
    await user.clear(screen.getByLabelText("LM Studio model"));
    await user.type(screen.getByLabelText("LM Studio model"), "mistral-local");
    await user.clear(screen.getByLabelText("Editor font size"));
    await user.type(screen.getByLabelText("Editor font size"), "20");
    await user.click(screen.getByLabelText("Ignore hidden files"));
    await user.click(screen.getByLabelText("Ignore binary files"));
    await user.click(screen.getByLabelText("Use project .env preferences"));
    await user.click(screen.getByText("Save settings"));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        defaultProvider: "anthropic-subscription",
        openaiModel: "gpt-5.4",
        openaiEffort: "high",
        anthropicModel: "opus",
        anthropicEffort: "max",
        lmStudioModel: "mistral-local",
        editorFontSize: 20,
        ignoreHidden: false,
        ignoreBinaryFiles: false,
        projectEnvEnabled: false,
      }),
    );
  });

  it("syncs the draft when asynchronously loaded settings arrive", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    const { rerender } = render(
      <SettingsDialog
        settings={defaultSettings}
        onSave={onSave}
        onClose={vi.fn()}
      />,
    );

    rerender(
      <SettingsDialog
        settings={{
          ...defaultSettings,
          defaultProvider: "anthropic-subscription",
          lmStudioModel: "custom-local",
        }}
        onSave={onSave}
        onClose={vi.fn()}
      />,
    );

    await user.click(screen.getByText("Save settings"));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        defaultProvider: "anthropic-subscription",
        lmStudioModel: "custom-local",
      }),
    );
  });

  it("exposes a reindex action when provided", async () => {
    const user = userEvent.setup();
    const onReindex = vi.fn();

    render(
      <SettingsDialog
        settings={defaultSettings}
        onSave={vi.fn()}
        onClose={vi.fn()}
        onReindex={onReindex}
      />,
    );

    await user.click(screen.getByText("Reindex project"));

    expect(onReindex).toHaveBeenCalled();
  });

  it("shows provider status and starts CLI login flows", async () => {
    const user = userEvent.setup();
    const onRefreshProviderStatuses = vi.fn();
    const onStartProviderLogin = vi.fn();

    render(
      <SettingsDialog
        settings={defaultSettings}
        providerStatuses={{
          "openai-subscription": {
            provider: "openai-subscription",
            installed: true,
            authenticated: true,
            detail: "Logged in using ChatGPT",
          },
          "anthropic-subscription": {
            provider: "anthropic-subscription",
            installed: true,
            authenticated: false,
            detail: "Claude Code is installed but not signed in.",
          },
        }}
        onSave={vi.fn()}
        onClose={vi.fn()}
        onRefreshProviderStatuses={onRefreshProviderStatuses}
        onStartProviderLogin={onStartProviderLogin}
      />,
    );

    expect(screen.getByText("Logged in using ChatGPT")).toBeInTheDocument();
    expect(screen.getByText("Claude Code is installed but not signed in.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Check" }));
    await user.click(screen.getAllByRole("button", { name: "Sign in" })[1]);

    expect(onRefreshProviderStatuses).toHaveBeenCalledOnce();
    expect(onStartProviderLogin).toHaveBeenCalledWith("anthropic-subscription");
  });
});
