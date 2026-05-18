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
import type {
  EditorCommand,
  EditorMode,
  EditorPaneHandle,
} from "./components/EditorPane";
import { FileTree } from "./components/FileTree";
import { SettingsDialog } from "./components/SettingsDialog";
import { buildIndex, selectRelevantContext } from "./context/indexer";
import { normalizeMarkdownForSave } from "./editor/markdown";
import { appReducer, defaultSettings, initialAppState } from "./state/appReducer";
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
  AssistantSession,
  EditorFont,
  FileNode,
  IndexedDocument,
  ProviderStatus,
  ThemeId,
} from "./types";
import "./styles.css";

export default function App() {
  const [state, dispatch] = useReducer(appReducer, initialAppState);
  const [providerStatuses, setProviderStatuses] = useState<
    Partial<Record<SubscriptionProviderId, ProviderStatus>>
  >({});
  const [isProviderStatusLoading, setIsProviderStatusLoading] = useState(false);
  const [assistantSessions, setAssistantSessions] = useState<Record<string, AssistantSession>>({});
  const [isAssistantOpen, setIsAssistantOpen] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<EditorMode>("visual");
  const [paneLayout, setPaneLayout] = useState<PaneLayout>(defaultPaneLayout);
  const [activeResizePane, setActiveResizePane] =
    useState<ResizePane | null>(null);
  const resizeStateRef = useRef<{
    pane: ResizePane;
    startX: number;
    layout: PaneLayout;
  } | null>(null);
  const editorPaneRef = useRef<EditorPaneHandle | null>(null);
  const liveEditorRef = useRef<{
    relativePath: string | null;
    markdown: string;
  }>({ relativePath: null, markdown: "" });
  liveEditorRef.current = {
    relativePath: state.openFile?.relativePath ?? null,
    markdown: state.openMarkdown,
  };
  const activeAssistantPath = state.openFile?.relativePath ?? null;
  const activeAssistantSession = activeAssistantPath
    ? assistantSessions[activeAssistantPath] ?? createAssistantSession(state.settings)
    : createAssistantSession(state.settings);
  const appUiFontSizes = uiFontSizesForZoom(state.settings.appZoomLevel);
  const appZoomScale = scaleForAppZoom(state.settings.appZoomLevel);
  const editorSettingsStyle = {
    "--ui-font-size-xs": `${appUiFontSizes.xs}px`,
    "--ui-font-size-sm": `${appUiFontSizes.sm}px`,
    "--ui-font-size-md": `${appUiFontSizes.md}px`,
    "--ui-font-size-lg": `${appUiFontSizes.lg}px`,
    "--editor-font-size": `${Math.round(
      state.settings.editorFontSize * appZoomScale,
    )}px`,
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

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const key = event.key.toLowerCase();
      const isCommand = event.metaKey || event.ctrlKey;

      if (event.altKey && event.shiftKey && (key === "%" || key === "5")) {
        if (shouldRouteShortcutToEditor(event.target)) {
          event.preventDefault();
          runEditorCommand("strike");
        }
        return;
      }

      if (!isCommand) {
        return;
      }

      const handled = handleKeyboardShortcut(event);

      if (handled) {
        event.preventDefault();
      }
    }

    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [
    editorMode,
    state.isDirty,
    state.openFile,
    state.openMarkdown,
    state.rootPath,
    state.settings,
    state.tree,
  ]);

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
      const rootPath = await tauriApi.pickProjectFolder();

      if (!rootPath) {
        return;
      }

      const { effectiveSettings, indexedDocuments, projectSettings, tree } =
        await loadProject(rootPath);

      setAssistantSessions({});
      dispatch({
        type: "projectOpened",
        rootPath,
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

  async function openPickedFile() {
    if (!shouldSwitchFile(state.isDirty, confirmDiscardChanges)) {
      return;
    }

    try {
      const picked = await tauriApi.pickMarkdownFile();

      if (!picked) {
        return;
      }

      const { effectiveSettings, indexedDocuments, projectSettings, tree } =
        await loadProject(picked.rootPath);
      const opened = await tauriApi.readMarkdownFile(
        picked.rootPath,
        picked.filePath,
      );

      setAssistantSessions({});
      dispatch({
        type: "projectOpened",
        rootPath: picked.rootPath,
        tree,
        indexedDocuments,
      });
      if (projectSettings) {
        dispatch({ type: "settingsLoaded", settings: effectiveSettings });
      }
      dispatch({
        type: "fileOpened",
        file: opened.file,
        markdown: opened.markdown,
      });
    } catch (error) {
      showError(error);
    }
  }

  async function loadProject(rootPath: string) {
    const projectSettings = await loadProjectEnvSettings(
      rootPath,
      state.settings,
    );
    const effectiveSettings = projectSettings
      ? {
          ...state.settings,
          ...projectSettings,
          projectEnvEnabled: state.settings.projectEnvEnabled,
        }
      : state.settings;
    const tree = await tauriApi.readProjectTree(rootPath, effectiveSettings);
    const indexedDocuments = await buildMarkdownIndex(
      rootPath,
      tree,
      effectiveSettings,
    );

    return { effectiveSettings, indexedDocuments, projectSettings, tree };
  }

  async function openFile(path: string) {
    if (!state.rootPath) {
      return;
    }

    try {
      const opened = await tauriApi.readMarkdownFile(state.rootPath, path);

      patchAssistantSession(path, { unseenStatus: null });
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

  function closeOpenFile() {
    if (!state.openFile) {
      return;
    }

    if (!shouldSwitchFile(state.isDirty, confirmDiscardChanges)) {
      return;
    }

    dispatch({ type: "fileClosed" });
  }

  function openQuickly() {
    if (!state.rootPath) {
      return;
    }

    const query = window.prompt("Open quickly");

    if (!query?.trim()) {
      return;
    }

    const normalizedQuery = query.trim().toLowerCase();
    const match = flattenProjectFilePaths(state.tree).find((path) =>
      path.toLowerCase().includes(normalizedQuery),
    );

    if (!match) {
      showError(`No file matched "${query.trim()}".`);
      return;
    }

    void openFile(match);
  }

  function toggleEditorMode() {
    setEditorMode((current) =>
      current === "markdown" ? "visual" : "markdown",
    );
  }

  function runEditorCommand(command: EditorCommand) {
    editorPaneRef.current?.runCommand(command);
  }

  function changeTheme(themeId: ThemeId) {
    const nextSettings = { ...state.settings, themeId };

    dispatch({ type: "settingsLoaded", settings: nextSettings });
    void tauriApi
      .saveSettings(nextSettings)
      .catch(showError);
  }

  function changeAppZoom(delta: number) {
    const nextLevel = clampAppZoomLevel(state.settings.appZoomLevel + delta);
    saveZoomSetting({ appZoomLevel: nextLevel });
  }

  function resetAppZoom() {
    saveZoomSetting({ appZoomLevel: defaultAppZoomLevel });
  }

  function changeEditorTextZoom(delta: number) {
    const nextSize = clampEditorFontSize(state.settings.editorFontSize + delta);
    saveZoomSetting({ editorFontSize: nextSize });
  }

  function resetEditorTextZoom() {
    saveZoomSetting({ editorFontSize: defaultEditorFontSize });
  }

  function saveZoomSetting(settingsPatch: Partial<AppSettings>) {
    const nextSettings = { ...state.settings, ...settingsPatch };

    dispatch({ type: "settingsLoaded", settings: nextSettings });
    void tauriApi.saveSettings(nextSettings).catch(showError);
  }

  function handleKeyboardShortcut(event: KeyboardEvent): boolean {
    const key = event.key.toLowerCase();

    if (key === "=" || key === "+") {
      if (event.shiftKey) {
        changeEditorTextZoom(1);
      } else {
        changeAppZoom(1);
      }
      return true;
    }

    if (key === "-") {
      if (event.shiftKey) {
        changeEditorTextZoom(-1);
      } else {
        changeAppZoom(-1);
      }
      return true;
    }

    if (key === "0") {
      if (event.shiftKey) {
        resetEditorTextZoom();
      } else {
        resetAppZoom();
      }
      return true;
    }

    if (key === "s") {
      if (state.isDirty) {
        void saveFile();
      }
      return true;
    }

    if (key === "n") {
      if (event.shiftKey) {
        void createFolder("");
      } else {
        void createFile("");
      }
      return true;
    }

    if (key === "o") {
      void openFolder();
      return true;
    }

    if (key === "p") {
      openQuickly();
      return true;
    }

    if (key === ",") {
      setIsSettingsOpen(true);
      return true;
    }

    if (key === "w") {
      closeOpenFile();
      return true;
    }

    if (key === "/") {
      toggleEditorMode();
      return true;
    }

    const editorCommand = shortcutToEditorCommand(event);

    if (editorCommand) {
      if (!shouldRouteShortcutToEditor(event.target)) {
        return false;
      }

      runEditorCommand(editorCommand);
      return true;
    }

    return false;
  }

  async function saveSettings(settings: AppSettings) {
    try {
      await tauriApi.saveSettings(settings);
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
      await refreshProviderStatuses();
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
      removeAssistantSessions(path);

      if (isOpenEntry) {
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

  function openAssistant() {
    setIsAssistantOpen(true);
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

    migrateAssistantSessions(oldPath, newPath);
    dispatch(file ? { type: "openFileMetadataUpdated", file } : { type: "fileClosed" });
  }

  function patchAssistantSession(path: string | null, patch: Partial<AssistantSession>) {
    if (!path) return;
    setAssistantSessions((sessions) => ({
      ...sessions,
      [path]: { ...(sessions[path] ?? createAssistantSession(state.settings)), ...patch },
    }));
  }

  function addAssistantMessage(
    path: string | null,
    message: AssistantSession["messages"][number],
  ) {
    if (!path) return;
    setAssistantSessions((sessions) => {
      const session = sessions[path] ?? createAssistantSession(state.settings);
      return {
        ...sessions,
        [path]: { ...session, messages: [...session.messages, message] },
      };
    });
  }

  function migrateAssistantSessions(oldPath: string, newPath: string) {
    setAssistantSessions((sessions) => {
      const next = { ...sessions };
      for (const [path, session] of Object.entries(sessions)) {
        const replacement = replacePathPrefix(path, oldPath, newPath);
        if (replacement && replacement !== path) {
          next[replacement] = session;
          delete next[path];
        }
      }
      return next;
    });
  }

  function removeAssistantSessions(path: string) {
    setAssistantSessions((sessions) =>
      Object.fromEntries(
        Object.entries(sessions).filter(
          ([sessionPath]) => !isSamePathOrDescendant(sessionPath, path),
        ),
      ),
    );
  }

  function resetActiveAssistantSession() {
    if (!activeAssistantPath) return;
    const current = activeAssistantSession;
    setAssistantSessions((sessions) => ({
      ...sessions,
      [activeAssistantPath]: {
        ...createAssistantSession(state.settings),
        provider: current.provider,
        openaiModel: current.openaiModel,
        openaiEffort: current.openaiEffort,
        anthropicModel: current.anthropicModel,
        anthropicEffort: current.anthropicEffort,
        lmStudioModel: current.lmStudioModel,
        instruction: current.instruction,
      },
    }));
  }

  async function submitAssistantRequest(request: AssistantRequest) {
    if (!state.rootPath || !state.openFile || activeAssistantSession.isRunning) {
      return;
    }

    const submittedFilePath = state.openFile.relativePath;
    try {
      patchAssistantSession(submittedFilePath, { isRunning: true, mode: request.mode });
      const submittedMarkdown = state.openMarkdown;
      const guardedMarkdown =
        request.mode === "edit" ? submittedMarkdown : undefined;
      const targetMarkdown = activeAssistantSession.selection?.trim()
        ? activeAssistantSession.selection
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
        systemPrompt: state.settings.assistantSystemPrompt,
        targetLabel: activeAssistantSession.selection?.trim()
          ? `${state.openFile.relativePath} (current selection)`
          : state.openFile.relativePath,
        targetMarkdown,
        projectFiles: flattenProjectFilePaths(state.tree),
        context,
        conversation: activeAssistantSession.messages,
      });
      addAssistantMessage(submittedFilePath, { role: "user", content: formatAssistantUserMessage(request) });

      if (request.provider === "lm-studio") {
        const response = await tauriApi.sendLmStudioRequest(
          state.settings.lmStudioBaseUrl,
          request.model,
          prompt,
        );

        importAssistantResponse(
          response,
          request.mode,
          submittedFilePath,
          guardedMarkdown,
        );
        return;
      }

      const response = await tauriApi.sendCliAgentRequest(
        request.provider,
        state.rootPath,
        prompt,
        request.model,
        request.effort,
      );

      importAssistantResponse(
        response,
        request.mode,
        submittedFilePath,
        guardedMarkdown,
      );
    } catch (error) {
      showError(error);
    } finally {
      patchAssistantSession(submittedFilePath, { isRunning: false });
    }
  }

  function importAssistantResponse(
    response: string,
    mode = activeAssistantSession.mode,
    expectedFilePath?: string,
    expectedMarkdown?: string,
  ) {
    if (!response.trim()) {
      return;
    }

    if (
      mode === "edit" &&
      expectedMarkdown !== undefined &&
      (!expectedFilePath ||
        expectedFilePath === liveEditorRef.current.relativePath) &&
      liveEditorRef.current.markdown !== expectedMarkdown
    ) {
      showError("The open file changed before the assistant response returned.");
      return;
    }

    if (mode === "chat") {
      const targetPath = expectedFilePath ?? activeAssistantPath;
      addAssistantMessage(targetPath, { role: "assistant", content: response.trim() });
      if (targetPath && targetPath !== activeAssistantPath) {
        patchAssistantSession(targetPath, { unseenStatus: "reply-ready" });
      }
      return;
    }

    try {
      const parsed = parseAssistantResponse(mode, response);
      const isVisibleTarget = !expectedFilePath || expectedFilePath === liveEditorRef.current.relativePath;
      const currentMarkdown = isVisibleTarget
        ? liveEditorRef.current.markdown
        : expectedMarkdown ?? state.openMarkdown;
      const nextMarkdown = applyAssistantResult(currentMarkdown, parsed);

      const targetPath = expectedFilePath ?? activeAssistantPath;

      if (parsed.kind === "edit") {
        if (isVisibleTarget) {
          dispatch({ type: "editorChanged", markdown: nextMarkdown });
        }
        patchAssistantSession(targetPath, { pendingEdit: {
          mode: "edit",
          response: response.trim(),
          previousMarkdown: currentMarkdown,
          nextMarkdown,
        }, isPendingDiffVisible: true, unseenStatus: isVisibleTarget ? null : "edit-ready" });
      }

      addAssistantMessage(targetPath, { role: "assistant", content: response.trim() });

      if (parsed.kind === "edit") {
        addAssistantMessage(targetPath, { role: "system", content: "Review the staged edit before saving." });
      }
    } catch (error) {
      showError(error);
    }
  }

  async function applyPendingAssistantEdit() {
    if (!activeAssistantSession.pendingEdit || !activeAssistantPath) {
      return;
    }

    await saveFile();
    addAssistantMessage(activeAssistantPath, { role: "system", content: "Kept edit and saved it to disk." });
    patchAssistantSession(activeAssistantPath, { pendingEdit: null, isPendingDiffVisible: false });
  }

  function rejectPendingAssistantEdit() {
    if (!activeAssistantSession.pendingEdit || !activeAssistantPath) {
      return;
    }

    dispatch({
      type: "editorChanged",
      markdown: activeAssistantSession.pendingEdit.previousMarkdown,
    });
    addAssistantMessage(activeAssistantPath, { role: "system", content: "Rejected edit and restored the previous text." });
    patchAssistantSession(activeAssistantPath, { pendingEdit: null, isPendingDiffVisible: false });
  }

  return (
    <main
      className="app-shell"
      data-editor-font={state.settings.editorFont}
      data-theme={state.settings.themeId}
      style={editorSettingsStyle}
    >
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
        canUseEditor={Boolean(state.openFile)}
        canSave={state.isDirty}
        canUseProject={Boolean(state.rootPath)}
        editorMode={editorMode}
        onOpenFolder={openFolder}
        onOpenFile={() => void openPickedFile()}
        onOpenQuickly={openQuickly}
        onCreateFile={() => void createFile("")}
        onCreateFolder={() => void createFolder("")}
        onCloseFile={closeOpenFile}
        onSave={() => void saveFile()}
        onSettings={() => setIsSettingsOpen(true)}
        onReindex={() => void reindexProject()}
        onResetLayout={() => setPaneLayout(resetPaneLayout())}
        onZoomIn={() => changeAppZoom(1)}
        onZoomOut={() => changeAppZoom(-1)}
        onResetZoom={resetAppZoom}
        onEditorZoomIn={() => changeEditorTextZoom(1)}
        onEditorZoomOut={() => changeEditorTextZoom(-1)}
        onResetEditorZoom={resetEditorTextZoom}
        themeId={state.settings.themeId}
        onThemeChange={changeTheme}
        onToggleEditorMode={toggleEditorMode}
        onEditorCommand={runEditorCommand}
        onOpenAssistant={openAssistant}
      />
      <div
        className={
          isAssistantOpen
            ? "workspace-grid has-assistant"
            : "workspace-grid"
        }
      >
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
            assistantActivityByPath={assistantActivityByPath(assistantSessions)}
          />
        </aside>
        <PaneResizer
          label="Resize file pane"
          isActive={activeResizePane === "file"}
          onPointerDown={(event) => startPaneResize("file", event)}
        />
        <EditorPane
          ref={editorPaneRef}
          openFile={state.openFile}
          markdown={state.openMarkdown}
          mode={editorMode}
          isDirty={state.isDirty}
          isAiEditStaged={Boolean(activeAssistantSession.pendingEdit)}
          stagedDiff={
            activeAssistantSession.pendingEdit && activeAssistantSession.isPendingDiffVisible
              ? {
                  previousMarkdown: activeAssistantSession.pendingEdit.previousMarkdown,
                  nextMarkdown: activeAssistantSession.pendingEdit.nextMarkdown,
                }
              : null
          }
          onChange={(markdown) =>
            dispatch({ type: "editorChanged", markdown })
          }
          onSave={saveFile}
          onOpenFolder={openFolder}
          onOpenFile={openPickedFile}
          onModeChange={setEditorMode}
          onSelectionChange={(selection) => patchAssistantSession(activeAssistantPath, { selection })}
        />
        {isAssistantOpen ? (
          <>
            <PaneResizer
              label="Resize AI pane"
              isActive={activeResizePane === "assistant"}
              onPointerDown={(event) => startPaneResize("assistant", event)}
            />
            <AssistantPane
              settings={state.settings}
              canSubmit={Boolean(state.openFile)}
              isRunning={activeAssistantSession.isRunning}
              messages={activeAssistantSession.messages}
              pendingEdit={activeAssistantSession.pendingEdit}
              isPendingDiffVisible={activeAssistantSession.isPendingDiffVisible}
              provider={activeAssistantSession.provider}
              mode={activeAssistantSession.mode}
              openaiModel={activeAssistantSession.openaiModel}
              openaiEffort={activeAssistantSession.openaiEffort}
              anthropicModel={activeAssistantSession.anthropicModel}
              anthropicEffort={activeAssistantSession.anthropicEffort}
              lmStudioModel={activeAssistantSession.lmStudioModel}
              instruction={activeAssistantSession.instruction}
              importText={activeAssistantSession.importText}
              onFieldChange={(patch) => patchAssistantSession(activeAssistantPath, patch)}
              providerStatuses={providerStatuses}
              targetLabel={
                state.openFile
                  ? activeAssistantSession.selection?.trim()
                    ? `${state.openFile.relativePath} selection`
                    : state.openFile.relativePath
                  : null
              }
              onSubmit={(request) => {
                void submitAssistantRequest(request);
              }}
              onImport={importAssistantResponse}
              onApplyPendingEdit={() => void applyPendingAssistantEdit()}
              onRejectPendingEdit={rejectPendingAssistantEdit}
              onPendingDiffVisibilityChange={(isPendingDiffVisible) => patchAssistantSession(activeAssistantPath, { isPendingDiffVisible })}
              onResetSession={resetActiveAssistantSession}
              onClose={() => setIsAssistantOpen(false)}
            />
          </>
        ) : null}
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
const defaultAppZoomLevel = defaultSettings.appZoomLevel;
const minAppZoomLevel = -2;
const maxAppZoomLevel = 4;
const defaultEditorFontSize = defaultSettings.editorFontSize;
const minEditorFontSize = 12;
const maxEditorFontSize = 28;

function clampAppZoomLevel(zoomLevel: number) {
  return Math.min(maxAppZoomLevel, Math.max(minAppZoomLevel, zoomLevel));
}

function clampEditorFontSize(fontSize: number) {
  return Math.min(maxEditorFontSize, Math.max(minEditorFontSize, fontSize));
}

function uiFontSizesForZoom(zoomLevel: number) {
  const scale = scaleForAppZoom(zoomLevel);

  return {
    xs: Math.round(13 * scale),
    sm: Math.round(14 * scale),
    md: Math.round(15 * scale),
    lg: Math.round(19 * scale),
  };
}

function scaleForAppZoom(zoomLevel: number) {
  return 1 + clampAppZoomLevel(zoomLevel) * 0.08;
}

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

function formatAssistantUserMessage(request: AssistantRequest): string {
  return request.instruction.trim();
}

function shouldRouteShortcutToEditor(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) {
    return true;
  }

  if (target.closest(".editor-pane")) {
    return true;
  }

  if (target.closest("input, textarea, select, [contenteditable='true']")) {
    return false;
  }

  return true;
}

function shortcutToEditorCommand(event: KeyboardEvent): EditorCommand | null {
  const key = event.key.toLowerCase();

  if (event.shiftKey && key === "z") {
    return "redo";
  }

  if (key === "z") {
    return "undo";
  }

  if (key === "y") {
    return "redo";
  }

  if (key === "x") {
    return "cut";
  }

  if (key === "c") {
    return "copy";
  }

  if (key === "v") {
    return "paste";
  }

  if (key === "a") {
    return "selectAll";
  }

  if (/^[1-6]$/.test(key)) {
    return `heading${key}` as EditorCommand;
  }

  if (key === "0") {
    return "paragraph";
  }

  if (key === "b") {
    return "bold";
  }

  if (key === "i") {
    return "italic";
  }

  if (key === "u") {
    return "underline";
  }

  if (key === "k" && event.shiftKey) {
    return "codeBlock";
  }

  if (key === "k") {
    return "link";
  }

  if (key === "`" && event.shiftKey) {
    return "inlineCode";
  }

  if (key === "\\" || key === "|") {
    return "clearFormat";
  }

  if (event.shiftKey && key === "q") {
    return "blockquote";
  }

  if (event.shiftKey && (event.key === "[" || event.key === "{")) {
    return "orderedList";
  }

  if (event.shiftKey && (event.key === "]" || event.key === "}")) {
    return "bulletList";
  }

  if (event.altKey && event.shiftKey && (key === "%" || key === "5")) {
    return "strike";
  }

  return null;
}

async function buildMarkdownIndex(
  rootPath: string,
  tree: FileNode[],
  settings: AppSettings,
): Promise<IndexedDocument[]> {
  const settled = await mapWithConcurrency(
    flattenIndexableMarkdownFiles(tree, settings),
    12,
    async (file) => {
      const opened = await tauriApi.readMarkdownFile(rootPath, file.relativePath);
      return indexMarkdownFile(opened.file, opened.markdown);
    },
  );

  return settled.flatMap((result) =>
    result.status === "fulfilled" ? [result.value] : [],
  );
}

async function mapWithConcurrency<T, U>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<U>,
): Promise<Array<PromiseSettledResult<U>>> {
  const results: Array<PromiseSettledResult<U>> = [];
  let nextIndex = 0;
  const workerCount = Math.min(Math.max(concurrency, 1), items.length);

  async function worker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;

      try {
        results[currentIndex] = {
          status: "fulfilled",
          value: await mapper(items[currentIndex]),
        };
      } catch (reason) {
        results[currentIndex] = { status: "rejected", reason };
      }
    }
  }

  await Promise.all(Array.from({ length: workerCount }, worker));

  return results;
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
  const envValue = (key: string) => values[`SCRIPTORIUM_${key}`];

  const defaultProvider = envValue("DEFAULT_PROVIDER");
  if (isProviderId(defaultProvider)) {
    parsed.defaultProvider = defaultProvider;
  }
  const assistantSystemPrompt = envValue("ASSISTANT_SYSTEM_PROMPT");
  if (assistantSystemPrompt) {
    parsed.assistantSystemPrompt = assistantSystemPrompt;
  }
  const openaiUrl = envValue("OPENAI_URL");
  if (openaiUrl) {
    parsed.openaiUrl = openaiUrl;
  }
  const openaiModel = envValue("OPENAI_MODEL");
  if (openaiModel) {
    parsed.openaiModel = openaiModel;
  }
  const openaiEffort = envValue("OPENAI_EFFORT");
  if (openaiEffort) {
    parsed.openaiEffort = openaiEffort;
  }
  const anthropicUrl = envValue("ANTHROPIC_URL");
  if (anthropicUrl) {
    parsed.anthropicUrl = anthropicUrl;
  }
  const anthropicModel = envValue("ANTHROPIC_MODEL");
  if (anthropicModel) {
    parsed.anthropicModel = anthropicModel;
  }
  const anthropicEffort = envValue("ANTHROPIC_EFFORT");
  if (anthropicEffort) {
    parsed.anthropicEffort = anthropicEffort;
  }
  const lmStudioBaseUrl = envValue("LM_STUDIO_BASE_URL");
  if (lmStudioBaseUrl) {
    parsed.lmStudioBaseUrl = lmStudioBaseUrl;
  }
  const lmStudioModel = envValue("LM_STUDIO_MODEL");
  if (lmStudioModel) {
    parsed.lmStudioModel = lmStudioModel;
  }
  const themeId = envValue("THEME");
  if (isThemeId(themeId)) {
    parsed.themeId = themeId;
  }
  const editorFont = envValue("EDITOR_FONT");
  if (isEditorFont(editorFont)) {
    parsed.editorFont = editorFont;
  }
  const editorFontSize = Number(envValue("EDITOR_FONT_SIZE"));
  if (Number.isFinite(editorFontSize)) {
    parsed.editorFontSize = editorFontSize;
  }
  const editorLineWidth = Number(envValue("EDITOR_LINE_WIDTH"));
  if (Number.isFinite(editorLineWidth)) {
    parsed.editorLineWidth = editorLineWidth;
  }
  const ignoreHidden = parseEnvBoolean(envValue("IGNORE_HIDDEN"));
  if (ignoreHidden !== null) {
    parsed.ignoreHidden = ignoreHidden;
  }
  const ignoreLargeFiles = parseEnvBoolean(envValue("IGNORE_LARGE_FILES"));
  if (ignoreLargeFiles !== null) {
    parsed.ignoreLargeFiles = ignoreLargeFiles;
  }
  const ignoreBinaryFiles = parseEnvBoolean(envValue("IGNORE_BINARY_FILES"));
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

function isThemeId(value: string | undefined): value is ThemeId {
  return (
    value === "paper" ||
    value === "catppuccin-latte" ||
    value === "catppuccin-mocha" ||
    value === "gruvbox-light" ||
    value === "gruvbox-dark" ||
    value === "dracula" ||
    value === "nord" ||
    value === "solarized-light" ||
    value === "solarized-dark" ||
    value === "tokyo-night" ||
    value === "rose-pine" ||
    value === "everforest"
  );
}

function isEditorFont(value: string | undefined): value is EditorFont {
  return value === "literary" || value === "system" || value === "mono";
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

function createAssistantSession(settings: AppSettings): AssistantSession {
  return {
    messages: [],
    mode: "edit",
    provider: settings.defaultProvider,
    openaiModel: settings.openaiModel,
    openaiEffort: settings.openaiEffort,
    anthropicModel: settings.anthropicModel,
    anthropicEffort: settings.anthropicEffort,
    lmStudioModel: settings.lmStudioModel,
    instruction: "",
    importText: "",
    isRunning: false,
    pendingEdit: null,
    isPendingDiffVisible: false,
    selection: null,
    unseenStatus: null,
  };
}

function assistantActivityByPath(sessions: Record<string, AssistantSession>) {
  return Object.fromEntries(
    Object.entries(sessions)
      .map(([path, session]) => [
        path,
        session.isRunning
          ? "Working"
          : session.unseenStatus === "edit-ready"
            ? "Edit ready"
            : session.unseenStatus === "reply-ready"
              ? "Reply ready"
              : null,
      ])
      .filter(([, status]) => status),
  ) as Record<string, "Working" | "Reply ready" | "Edit ready">;
}
