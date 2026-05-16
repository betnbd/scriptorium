import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AppMenuBar } from "./AppMenuBar";

function renderMenu(overrides = {}) {
  const props = {
    canSave: true,
    canUseEditor: true,
    canUseProject: true,
    editorMode: "visual" as const,
    onOpenFolder: vi.fn(),
    onOpenQuickly: vi.fn(),
    onCreateFile: vi.fn(),
    onCreateFolder: vi.fn(),
    onCloseFile: vi.fn(),
    onSave: vi.fn(),
    onSettings: vi.fn(),
    onReindex: vi.fn(),
    onResetLayout: vi.fn(),
    themeId: "paper" as const,
    onThemeChange: vi.fn(),
    onToggleEditorMode: vi.fn(),
    onEditorCommand: vi.fn(),
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

  it("applies themes from the theme menu", async () => {
    const user = userEvent.setup();
    const props = renderMenu();

    await user.click(screen.getByText("Themes"));
    await user.click(screen.getByRole("button", { name: "Catppuccin Mocha" }));

    expect(props.onThemeChange).toHaveBeenCalledWith("catppuccin-mocha");
  });

  it("allows reopening AI before a project is loaded", async () => {
    const user = userEvent.setup();
    const props = renderMenu({ canUseProject: false });

    await user.click(screen.getByText("AI"));
    await user.click(screen.getByRole("button", { name: "New Conversation" }));

    expect(props.onOpenAssistant).toHaveBeenCalledOnce();
  });

  it("routes paragraph and format commands to the editor", async () => {
    const user = userEvent.setup();
    const props = renderMenu();

    await user.click(screen.getByText("Paragraph"));
    await user.click(screen.getByRole("button", { name: "Heading 2" }));
    await user.click(screen.getByText("Format"));
    await user.click(screen.getByRole("button", { name: "Strong" }));

    expect(props.onEditorCommand).toHaveBeenNthCalledWith(1, "heading2");
    expect(props.onEditorCommand).toHaveBeenNthCalledWith(2, "bold");
  });

  it("toggles source mode from the view menu", async () => {
    const user = userEvent.setup();
    const props = renderMenu();

    await user.click(screen.getByText("View"));
    await user.click(screen.getByRole("button", { name: "Source Code Mode" }));

    expect(props.onToggleEditorMode).toHaveBeenCalledOnce();
  });
});
