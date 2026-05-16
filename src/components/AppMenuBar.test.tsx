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
    onOpenAssistant: vi.fn(),
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

  it("mirrors a Typora-style menu row with AI actions", async () => {
    const user = userEvent.setup();
    const props = renderMenu();

    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Paragraph" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Format" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Themes" })).toBeInTheDocument();
    await user.click(screen.getByText("AI"));
    await user.click(screen.getByRole("button", { name: "New Conversation" }));
    await user.click(screen.getByText("AI"));
    await user.click(screen.getByRole("button", { name: "Provider Settings" }));

    expect(props.onOpenAssistant).toHaveBeenCalledOnce();
    expect(props.onSettings).toHaveBeenCalledOnce();
  });

  it("allows reopening AI before a project is loaded", async () => {
    const user = userEvent.setup();
    const props = renderMenu({ canUseProject: false });

    await user.click(screen.getByText("AI"));
    await user.click(screen.getByRole("button", { name: "New Conversation" }));

    expect(props.onOpenAssistant).toHaveBeenCalledOnce();
  });
});
