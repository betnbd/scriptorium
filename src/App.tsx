import { useEffect, useReducer, useRef, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import { tauriApi } from "./api/tauri";
import { applyAssistantResult } from "./assistant/applyResult";
import { buildAssistantPrompt } from "./assistant/promptBuilder";
import { parseAssistantResponse } from "./assistant/responseParser";
import { AppMenuBar } from "./components/AppMenuBar";
import {
  AssistantPane,
  type AssistantRequest,
} from "./components/AssistantPane";
import { EditorPane } from "./components/EditorPane";
import { FileTree } from "./components/FileTree";
import { SettingsDialog } from "./components/SettingsDialog";
import { buildIndex, selectRelevantContext } from "./context/indexer";
import { normalizeMarkdownForSave } from "./editor/markdown";
import { appReducer, initialAppState } from "./state/appReducer";
import { shouldSwitchFile } from "./state/guards";
import {
  defaultPaneLayout,
  resetPaneLayout,
  resizePaneLayout,
  type PaneLayout,
  type ResizePane,
} from "./state/layout";
import type {
  AppSettings,
  AssistantMode,
  FileNode,
  IndexedDocument,
  ProviderStatus,
} from "./types";
import "./styles.css";

export default function App() {
  const [state, dispatch] = useReducer(appReducer, initialAppState);
  const [providerStatuses, setProviderStatuses] = useState<
    Partial<Record<SubscriptionProviderId, ProviderStatus>>
  >({});
  const [isProviderStatusLoading, setIsProviderStatusLoading] = useState(false);
  const [assistantSelection, setAssistantSelection] = useState<string | null>(
    null,
  );
  const [assistantMode, setAssistantMode] = useState<AssistantMode>("rewrite");
  const [isAssistantRunning, setIsAssistantRunning] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [hasLocalSettings, setHasLocalSettings] = useState(false);
  const [paneLayout, setPaneLayout] =
    useState<PaneLayout>(defaultPaneLayout);
  const [activeResizePane, setActiveResizePane] =
    useState<ResizePane | null>(null);
  const resizeStateRef = useRef<{
    pane: ResizePane;
    startX: number;
    layout: PaneLayout;
  } | null>(null);
  const liveEditorRef = useRef<{
    relativePath: string | null;
    markdown: string;
  }>({ relativePath: null, markdown: "" });
  liveEditorRef.current = {
    relativePath: state.openFile?.relativePath ?? null,
    markdown: state.openMarkdown,
  };
  const editorSettingsStyle = {
    "--editor-font-size": `${state.settings.editorFontSize}px`,
    "--editor-line-width": `${state.settings.editorLineWidth}px`,
    "--file-pane-width": `${paneLayout.filePaneWidth}px`,
    "--assistant-pane-width": `${paneLayout.assistantPaneWidth}px`,
  } as CSSProperties;

  useEffect(() => {
    if (!activeResizePane) {
      return undefined;
    }

    function onPointerMove(event: PointerEvent) {
      const resizeState = resizeStateRef.current;

      if (!resizeState) {
        return;
      }

      setPaneLayout(
        resizePaneLayout({
          layout: resizeState.layout,
          pane: resizeState.pane,
          deltaX: event.clientX - resizeState.startX,
        }),
      );
    }

    function onPointerUp() {
      resizeStateRef.current = null;
      setActiveResizePane(null);
    }

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [activeResizePane]);

  useEffect(() => {
    let isMounted = true;

    void tauriApi
      .loadSettings()
      .then((settings) => {
        if (isMounted && settings) {
          setHasLocalSettings(true);
          dispatch({ type: "settingsLoaded", settings });
        }
      })
      .catch((error) => {
        console.error(error);
        if (isMounted) {
          dispatch({ type: "errorShown", message: messageFromError(error) });
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    void refreshProviderStatuses();
  }, []);

  async function refreshTree(rootPath = state.rootPath) {
    if (!rootPath) {
      return [];
    }

    const tree = await tauriApi.readProjectTree(rootPath, state.settings);
    const indexedDocuments = await buildMarkdownIndex(
      rootPath,
      tree,
      state.settings,
    );

    dispatch({
      type: "treeUpdated",
      tree,
      indexedDocuments,
    });

    return tree;
  }

  async function openFolder() {
    if (!shouldSwitchFile(state.isDirty, confirmDiscardChanges)) {
      return;
    }

    try {
      const project = await tauriApi.pickProjectFolder();

      if (!project) {
        return;
      }

      const projectSettings = await loadProjectEnvSettings(
        project.rootPath,
        state.settings,
      );
      const effectiveSettings = projectSettings
        ? hasLocalSettings
          ? { ...projectSettings, ...state.settings }
          : { ...state.settings, ...projectSettings }
        : state.settings;
      const tree = await tauriApi.readProjectTree(
        project.rootPath,
        effectiveSettings,
      );
      const indexedDocuments = await buildMarkdownIndex(
        project.rootPath,
        tree,
        effectiveSettings,
      );

      setAssistantSelection(null);
      dispatch({
        type: "projectOpened",
        rootPath: project.rootPath,
        tree,
        indexedDocuments,
      });
      if (projectSettings) {
        dispatch({ type: "settingsLoaded", settings: effectiveSettings });
      }
    } catch (error) {
      showError(error);
    }
  }

  async function openFile(path: string) {
    if (!state.rootPath) {
      return;
    }

    if (!shouldSwitchFile(state.isDirty, confirmDiscardChanges)) {
      return;
    }

    try {
      const opened = await tauriApi.readMarkdownFile(state.rootPath, path);

      setAssistantSelection(null);
      dispatch({
        type: "fileOpened",
        file: opened.file,
        markdown: opened.markdown,
      });
    } catch (error) {
      showError(error);
    }
  }

  async function saveFile() {
    if (!state.rootPath || !state.openFile) {
      return;
    }

    const markdown = normalizeMarkdownForSave(state.openMarkdown);
    const openFile = state.openFile;

    try {
      await tauriApi.writeMarkdownFile(
        state.rootPath,
        openFile.relativePath,
        markdown,
      );

      dispatch({ type: "fileSaved", markdown });

      if (openFile.isMarkdown) {
        dispatch({
          type: "indexedDocumentUpdated",
          document: indexMarkdownFile(openFile, markdown),
        });
      }
    } catch (error) {
      showError(error);
    }
  }

  async function saveSettings(settings: AppSettings) {
    try {
      await tauriApi.saveSettings(settings);
      setHasLocalSettings(true);
      dispatch({ type: "settingsLoaded", settings });
      setIsSettingsOpen(false);
      if (state.rootPath) {
        const tree = await tauriApi.readProjectTree(state.rootPath, settings);
        const indexedDocuments = await buildMarkdownIndex(
          state.rootPath,
          tree,
          settings,
        );
        dispatch({ type: "treeUpdated", tree, indexedDocuments });
      }
    } catch (error) {
      showError(error);
    }
  }

  async function refreshProviderStatuses() {
    setIsProviderStatusLoading(true);

    try {
      const results = await Promise.allSettled(
        subscriptionProviders.map(async (provider) => {
          const status = await tauriApi.checkCliAgentStatus(provider);
          return [provider, status] as const;
        }),
      );

      setProviderStatuses(
        Object.fromEntries(
          results.map((result, index) => {
            const provider = subscriptionProviders[index];

            if (result.status === "fulfilled") {
              return result.value;
            }

            return [
              provider,
              {
                provider,
                installed: false,
                authenticated: false,
                detail: messageFromError(result.reason),
              },
            ] as const;
          }),
        ),
      );
    } finally {
      setIsProviderStatusLoading(false);
    }
  }

  async function startProviderLogin(provider: SubscriptionProviderId) {
    try {
      await tauriApi.startCliAgentLogin(provider);
    } catch (error) {
      showError(error);
    }
  }

  async function createFile(parentPath: string) {
    if (!state.rootPath) {
      return;
    }

    const name = window.prompt("New file path");

    if (!name?.trim()) {
      return;
    }

    try {
      await tauriApi.createFile(
        state.rootPath,
        joinRelativePath(parentPath, name),
      );
      await refreshTree();
    } catch (error) {
      showError(error);
    }
  }

  async function createFolder(parentPath: string) {
    if (!state.rootPath) {
      return;
    }

    const name = window.prompt("New folder path");

    if (!name?.trim()) {
      return;
    }

    try {
      await tauriApi.createFolder(
        state.rootPath,
        joinRelativePath(parentPath, name),
      );
      await refreshTree();
    } catch (error) {
      showError(error);
    }
  }

  async function renameEntry(path: string) {
    if (!state.rootPath) {
      return;
    }

    const newName = window.prompt("New name", basename(path));

    if (!newName?.trim()) {
      return;
    }

    const trimmedName = newName.trim();
    const nextPath = renameRelativePath(path, trimmedName);

    try {
      await tauriApi.renameEntry(state.rootPath, path, trimmedName);

      const tree = await refreshTree();
      syncOpenFileAfterPathChange(path, nextPath, tree);
    } catch (error) {
      showError(error);
    }
  }

  async function deleteEntry(path: string) {
    if (!state.rootPath) {
      return;
    }

    const isOpenEntry = pathAffectsOpenFile(path);
    const message =
      isOpenEntry && state.isDirty
        ? `Delete ${path} and discard unsaved changes?`
        : `Delete ${path}?`;

    if (!window.confirm(message)) {
      return;
    }

    try {
      await tauriApi.deleteEntry(state.rootPath, path);
      await refreshTree();

      if (isOpenEntry) {
        setAssistantSelection(null);
        dispatch({ type: "fileClosed" });
      }
    } catch (error) {
      showError(error);
    }
  }

  async function moveEntry(path: string) {
    if (!state.rootPath) {
      return;
    }

    const newPath = window.prompt("Move to path", path);

    if (!newPath?.trim()) {
      return;
    }

    const nextPath = trimRelativePath(newPath);

    try {
      await tauriApi.moveEntry(state.rootPath, path, nextPath);

      const tree = await refreshTree();
      syncOpenFileAfterPathChange(path, nextPath, tree);
    } catch (error) {
      showError(error);
    }
  }

  function confirmDiscardChanges() {
    return window.confirm("Discard unsaved changes?");
  }

  async function reindexProject(rootPath = state.rootPath) {
    try {
      await refreshTree(rootPath);
    } catch (error) {
      showError(error);
    }
  }

  function showError(error: unknown) {
    dispatch({ type: "errorShown", message: messageFromError(error) });
  }

  function startPaneResize(
    pane: ResizePane,
    event: ReactPointerEvent<HTMLDivElement>,
  ) {
    event.preventDefault();
    resizeStateRef.current = {
      pane,
      startX: event.clientX,
      layout: paneLayout,
    };
    setActiveResizePane(pane);
  }

  function pathAffectsOpenFile(path: string) {
    return state.openFile
      ? isSamePathOrDescendant(state.openFile.relativePath, path)
      : false;
  }

  function syncOpenFileAfterPathChange(
    oldPath: string,
    newPath: string,
    tree: FileNode[],
  ) {
    if (!state.openFile) {
      return;
    }

    const nextOpenPath = replacePathPrefix(
      state.openFile.relativePath,
      oldPath,
      newPath,
    );

    if (!nextOpenPath) {
      return;
    }

    const file = findFileNode(tree, nextOpenPath);

    dispatch(file ? { type: "openFileMetadataUpdated", file } : { type: "fileClosed" });
  }

  async function submitAssistantRequest(request: AssistantRequest) {
    if (!state.rootPath || !state.openFile || isAssistantRunning) {
      return;
    }

    try {
      setIsAssistantRunning(true);
      setAssistantMode(request.mode);

      const submittedFilePath = state.openFile.relativePath;
      const submittedMarkdown = state.openMarkdown;
      const targetMarkdown = assistantSelection?.trim()
        ? assistantSelection
        : state.openMarkdown;
      const context = selectRelevantContext({
        documents: state.indexedDocuments,
        targetPath: state.openFile.path,
        instruction: `${request.instruction}\n${targetMarkdown}`,
        limit: 4,
      });
      const prompt = buildAssistantPrompt({
        mode: request.mode,
        instruction: request.instruction,
        targetLabel: assistantSelection?.trim()
          ? `${state.openFile.relativePath} (current selection)`
          : state.openFile.relativePath,
        targetMarkdown,
        projectFiles: flattenProjectFilePaths(state.tree),
        context,
      });
      dispatch({
        type: "assistantMessageAdded",
        message: {
          role: "user",
          content: formatAssistantUserMessage(request, submittedFilePath),
        },
      });

      if (request.provider === "lm-studio") {
        const response = await tauriApi.sendLmStudioRequest(
          state.settings.lmStudioBaseUrl,
          state.settings.lmStudioModel,
          prompt,
        );

        importAssistantResponse(
          response,
          request.mode,
          submittedFilePath,
          submittedMarkdown,
        );
        return;
      }

      const response = await tauriApi.sendCliAgentRequest(
        request.provider,
        state.rootPath,
        prompt,
      );

      importAssistantResponse(
        response,
        request.mode,
        submittedFilePath,
        submittedMarkdown,
      );
    } catch (error) {
      showError(error);
    } finally {
      setIsAssistantRunning(false);
    }
  }

  function importAssistantResponse(
    response: string,
    mode = assistantMode,
    expectedFilePath?: string,
    expectedMarkdown?: string,
  ) {
    if (!response.trim()) {
      return;
    }

    if (expectedFilePath && liveEditorRef.current.relativePath !== expectedFilePath) {
      return;
    }

    if (
      expectedMarkdown !== undefined &&
      liveEditorRef.current.markdown !== expectedMarkdown
    ) {
      showError("The open file changed before the LM Studio response returned.");
      return;
    }

    try {
      const parsed = parseAssistantResponse(mode, response);
      const currentMarkdown =
        expectedFilePath === undefined
          ? state.openMarkdown
          : liveEditorRef.current.markdown;
      const nextMarkdown = applyAssistantResult(currentMarkdown, parsed);

      setAssistantMode(mode);

      if (nextMarkdown !== state.openMarkdown) {
        dispatch({ type: "editorChanged", markdown: nextMarkdown });
      }

      dispatch({
        type: "assistantMessageAdded",
        message: {
          role: "assistant",
          content:
            parsed.kind === "suggestions"
              ? parsed.suggestions
              : parsed.kind === "diff"
                ? "Applied proposed edits to the open file."
                : "Applied rewrite to the open file.",
        },
      });
    } catch (error) {
      showError(error);
    }
  }

  return (
    <main className="app-shell" style={editorSettingsStyle}>
      {state.errorMessage ? (
        <div className="error-banner" role="alert">
          <span>{state.errorMessage}</span>
          <button
            type="button"
            onClick={() => dispatch({ type: "errorCleared" })}
          >
            Dismiss
          </button>
        </div>
      ) : null}
      <AppMenuBar
        canSave={state.isDirty}
        canUseProject={Boolean(state.rootPath)}
        onOpenFolder={openFolder}
        onCreateFile={() => void createFile("")}
        onCreateFolder={() => void createFolder("")}
        onSave={() => void saveFile()}
        onSettings={() => setIsSettingsOpen(true)}
        onReindex={() => void reindexProject()}
        onResetLayout={() => setPaneLayout(resetPaneLayout())}
        onResetAssistant={() => dispatch({ type: "assistantMessagesReset" })}
      />
      <div className="workspace-grid">
        <aside className="file-pane">
          <FileTree
            rootPath={state.rootPath}
            nodes={state.tree}
            onOpenFolder={openFolder}
            onOpenFile={openFile}
            onCreateFile={createFile}
            onCreateFolder={createFolder}
            onRename={renameEntry}
            onDelete={deleteEntry}
            onMove={moveEntry}
            activePath={state.openFile?.relativePath}
          />
        </aside>
        <PaneResizer
          label="Resize file pane"
          isActive={activeResizePane === "file"}
          onPointerDown={(event) => startPaneResize("file", event)}
        />
        <EditorPane
          openFile={state.openFile}
          markdown={state.openMarkdown}
          isDirty={state.isDirty}
          onChange={(markdown) =>
            dispatch({ type: "editorChanged", markdown })
          }
          onSave={saveFile}
          onSelectionChange={setAssistantSelection}
        />
        <PaneResizer
          label="Resize assistant pane"
          isActive={activeResizePane === "assistant"}
          onPointerDown={(event) => startPaneResize("assistant", event)}
        />
        <AssistantPane
          key={state.settings.defaultProvider}
          defaultProvider={state.settings.defaultProvider}
          canSubmit={Boolean(state.openFile)}
          isRunning={isAssistantRunning}
          messages={state.assistantMessages}
          providerStatuses={providerStatuses}
          targetLabel={
            state.openFile
              ? assistantSelection?.trim()
                ? `${state.openFile.relativePath} selection`
                : state.openFile.relativePath
              : null
          }
          onSubmit={(request) => {
            void submitAssistantRequest(request);
          }}
          onImport={importAssistantResponse}
        />
      </div>
      {isSettingsOpen ? (
        <SettingsDialog
          settings={state.settings}
          providerStatuses={providerStatuses}
          isProviderStatusLoading={isProviderStatusLoading}
          onSave={saveSettings}
          onClose={() => setIsSettingsOpen(false)}
          onReindex={() => void reindexProject()}
          onRefreshProviderStatuses={() => void refreshProviderStatuses()}
          onStartProviderLogin={(provider) => void startProviderLogin(provider)}
        />
      ) : null}
    </main>
  );
}

function PaneResizer({
  label,
  isActive,
  onPointerDown,
}: {
  label: string;
  isActive: boolean;
  onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
}) {
  return (
    <div
      aria-label={label}
      aria-orientation="vertical"
      className={isActive ? "pane-resizer is-active" : "pane-resizer"}
      onPointerDown={onPointerDown}
      role="separator"
      tabIndex={0}
    />
  );
}

type SubscriptionProviderId = Extract<
  AppSettings["defaultProvider"],
  "openai-subscription" | "anthropic-subscription"
>;

const subscriptionProviders: readonly SubscriptionProviderId[] = [
  "openai-subscription",
  "anthropic-subscription",
];

function messageFromError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function joinRelativePath(parentPath: string, childPath: string): string {
  const parent = parentPath.replace(/\/+$/g, "");
  const child = childPath.trim().replace(/^\/+/g, "");

  return parent ? `${parent}/${child}` : child;
}

function trimRelativePath(path: string): string {
  return path.trim().replace(/^\/+/g, "").replace(/\/+$/g, "");
}

function basename(path: string): string {
  const parts = path.split("/").filter(Boolean);
  return parts[parts.length - 1] ?? path;
}

function dirname(path: string): string {
  const parts = path.split("/").filter(Boolean);
  parts.pop();
  return parts.join("/");
}

function renameRelativePath(path: string, newName: string): string {
  return joinRelativePath(dirname(path), newName);
}

function replacePathPrefix(
  relativePath: string,
  oldPath: string,
  newPath: string,
): string | null {
  if (relativePath === oldPath) {
    return newPath;
  }

  if (relativePath.startsWith(`${oldPath}/`)) {
    return joinRelativePath(newPath, relativePath.slice(oldPath.length + 1));
  }

  return null;
}

function isSamePathOrDescendant(relativePath: string, candidatePath: string) {
  return (
    relativePath === candidatePath || relativePath.startsWith(`${candidatePath}/`)
  );
}

function findFileNode(nodes: FileNode[], relativePath: string): FileNode | null {
  for (const node of nodes) {
    if (node.relativePath === relativePath && node.kind === "file") {
      return node;
    }

    const child = findFileNode(node.children ?? [], relativePath);

    if (child) {
      return child;
    }
  }

  return null;
}

function flattenProjectFilePaths(nodes: FileNode[]): string[] {
  return nodes.flatMap((node) => {
    if (node.kind === "directory") {
      return flattenProjectFilePaths(node.children ?? []);
    }

    return [node.relativePath];
  });
}

function formatAssistantUserMessage(
  request: AssistantRequest,
  relativePath: string,
): string {
  const instruction = request.instruction.trim() || "Use your best editorial judgment.";
  const providerLabel =
    request.provider === "openai-subscription"
      ? "OpenAI via Codex"
      : request.provider === "anthropic-subscription"
        ? "Anthropic via Claude Code"
        : "LM Studio";

  return `${providerLabel} / ${request.mode} / ${relativePath}\n\n${instruction}`;
}

async function buildMarkdownIndex(
  rootPath: string,
  tree: FileNode[],
  settings: AppSettings,
): Promise<IndexedDocument[]> {
  const reads = flattenIndexableMarkdownFiles(tree, settings).map(async (file) => {
    const opened = await tauriApi.readMarkdownFile(rootPath, file.relativePath);
    return indexMarkdownFile(opened.file, opened.markdown);
  });
  const settled = await Promise.allSettled(reads);

  return settled.flatMap((result) =>
    result.status === "fulfilled" ? [result.value] : [],
  );
}

function flattenIndexableMarkdownFiles(
  nodes: FileNode[],
  settings: AppSettings,
): FileNode[] {
  return nodes.flatMap((node) => {
    if (node.kind === "directory") {
      return flattenIndexableMarkdownFiles(node.children ?? [], settings);
    }

    if (!node.isMarkdown) {
      return [];
    }

    if (settings.ignoreLargeFiles && node.size > 2_000_000) {
      return [];
    }

    return [node];
  });
}

function indexMarkdownFile(file: FileNode, markdown: string): IndexedDocument {
  return buildIndex([
    {
      path: file.path,
      relativePath: file.relativePath,
      markdown,
      modifiedAt: file.modifiedAt,
    },
  ])[0];
}

async function loadProjectEnvSettings(
  rootPath: string,
  settings: AppSettings,
): Promise<Partial<AppSettings> | null> {
  if (!settings.projectEnvEnabled) {
    return null;
  }

  try {
    const envText = await tauriApi.loadProjectEnv(rootPath);
    return envText ? parseProjectEnvSettings(envText) : null;
  } catch {
    return null;
  }
}

function parseProjectEnvSettings(markdown: string): Partial<AppSettings> | null {
  const values = Object.fromEntries(
    markdown
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const [key, ...rest] = line.split("=");
        return [key.trim(), rest.join("=").trim().replace(/^["']|["']$/g, "")];
      }),
  );
  const parsed: Partial<AppSettings> = {};

  if (isProviderId(values.DRAFTAGENT_DEFAULT_PROVIDER)) {
    parsed.defaultProvider = values.DRAFTAGENT_DEFAULT_PROVIDER;
  }
  if (values.DRAFTAGENT_OPENAI_URL) {
    parsed.openaiUrl = values.DRAFTAGENT_OPENAI_URL;
  }
  if (values.DRAFTAGENT_ANTHROPIC_URL) {
    parsed.anthropicUrl = values.DRAFTAGENT_ANTHROPIC_URL;
  }
  if (values.DRAFTAGENT_LM_STUDIO_BASE_URL) {
    parsed.lmStudioBaseUrl = values.DRAFTAGENT_LM_STUDIO_BASE_URL;
  }
  if (values.DRAFTAGENT_LM_STUDIO_MODEL) {
    parsed.lmStudioModel = values.DRAFTAGENT_LM_STUDIO_MODEL;
  }
  const editorFontSize = Number(values.DRAFTAGENT_EDITOR_FONT_SIZE);
  if (Number.isFinite(editorFontSize)) {
    parsed.editorFontSize = editorFontSize;
  }
  const editorLineWidth = Number(values.DRAFTAGENT_EDITOR_LINE_WIDTH);
  if (Number.isFinite(editorLineWidth)) {
    parsed.editorLineWidth = editorLineWidth;
  }
  const ignoreHidden = parseEnvBoolean(values.DRAFTAGENT_IGNORE_HIDDEN);
  if (ignoreHidden !== null) {
    parsed.ignoreHidden = ignoreHidden;
  }
  const ignoreLargeFiles = parseEnvBoolean(values.DRAFTAGENT_IGNORE_LARGE_FILES);
  if (ignoreLargeFiles !== null) {
    parsed.ignoreLargeFiles = ignoreLargeFiles;
  }
  const ignoreBinaryFiles = parseEnvBoolean(values.DRAFTAGENT_IGNORE_BINARY_FILES);
  if (ignoreBinaryFiles !== null) {
    parsed.ignoreBinaryFiles = ignoreBinaryFiles;
  }

  return Object.keys(parsed).length > 0 ? parsed : null;
}

function isProviderId(value: string | undefined): value is AppSettings["defaultProvider"] {
  return (
    value === "openai-subscription" ||
    value === "anthropic-subscription" ||
    value === "lm-studio"
  );
}

function parseEnvBoolean(value: string | undefined): boolean | null {
  if (!value) {
    return null;
  }

  if (["1", "true", "yes", "on"].includes(value.toLowerCase())) {
    return true;
  }

  if (["0", "false", "no", "off"].includes(value.toLowerCase())) {
    return false;
  }

  return null;
}
