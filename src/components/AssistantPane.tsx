import { useEffect, useRef, useState } from "react";
import type {
  AssistantMessage,
  AssistantMode,
  ProviderId,
  ProviderStatus,
} from "../types";

export interface AssistantRequest {
  provider: ProviderId;
  mode: AssistantMode;
  instruction: string;
}

interface AssistantPaneProps {
  defaultProvider: ProviderId;
  messages: AssistantMessage[];
  canSubmit?: boolean;
  isRunning?: boolean;
  providerStatuses?: Partial<
    Record<
      Extract<ProviderId, "openai-subscription" | "anthropic-subscription">,
      ProviderStatus
    >
  >;
  targetLabel?: string | null;
  onSubmit: (request: AssistantRequest) => void;
  onImport: (response: string, mode: AssistantMode) => void;
}

export function AssistantPane({
  defaultProvider,
  messages,
  canSubmit = true,
  isRunning = false,
  providerStatuses = {},
  targetLabel = null,
  onSubmit,
  onImport,
}: AssistantPaneProps) {
  const [provider, setProvider] = useState<ProviderId>(defaultProvider);
  const [mode, setMode] = useState<AssistantMode>("rewrite");
  const [instruction, setInstruction] = useState("");
  const [importText, setImportText] = useState("");
  const historyRef = useRef<HTMLDivElement | null>(null);
  const providerStatus =
    provider === "lm-studio" ? null : providerStatuses[provider];
  const isProviderBlocked =
    providerStatus !== null &&
    providerStatus !== undefined &&
    (!providerStatus.installed || !providerStatus.authenticated);
  const sendDisabled = isRunning || !canSubmit || isProviderBlocked;
  const assistantLabel = assistantDisplayLabel(provider);

  useEffect(() => {
    const history = historyRef.current;

    if (history) {
      history.scrollTop = history.scrollHeight;
    }
  }, [messages.length, isRunning]);

  function submitMessage() {
    onSubmit({ provider, mode, instruction });
    setInstruction("");
  }

  return (
    <aside className="assistant-pane">
      <header className="assistant-header">
        <h2>Assistant</h2>
      </header>

      <div className="assistant-provider-note">
        <strong>Terminal-backed conversation</strong>
        <span>
          DraftAgent runs the selected provider CLI in the background, sends the
          current file or selection with relevant context, captures the response,
          and applies requested rewrites or diffs in the editor.
        </span>
      </div>

      <div
        aria-label="Assistant history"
        aria-live="polite"
        className="assistant-history"
        ref={historyRef}
      >
        {messages.length > 0 ? (
          messages.map((message, index) => (
            <article
              className={`assistant-message assistant-message-${message.role}`}
              key={`${message.role}-${index}`}
            >
              <div className="assistant-message-label">
                {messageLabel(message.role, assistantLabel)}
              </div>
              <pre>{message.content}</pre>
            </article>
          ))
        ) : (
          <div className="assistant-empty">
            Ask about the open file, request a rewrite, or ask for proposed edits.
          </div>
        )}
        {isRunning ? (
          <div className="assistant-run-status" role="status">
            Running {assistantLabel} in the background...
          </div>
        ) : null}
      </div>

      <div className="assistant-controls">
        <div className="assistant-runtime">
          <span>
            Target
            <strong>{targetLabel ?? "Open a Markdown file"}</strong>
          </span>
          <span>
            Provider
            <strong>{providerStatusLabel(providerStatus, provider)}</strong>
          </span>
        </div>

        <label>
          Provider
          <select
            value={provider}
            onChange={(event) => setProvider(event.target.value as ProviderId)}
          >
            <option value="openai-subscription">
              OpenAI subscription via Codex
            </option>
            <option value="anthropic-subscription">
              Anthropic subscription via Claude Code
            </option>
            <option value="lm-studio">LM Studio</option>
          </select>
        </label>

        <label>
          Mode
          <select
            value={mode}
            onChange={(event) => setMode(event.target.value as AssistantMode)}
          >
            <option value="rewrite">Full rewrite</option>
            <option value="diff">Proposed edits</option>
            <option value="suggestions">Suggestions</option>
          </select>
        </label>

        <label>
          Message
          <textarea
            value={instruction}
            onChange={(event) => setInstruction(event.target.value)}
            rows={5}
          />
        </label>

        <button
          type="button"
          disabled={sendDisabled}
          onClick={submitMessage}
        >
          {sendButtonLabel({ isRunning, canSubmit, isProviderBlocked, provider })}
        </button>
      </div>

      <details className="assistant-import">
        <summary>Manual import</summary>
        <label>
          Import response
          <textarea
            value={importText}
            onChange={(event) => setImportText(event.target.value)}
            rows={8}
          />
        </label>

        <button type="button" onClick={() => onImport(importText, mode)}>
          Import
        </button>
      </details>

    </aside>
  );
}

function assistantDisplayLabel(provider: ProviderId) {
  if (provider === "anthropic-subscription") {
    return "Claude";
  }

  if (provider === "openai-subscription") {
    return "OpenAI";
  }

  return "LM Studio";
}

function messageLabel(role: AssistantMessage["role"], assistantLabel: string) {
  if (role === "user") {
    return "You";
  }

  if (role === "assistant") {
    return assistantLabel;
  }

  return "DraftAgent";
}

function providerStatusLabel(
  status: ProviderStatus | null | undefined,
  provider: ProviderId,
) {
  if (provider === "lm-studio") {
    return "Local server";
  }

  if (!status) {
    return "Checking...";
  }

  if (!status.installed) {
    return "CLI not found";
  }

  return status.authenticated ? "Connected" : "Sign in needed";
}

function sendButtonLabel({
  isRunning,
  canSubmit,
  isProviderBlocked,
  provider,
}: {
  isRunning: boolean;
  canSubmit: boolean;
  isProviderBlocked: boolean;
  provider: ProviderId;
}) {
  if (isRunning) {
    return "Working...";
  }

  if (!canSubmit) {
    return "Open a file to send";
  }

  if (isProviderBlocked) {
    return "Sign in in Settings";
  }

  if (provider === "anthropic-subscription") {
    return "Send to Claude";
  }

  if (provider === "openai-subscription") {
    return "Send to OpenAI";
  }

  return "Send to LM Studio";
}
