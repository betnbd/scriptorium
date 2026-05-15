import { useEffect, useState } from "react";
import type { AppSettings, ProviderId } from "../types";

interface SettingsDialogProps {
  settings: AppSettings;
  onSave: (settings: AppSettings) => void | Promise<void>;
  onClose: () => void;
  onReindex?: () => void;
}

export function SettingsDialog({
  settings,
  onSave,
  onClose,
  onReindex,
}: SettingsDialogProps) {
  const [draft, setDraft] = useState(settings);

  useEffect(() => {
    setDraft(settings);
  }, [settings]);

  return (
    <div
      className="settings-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Settings"
    >
      <section className="settings-dialog">
        <header className="settings-header">
          <h2>Settings</h2>
          <button type="button" onClick={onClose}>
            Close
          </button>
        </header>

        <form
          className="settings-form"
          onSubmit={(event) => {
            event.preventDefault();
            void onSave(draft);
          }}
        >
          <label>
            Default provider
            <select
              value={draft.defaultProvider}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  defaultProvider: event.target.value as ProviderId,
                })
              }
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

          <section className="provider-login-settings">
            <h3>Subscription sign-in</h3>
            <p>
              DraftAgent uses your local CLI sessions for subscription-backed
              providers. Sign in once in a terminal, then return here.
            </p>
            <div>
              <span>OpenAI</span>
              <code>codex login</code>
            </div>
            <div>
              <span>Anthropic</span>
              <code>claude auth login</code>
            </div>
          </section>

          <label>
            LM Studio base URL
            <input
              value={draft.lmStudioBaseUrl}
              onChange={(event) =>
                setDraft({ ...draft, lmStudioBaseUrl: event.target.value })
              }
            />
          </label>

          <label>
            LM Studio model
            <input
              value={draft.lmStudioModel}
              onChange={(event) =>
                setDraft({ ...draft, lmStudioModel: event.target.value })
              }
            />
          </label>

          <div className="settings-number-row">
            <label>
              Editor font size
              <input
                min="12"
                max="28"
                type="number"
                value={draft.editorFontSize}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    editorFontSize: Number(event.target.value),
                  })
                }
              />
            </label>

            <label>
              Editor line width
              <input
                min="480"
                max="1100"
                step="20"
                type="number"
                value={draft.editorLineWidth}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    editorLineWidth: Number(event.target.value),
                  })
                }
              />
            </label>
          </div>

          <label className="settings-checkbox">
            <input
              checked={draft.ignoreHidden}
              type="checkbox"
              onChange={(event) =>
                setDraft({ ...draft, ignoreHidden: event.target.checked })
              }
            />
            Ignore hidden files
          </label>

          <label className="settings-checkbox">
            <input
              checked={draft.ignoreLargeFiles}
              type="checkbox"
              onChange={(event) =>
                setDraft({ ...draft, ignoreLargeFiles: event.target.checked })
              }
            />
            Ignore large files
          </label>

          <label className="settings-checkbox">
            <input
              checked={draft.ignoreBinaryFiles}
              type="checkbox"
              onChange={(event) =>
                setDraft({ ...draft, ignoreBinaryFiles: event.target.checked })
              }
            />
            Ignore binary files
          </label>

          <label className="settings-checkbox">
            <input
              checked={draft.projectEnvEnabled}
              type="checkbox"
              onChange={(event) =>
                setDraft({ ...draft, projectEnvEnabled: event.target.checked })
              }
            />
            Use project .env preferences
          </label>

          <div className="settings-actions">
            <button type="button" onClick={onClose}>
              Cancel
            </button>
            {onReindex ? (
              <button type="button" onClick={onReindex}>
                Reindex project
              </button>
            ) : null}
            <button type="submit">Save settings</button>
          </div>
        </form>
      </section>
    </div>
  );
}
