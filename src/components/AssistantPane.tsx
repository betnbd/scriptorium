import { useEffect, useRef, useState } from "react";
import type {
  AppSettings,
  AssistantMessage,
  AssistantMode,
  AssistantPendingEdit,
  ProviderId,
  ProviderStatus,
} from "../types";
import {
  effortOptionsForProvider,
  modelOptionsForProvider,
} from "../assistant/providerOptions";
import { formatLocalDiff } from "../assistant/localDiff";

export interface AssistantRequest {
  provider: ProviderId;
  mode: AssistantMode;
  instruction: string;
  model: string;
  effort?: string;
}

interface AssistantPaneProps {
  settings: AppSettings;
  messages: AssistantMessage[];
  canSubmit?: boolean;
  isRunning?: boolean;
  pendingEdit?: AssistantPendingEdit | null;
  providerStatuses?: Partial<
    Record<
      Extract<ProviderId, "openai-subscription" | "anthropic-subscription">,
      ProviderStatus
    >
  >;
  targetLabel?: string | null;
  onSubmit: (request: AssistantRequest) => void;
  onImport: (response: string, mode: AssistantMode) => void;
  onApplyPendingEdit?: () => void;
  onRejectPendingEdit?: () => void;
  onClose: () => void;
}

export function AssistantPane({
  settings,
  messages,
  canSubmit = true,
  isRunning = false,
  pendingEdit = null,
  providerStatuses = {},
  targetLabel = null,
  onSubmit,
  onImport,
  onApplyPendingEdit,
  onRejectPendingEdit,
  onClose,
}: AssistantPaneProps) {
  const [provider, setProvider] = useState<ProviderId>(settings.defaultProvider);
  const [mode, setMode] = useState<AssistantMode>("chat");
  const [openaiModel, setOpenaiModel] = useState(settings.openaiModel);
  const [openaiEffort, setOpenaiEffort] = useState(settings.openaiEffort);
  const [anthropicModel, setAnthropicModel] = useState(settings.anthropicModel);
  const [anthropicEffort, setAnthropicEffort] = useState(
    settings.anthropicEffort,
  );
  const [lmStudioModel, setLmStudioModel] = useState(settings.lmStudioModel);
  const [instruction, setInstruction] = useState("");
  const [importText, setImportText] = useState("");
  const [showPendingDiff, setShowPendingDiff] = useState(false);
  const [runningElapsedSeconds, setRunningElapsedSeconds] = useState(0);
  const historyRef = useRef<HTMLDivElement | null>(null);
  const providerStatus =
    provider === "lm-studio" ? null : providerStatuses[provider];
  const isProviderBlocked =
    providerStatus !== null &&
    providerStatus !== undefined &&
    (!providerStatus.installed || !providerStatus.authenticated);
  const isEditBlockedByPendingEdit = mode === "edit" && Boolean(pendingEdit);
  const sendDisabled =
    isRunning ||
    !canSubmit ||
    isProviderBlocked ||
    isEditBlockedByPendingEdit ||
    !instruction.trim();
  const importDisabled = isEditBlockedByPendingEdit;
  const assistantLabel = assistantDisplayLabel(provider);
  const selectedModel = modelForProvider({
    provider,
    openaiModel,
    anthropicModel,
    lmStudioModel,
  });
  const selectedEffort = effortForProvider({
    provider,
    openaiEffort,
    anthropicEffort,
  });

  useEffect(() => {
    setProvider(settings.defaultProvider);
    setOpenaiModel(settings.openaiModel);
    setOpenaiEffort(settings.openaiEffort);
    setAnthropicModel(settings.anthropicModel);
    setAnthropicEffort(settings.anthropicEffort);
    setLmStudioModel(settings.lmStudioModel);
  }, [settings]);

  useEffect(() => {
    const history = historyRef.current;

    if (history) {
      history.scrollTop = history.scrollHeight;
    }
  }, [messages.length, isRunning, runningElapsedSeconds]);

  useEffect(() => {
    if (!isRunning) {
      setRunningElapsedSeconds(0);
      return;
    }

    setRunningElapsedSeconds(0);

    const interval = window.setInterval(() => {
      setRunningElapsedSeconds((seconds) => seconds + 10);
    }, 10_000);

    return () => window.clearInterval(interval);
  }, [isRunning]);

  useEffect(() => {
    setShowPendingDiff(false);
  }, [pendingEdit]);

  function submitMessage() {
    if (sendDisabled) {
      return;
    }

    onSubmit({
      provider,
      mode,
      instruction: instruction.trim(),
      model: selectedModel,
      effort: selectedEffort,
    });
    setInstruction("");
  }

  return (
    <aside className="assistant-pane" aria-label="AI conversation">
      <header className="assistant-header">
        <div>
          <h2>AI</h2>
          <p>{targetLabel ?? "Open a Markdown file"}</p>
        </div>
        <button type="button" className="assistant-close" onClick={onClose}>
          Hide
        </button>
      </header>

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
            Start a conversation about the open file.
          </div>
        )}
        {isRunning ? (
          <div className="assistant-run-status" role="status">
            <div>{assistantLabel} is working.</div>
            <ul>
              {runningStatusLines({
                assistantLabel,
                elapsedSeconds: runningElapsedSeconds,
                targetLabel,
              }).map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      {pendingEdit ? (
        <section className="assistant-pending-edit" aria-label="Staged AI edit">
          <div>
            <strong>Edit ready</strong>
            <span>Review the staged edit before saving.</span>
          </div>
          <div className="assistant-pending-actions">
            <button
              type="button"
              onClick={() => setShowPendingDiff((isVisible) => !isVisible)}
            >
              {showPendingDiff ? "Hide diff" : "Show diff"}
            </button>
            <button type="button" onClick={onRejectPendingEdit}>
              Reject edits
            </button>
            <button type="button" onClick={onApplyPendingEdit}>
              Keep edits
            </button>
          </div>
          {showPendingDiff ? (
            <pre className="assistant-pending-diff">
              {formatLocalDiff(
                pendingEdit.previousMarkdown,
                pendingEdit.nextMarkdown,
              )}
            </pre>
          ) : null}
        </section>
      ) : null}

      <div className="assistant-controls">
        <div className="assistant-field-grid">
          <label>
            Provider
            <select
              aria-label="Provider"
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
            Model
            {provider === "lm-studio" ? (
              <input
                aria-label="Model"
                value={lmStudioModel}
                onChange={(event) => setLmStudioModel(event.target.value)}
              />
            ) : (
              <select
                aria-label="Model"
                value={selectedModel}
                onChange={(event) =>
                  provider === "openai-subscription"
                    ? setOpenaiModel(event.target.value)
                    : setAnthropicModel(event.target.value)
                }
              >
                {modelOptionsForProvider(provider).map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            )}
          </label>

          {provider !== "lm-studio" ? (
            <label>
              Effort
              <select
                aria-label="Effort"
                value={selectedEffort}
                onChange={(event) =>
                  provider === "openai-subscription"
                    ? setOpenaiEffort(event.target.value)
                    : setAnthropicEffort(event.target.value)
                }
              >
                {effortOptionsForProvider(provider).map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>

        <div aria-label="Mode" className="mode-segment" role="radiogroup">
          {modeOptions.map((option) => (
            <label
              className={mode === option.value ? "is-active" : ""}
              key={option.value}
            >
              <input
                checked={mode === option.value}
                name="assistant-mode"
                onChange={() => setMode(option.value)}
                type="radio"
                value={option.value}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>

        <label>
          Message
          <textarea
            aria-label="Message"
            value={instruction}
            onChange={(event) => setInstruction(event.target.value)}
            rows={5}
          />
        </label>

        <div className="assistant-submit-row">
          <button type="button" disabled={sendDisabled} onClick={submitMessage}>
            {isEditBlockedByPendingEdit
              ? "Keep or reject edit first"
              : sendButtonLabel({ isRunning, canSubmit, isProviderBlocked, provider })}
          </button>
          {provider !== "lm-studio" ? (
            <span
              className={
                isProviderBlocked
                  ? "assistant-status is-blocked"
                  : "assistant-status"
              }
            >
              {providerStatusLabel(providerStatus, provider)}
            </span>
          ) : null}
        </div>
      </div>

      <details className="assistant-import">
        <summary>Paste response</summary>
        <label>
          Import response
          <textarea
            aria-label="Import response"
            value={importText}
            onChange={(event) => setImportText(event.target.value)}
            rows={8}
          />
        </label>

        <button
          type="button"
          disabled={importDisabled}
          onClick={() => onImport(importText, mode)}
        >
          Import
        </button>
      </details>
    </aside>
  );
}

function runningStatusLines({
  assistantLabel,
  elapsedSeconds,
  targetLabel,
}: {
  assistantLabel: string;
  elapsedSeconds: number;
  targetLabel: string | null;
}) {
  const target = targetLabel ?? "the open file";
  const lines = ["Sent request to the terminal agent."];

  if (elapsedSeconds >= 10) {
    lines.push(`Reviewing ${target}.`);
  }

  if (elapsedSeconds >= 20) {
    lines.push("Checking relevant project context.");
  }

  if (elapsedSeconds >= 30) {
    lines.push(`Waiting for ${assistantLabel}'s response.`);
  }

  if (elapsedSeconds >= 60) {
    lines.push(`${formatElapsedTime(elapsedSeconds)} elapsed.`);
  }

  return lines;
}

function formatElapsedTime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
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

const modeOptions: Array<{ value: AssistantMode; label: string }> = [
  { value: "chat", label: "Chat" },
  { value: "edit", label: "Edit" },
];

function messageLabel(role: AssistantMessage["role"], assistantLabel: string) {
  if (role === "user") {
    return "You";
  }

  if (role === "assistant") {
    return assistantLabel;
  }

  return "Status";
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

function modelForProvider({
  provider,
  openaiModel,
  anthropicModel,
  lmStudioModel,
}: {
  provider: ProviderId;
  openaiModel: string;
  anthropicModel: string;
  lmStudioModel: string;
}) {
  if (provider === "openai-subscription") {
    return openaiModel;
  }

  if (provider === "anthropic-subscription") {
    return anthropicModel;
  }

  return lmStudioModel;
}

function effortForProvider({
  provider,
  openaiEffort,
  anthropicEffort,
}: {
  provider: ProviderId;
  openaiEffort: string;
  anthropicEffort: string;
}) {
  if (provider === "openai-subscription") {
    return openaiEffort;
  }

  if (provider === "anthropic-subscription") {
    return anthropicEffort;
  }

  return undefined;
}
