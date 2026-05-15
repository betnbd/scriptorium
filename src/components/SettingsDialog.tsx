import { useEffect, useState } from "react";
import { CircleAlert, CircleCheck, RefreshCw, Terminal } from "lucide-react";
import type { AppSettings, ProviderId, ProviderStatus } from "../types";

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
            <div className="provider-login-header">
              <div>
                <h3>Provider connections</h3>
                <p>
                  DraftAgent never stores OpenAI or Anthropic passwords. It uses
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
