import { useEffect, useState } from "react";
import { CircleAlert, CircleCheck, RefreshCw, Terminal } from "lucide-react";
import type { AppSettings, ProviderId, ProviderStatus } from "../types";
import { editorFontOptions, themeOptions } from "../themeOptions";
import {
  anthropicEffortOptions,
  anthropicModelOptions,
  openaiEffortOptions,
  openaiModelOptions,
} from "../assistant/providerOptions";

interface SettingsDialogProps {
  settings: AppSettings;
  providerStatuses?: Partial<Record<SubscriptionProviderId, ProviderStatus>>;
  isProviderStatusLoading?: boolean;
  onSave: (settings: AppSettings) => void | Promise<void>;
  onClose: () => void;
  onReindex?: () => void;
  onRefreshProviderStatuses?: () => void;
  onStartProviderLogin?: (provider: SubscriptionProviderId) => void;
}

export function SettingsDialog({
  settings,
  providerStatuses = {},
  isProviderStatusLoading = false,
  onSave,
  onClose,
  onReindex,
  onRefreshProviderStatuses,
  onStartProviderLogin,
}: SettingsDialogProps) {
  const [draft, setDraft] = useState(settings);

  useEffect(() => {
    setDraft(settings);
  }, [settings]);

  return (
    <div className="settings-backdrop">
      <section
        aria-labelledby="settings-title"
        aria-modal="true"
        className="settings-dialog"
        role="dialog"
      >
        <header className="settings-header">
          <h2 id="settings-title">Settings</h2>
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
                <option value="anthropic-subscription">
                  Anthropic subscription via Claude Code
                </option>
                <option value="openai-subscription">
                  OpenAI subscription via Codex
                </option>
                <option value="lm-studio">LM Studio</option>
              </select>
          </label>

          <div className="settings-number-row">
            <label>
              Theme
              <select
                value={draft.themeId}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    themeId: event.target.value as AppSettings["themeId"],
                  })
                }
              >
                {themeOptions.map((theme) => (
                  <option key={theme.id} value={theme.id}>
                    {theme.label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Editor font
              <select
                value={draft.editorFont}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    editorFont: event.target.value as AppSettings["editorFont"],
                  })
                }
              >
                {editorFontOptions.map((font) => (
                  <option key={font.id} value={font.id}>
                    {font.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <section className="provider-login-settings">
            <div className="provider-login-header">
              <div>
                <h3>Provider connections</h3>
                <p>
                  Scriptorium never stores OpenAI or Anthropic passwords. It uses
                  the authenticated local CLI sessions on this computer.
                </p>
              </div>
              <button
                type="button"
                onClick={onRefreshProviderStatuses}
                disabled={isProviderStatusLoading}
              >
                <RefreshCw aria-hidden="true" size={14} />
                Check
              </button>
            </div>
            <ProviderConnectionRow
              command="codex login"
              label="OpenAI"
              status={providerStatuses["openai-subscription"]}
              onStartLogin={() => onStartProviderLogin?.("openai-subscription")}
            />
            <ProviderConnectionRow
              command="claude auth login"
              label="Claude Code"
              status={providerStatuses["anthropic-subscription"]}
              onStartLogin={() =>
                onStartProviderLogin?.("anthropic-subscription")
              }
            />
          </section>

          <section className="provider-model-settings">
            <h3>Default AI models</h3>
            <div className="settings-model-grid">
              <label>
                OpenAI model
                <select
                  value={draft.openaiModel}
                  onChange={(event) =>
                    setDraft({ ...draft, openaiModel: event.target.value })
                  }
                >
                  {openaiModelOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                OpenAI effort
                <select
                  value={draft.openaiEffort}
                  onChange={(event) =>
                    setDraft({ ...draft, openaiEffort: event.target.value })
                  }
                >
                  {openaiEffortOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Claude model
                <select
                  value={draft.anthropicModel}
                  onChange={(event) =>
                    setDraft({ ...draft, anthropicModel: event.target.value })
                  }
                >
                  {anthropicModelOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Claude effort
                <select
                  value={draft.anthropicEffort}
                  onChange={(event) =>
                    setDraft({ ...draft, anthropicEffort: event.target.value })
                  }
                >
                  {anthropicEffortOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
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
            Use project .scriptorium.env preferences
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

type SubscriptionProviderId = Extract<
  ProviderId,
  "openai-subscription" | "anthropic-subscription"
>;

function ProviderConnectionRow({
  label,
  command,
  status,
  onStartLogin,
}: {
  label: string;
  command: string;
  status?: ProviderStatus;
  onStartLogin: () => void;
}) {
  const connected = Boolean(status?.authenticated);
  const missing = status?.installed === false;

  return (
    <div className="provider-connection-row">
      <div
        className={
          connected
            ? "provider-connection-title is-connected"
            : "provider-connection-title"
        }
      >
        {connected ? (
          <CircleCheck aria-hidden="true" size={16} />
        ) : (
          <CircleAlert aria-hidden="true" size={16} />
        )}
        <span>{label}</span>
      </div>
      <div className={connected ? "status-pill is-connected" : "status-pill"}>
        {connected ? "Connected" : missing ? "CLI missing" : "Needs sign-in"}
      </div>
      <div className="provider-connection-detail">
        <code>{command}</code>
        <span>{status?.detail ?? "Status has not been checked yet."}</span>
      </div>
      <button type="button" onClick={onStartLogin}>
        <Terminal aria-hidden="true" size={14} />
        Sign in
      </button>
    </div>
  );
}
