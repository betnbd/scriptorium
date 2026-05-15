import type {
  AppSettings,
  AssistantMessage,
  FileNode,
  IndexedDocument,
  OpenFile,
} from "../types";

export interface AppState {
  rootPath: string | null;
  tree: FileNode[];
  indexedDocuments: IndexedDocument[];
  openFile: FileNode | null;
  openMarkdown: string;
  savedMarkdown: string;
  isDirty: boolean;
  assistantMessages: AssistantMessage[];
  settings: AppSettings;
  errorMessage: string | null;
}

export type AppAction =
  | {
      type: "projectOpened";
      rootPath: string;
      tree: FileNode[];
      indexedDocuments: IndexedDocument[];
    }
  | { type: "fileOpened"; file: OpenFile["file"]; markdown: string }
  | { type: "openFileMetadataUpdated"; file: OpenFile["file"] }
  | { type: "fileClosed" }
  | { type: "editorChanged"; markdown: string }
  | { type: "fileSaved"; markdown: string }
  | {
      type: "treeUpdated";
      tree: FileNode[];
      indexedDocuments: IndexedDocument[];
    }
  | { type: "indexedDocumentUpdated"; document: IndexedDocument }
  | { type: "assistantMessageAdded"; message: AssistantMessage }
  | { type: "settingsLoaded"; settings: AppSettings }
  | { type: "errorShown"; message: string }
  | { type: "errorCleared" };

export const defaultSettings: AppSettings = {
  defaultProvider: "openai-subscription",
  openaiUrl: "https://chatgpt.com/",
  anthropicUrl: "https://claude.ai/new",
  lmStudioBaseUrl: "http://127.0.0.1:1234/v1",
  lmStudioModel: "local-model",
  editorFontSize: 18,
  editorLineWidth: 760,
  ignoreHidden: true,
  ignoreLargeFiles: true,
  ignoreBinaryFiles: true,
  projectEnvEnabled: true,
};

export const initialAppState: AppState = {
  rootPath: null,
  tree: [],
  indexedDocuments: [],
  openFile: null,
  openMarkdown: "",
  savedMarkdown: "",
  isDirty: false,
  assistantMessages: [],
  settings: defaultSettings,
  errorMessage: null,
};

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "projectOpened":
      return {
        ...state,
        rootPath: action.rootPath,
        tree: action.tree,
        indexedDocuments: action.indexedDocuments,
        openFile: null,
        openMarkdown: "",
        savedMarkdown: "",
        isDirty: false,
        assistantMessages: [],
      };
    case "fileOpened":
      return {
        ...state,
        openFile: action.file,
        openMarkdown: action.markdown,
        savedMarkdown: action.markdown,
        isDirty: false,
      };
    case "openFileMetadataUpdated":
      if (!state.openFile) {
        return state;
      }

      return {
        ...state,
        openFile: action.file,
      };
    case "fileClosed":
      return {
        ...state,
        openFile: null,
        openMarkdown: "",
        savedMarkdown: "",
        isDirty: false,
      };
    case "editorChanged":
      return {
        ...state,
        openMarkdown: action.markdown,
        isDirty: action.markdown !== state.savedMarkdown,
      };
    case "fileSaved":
      return {
        ...state,
        openMarkdown: action.markdown,
        savedMarkdown: action.markdown,
        isDirty: false,
      };
    case "treeUpdated":
      return {
        ...state,
        tree: action.tree,
        indexedDocuments: action.indexedDocuments,
      };
    case "indexedDocumentUpdated":
      return {
        ...state,
        indexedDocuments: upsertIndexedDocument(
          state.indexedDocuments,
          action.document,
        ),
      };
    case "assistantMessageAdded":
      return {
        ...state,
        assistantMessages: [...state.assistantMessages, action.message],
      };
    case "settingsLoaded":
      return {
        ...state,
        settings: action.settings,
      };
    case "errorShown":
      return {
        ...state,
        errorMessage: action.message,
      };
    case "errorCleared":
      return {
        ...state,
        errorMessage: null,
      };
  }
}

function upsertIndexedDocument(
  documents: IndexedDocument[],
  document: IndexedDocument,
): IndexedDocument[] {
  const existingIndex = documents.findIndex(
    (entry) =>
      entry.path === document.path ||
      entry.relativePath === document.relativePath,
  );

  if (existingIndex === -1) {
    return [...documents, document];
  }

  return documents.map((entry, index) =>
    index === existingIndex ? document : entry,
  );
}
