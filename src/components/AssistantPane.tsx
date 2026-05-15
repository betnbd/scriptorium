import { useState } from "react";
import type { AssistantMode, ProviderId } from "../types";

export interface AssistantRequest {
  provider: ProviderId;
  mode: AssistantMode;
  instruction: string;
}

interface AssistantPaneProps {
  defaultProvider: ProviderId;
  onSubmit: (request: AssistantRequest) => void;
  onImport: (response: string) => void;
}

export function AssistantPane({
  defaultProvider,
  onSubmit,
  onImport,
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

        <button type="button" onClick={() => onImport(importText)}>
          Import
        </button>
      </div>
    </aside>
  );
}
