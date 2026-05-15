use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct FileNode {
    pub path: String,
    pub relative_path: String,
    pub name: String,
    pub extension: String,
    pub kind: FileKind,
    pub is_markdown: bool,
    pub modified_at: u64,
    pub size: u64,
    pub children: Option<Vec<FileNode>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum FileKind {
    File,
    Directory,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct OpenFile {
    pub file: FileNode,
    pub markdown: String,
}

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct WriteFileRequest {
    pub root_path: String,
    pub file_path: String,
    pub markdown: String,
}
