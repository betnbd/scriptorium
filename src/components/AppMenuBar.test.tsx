import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AppMenuBar } from "./AppMenuBar";

function renderMenu(overrides = {}) {
  const props = {
    canSave: true,
    canUseProject: true,
    onOpenFolder: vi.fn(),
    onCreateFile: vi.fn(),
    onCreateFolder: vi.fn(),
    onSave: vi.fn(),
    onSettings: vi.fn(),
    onReindex: vi.fn(),
    onResetLayout: vi.fn(),
    onOpenChatGpt: vi.fn(),
    onOpenClaude: vi.fn(),
    ...overrides,
  };

  render(<AppMenuBar {...props} />);
  return props;
}

describe("AppMenuBar", () => {
  it("exposes file actions in a desktop-style menu", async () => {
    const user = userEvent.setup();
    const props = renderMenu();

    await user.click(screen.getByText("File"));
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(props.onSave).toHaveBeenCalledOnce();
  });

  it("opens subscription providers from the assistant menu", async () => {
    const user = userEvent.setup();
    const props = renderMenu();

    await user.click(screen.getByText("Assistant"));
    await user.click(screen.getByRole("button", { name: "Open ChatGPT" }));
    await user.click(screen.getByRole("button", { name: "Open Claude" }));

    expect(props.onOpenChatGpt).toHaveBeenCalledOnce();
    expect(props.onOpenClaude).toHaveBeenCalledOnce();
  });
});
