import { useState } from "react";
import { ExternalLink } from "lucide-react";
import type { AssistantMessage, AssistantMode, ProviderId } from "../types";

export interface AssistantRequest {
  provider: ProviderId;
  mode: AssistantMode;
  instruction: string;
}

interface AssistantPaneProps {
  defaultProvider: ProviderId;
  messages: AssistantMessage[];
  onSubmit: (request: AssistantRequest) => void;
  onImport: (response: string, mode: AssistantMode) => void;
  onOpenProvider?: (provider: Extract<ProviderId, "openai-subscription" | "anthropic-subscription">) => void;
}

export function AssistantPane({
  defaultProvider,
  messages,
  onSubmit,
  onImport,
  onOpenProvider,
}: AssistantPaneProps) {
  const [provider, setProvider] = useState<ProviderId>(defaultProvider);
  const [mode, setMode] = useState<AssistantMode>("rewrite");
  const [instruction, setInstruction] = useState("");
  const [importText, setImportText] = useState("");

  return (
    <aside className="assistant-pane">
      <header className="assistant-header">
        <h2>Assistant</h2>
      </header>

      <div className="assistant-subscriptions" aria-label="Subscription login">
        <button
          type="button"
          onClick={() => onOpenProvider?.("openai-subscription")}
        >
          <ExternalLink aria-hidden="true" size={15} />
          Open ChatGPT
        </button>
        <button
          type="button"
          onClick={() => onOpenProvider?.("anthropic-subscription")}
        >
          <ExternalLink aria-hidden="true" size={15} />
          Open Claude
        </button>
      </div>

      <div className="assistant-controls">
        <label>
          Provider
          <select
            value={provider}
            onChange={(event) => setProvider(event.target.value as ProviderId)}
          >
            <option value="openai-subscription">OpenAI subscription</option>
            <option value="anthropic-subscription">Anthropic subscription</option>
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
          Instruction
          <textarea
            value={instruction}
            onChange={(event) => setInstruction(event.target.value)}
            rows={5}
          />
        </label>

        <button
          type="button"
          onClick={() => onSubmit({ provider, mode, instruction })}
        >
          Prepare
        </button>
      </div>

      <div className="assistant-import">
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
      </div>

      {messages.length > 0 ? (
        <div className="assistant-history" aria-label="Assistant history">
          {messages.map((message, index) => (
            <article
              className="assistant-message"
              key={`${message.role}-${index}`}
            >
              <pre>{message.content}</pre>
            </article>
          ))}
        </div>
      ) : null}
    </aside>
  );
}
