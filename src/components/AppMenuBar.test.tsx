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
    onResetAssistant: vi.fn(),
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

  it("exposes assistant session actions from the assistant menu", async () => {
    const user = userEvent.setup();
    const props = renderMenu();

    await user.click(screen.getByText("Assistant"));
    await user.click(screen.getByRole("button", { name: "Reset Conversation" }));
    await user.click(screen.getByRole("button", { name: "Provider Settings" }));

    expect(props.onResetAssistant).toHaveBeenCalledOnce();
    expect(props.onSettings).toHaveBeenCalledOnce();
  });
});
