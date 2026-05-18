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
  draftsByPath: Record<string, { markdown: string; savedMarkdown: string }>;
  assistantMessages: AssistantMessage[];
  assistantMessagesByPath: Record<string, AssistantMessage[]>;
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
  | { type: "assistantMessagesReset" }
  | { type: "settingsLoaded"; settings: AppSettings }
  | { type: "errorShown"; message: string }
  | { type: "errorCleared" };

export const defaultSettings: AppSettings = {
  defaultProvider: "anthropic-subscription",
  openaiUrl: "https://chatgpt.com/",
  assistantSystemPrompt: "You are helping revise a novel draft.",
  openaiModel: "gpt-5.5",
  openaiEffort: "medium",
  anthropicUrl: "https://claude.ai/new",
  anthropicModel: "opus",
  anthropicEffort: "medium",
  lmStudioBaseUrl: "http://127.0.0.1:1234/v1",
  lmStudioModel: "local-model",
  themeId: "paper",
  editorFont: "literary",
  appZoomLevel: 0,
  editorFontSize: 18,
  editorLineWidth: 760,
  ignoreHidden: true,
  ignoreLargeFiles: true,
  ignoreBinaryFiles: true,
  projectEnvEnabled: false,
};

export const initialAppState: AppState = {
  rootPath: null,
  tree: [],
  indexedDocuments: [],
  openFile: null,
  openMarkdown: "",
  savedMarkdown: "",
  isDirty: false,
  draftsByPath: {},
  assistantMessages: [],
  assistantMessagesByPath: {},
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
        draftsByPath: {},
        assistantMessages: [],
        assistantMessagesByPath: {},
      };
    case "fileOpened":
      {
        const draft = state.draftsByPath[action.file.relativePath];
      return {
        ...state,
        openFile: action.file,
        openMarkdown: draft?.markdown ?? action.markdown,
        savedMarkdown: draft?.savedMarkdown ?? action.markdown,
        isDirty: draft ? draft.markdown !== draft.savedMarkdown : false,
        assistantMessages:
          state.assistantMessagesByPath[action.file.relativePath] ?? [],
      };
      }
    case "openFileMetadataUpdated":
      if (!state.openFile) {
        return state;
      }

      return {
        ...state,
        openFile: action.file,
        assistantMessages:
          action.file.relativePath === state.openFile.relativePath
            ? state.assistantMessages
            : state.assistantMessagesByPath[action.file.relativePath] ?? [],
      };
    case "fileClosed":
      return {
        ...state,
        openFile: null,
        openMarkdown: "",
        savedMarkdown: "",
        isDirty: false,
        assistantMessages: [],
      };
    case "editorChanged":
      if (!state.openFile) {
        return state;
      }

      return {
        ...state,
        openMarkdown: action.markdown,
        isDirty: action.markdown !== state.savedMarkdown,
        draftsByPath: {
          ...state.draftsByPath,
          [state.openFile.relativePath]: {
            markdown: action.markdown,
            savedMarkdown: state.savedMarkdown,
          },
        },
      };
    case "fileSaved":
      if (!state.openFile) {
        return state;
      }

      return {
        ...state,
        openMarkdown: action.markdown,
        savedMarkdown: action.markdown,
        isDirty: false,
        draftsByPath: {
          ...state.draftsByPath,
          [state.openFile.relativePath]: {
            markdown: action.markdown,
            savedMarkdown: action.markdown,
          },
        },
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
      if (!state.openFile) {
        return state;
      }

      {
        const assistantMessages = [...state.assistantMessages, action.message];

        return {
          ...state,
          assistantMessages,
          assistantMessagesByPath: {
            ...state.assistantMessagesByPath,
            [state.openFile.relativePath]: assistantMessages,
          },
        };
      }
    case "assistantMessagesReset":
      if (!state.openFile) {
        return {
          ...state,
          assistantMessages: [],
        };
      }

      return {
        ...state,
        assistantMessages: [],
        assistantMessagesByPath: {
          ...state.assistantMessagesByPath,
          [state.openFile.relativePath]: [],
        },
      };
    case "settingsLoaded":
      return {
        ...state,
        settings: { ...defaultSettings, ...action.settings },
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
