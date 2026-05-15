use crate::model::{FileKind, FileNode, OpenFile, WriteFileRequest};
use std::ffi::OsStr;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;

const LARGE_FILE_LIMIT_BYTES: u64 = 2_000_000;

#[tauri::command]
pub fn read_project_tree(root_path: String) -> Result<Vec<FileNode>, String> {
    scan_tree(Path::new(&root_path))
}

#[tauri::command]
pub fn read_markdown_file(root_path: String, file_path: String) -> Result<OpenFile, String> {
    let root = canonical_root(Path::new(&root_path))?;
    let file = ensure_inside_root(&root, Path::new(&file_path))?;

    let node = node_from_path(&root, &file)?;
    if !node.is_markdown {
        return Err("only Markdown files can be opened in the editor".to_string());
    }

    let markdown = fs::read_to_string(&file).map_err(|err| err.to_string())?;
    Ok(OpenFile {
        file: node,
        markdown,
    })
}

#[tauri::command]
pub fn write_markdown_file(request: WriteFileRequest) -> Result<(), String> {
    let root = canonical_root(Path::new(&request.root_path))?;
    let file = ensure_inside_root(&root, Path::new(&request.file_path))?;

    if extension(&file) != "md" {
        return Err("only Markdown files can be saved by the editor".to_string());
    }

    fs::write(file, request.markdown).map_err(|err| err.to_string())
}

pub fn scan_tree(root: &Path) -> Result<Vec<FileNode>, String> {
    let root = canonical_root(root)?;
    scan_tree_from_root(&root, &root)
}

pub fn ensure_inside_root(root: &Path, file_path: &Path) -> Result<PathBuf, String> {
    let root = canonical_root(root)?;
    let target = if file_path.is_absolute() {
        file_path.to_path_buf()
    } else {
        root.join(file_path)
    };
    let target = target.canonicalize().map_err(|err| err.to_string())?;

    if target.starts_with(&root) {
        Ok(target)
    } else {
        Err("path is outside project root".to_string())
    }
}

fn scan_tree_from_root(root: &Path, directory: &Path) -> Result<Vec<FileNode>, String> {
    if !directory.is_dir() {
        return Err("project root is not a directory".to_string());
    }

    let mut nodes = Vec::new();
    for entry in fs::read_dir(directory).map_err(|err| err.to_string())? {
        let entry = entry.map_err(|err| err.to_string())?;
        let path = entry.path();
        if should_skip(&path) {
            continue;
        }
        nodes.push(node_from_path(root, &path)?);
    }

    nodes.sort_by(|a, b| {
        a.name
            .to_lowercase()
            .cmp(&b.name.to_lowercase())
            .then_with(|| a.name.cmp(&b.name))
    });
    Ok(nodes)
}

fn node_from_path(root: &Path, path: &Path) -> Result<FileNode, String> {
    let metadata = fs::symlink_metadata(path).map_err(|err| err.to_string())?;
    let kind = if metadata.is_dir() {
        FileKind::Directory
    } else {
        FileKind::File
    };
    let children = if metadata.is_dir() {
        Some(scan_tree_from_root(root, path)?)
    } else {
        None
    };
    let modified_at = metadata
        .modified()
        .ok()
        .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
        .map(|duration| duration.as_secs())
        .unwrap_or(0);
    let relative_path = path
        .strip_prefix(root)
        .map_err(|err| err.to_string())?
        .to_string_lossy()
        .to_string();
    let extension = extension(path);

    Ok(FileNode {
        path: path.to_string_lossy().to_string(),
        relative_path,
        name: path
            .file_name()
            .unwrap_or_else(|| OsStr::new(""))
            .to_string_lossy()
            .to_string(),
        is_markdown: extension == "md",
        extension,
        kind,
        modified_at,
        size: metadata.len(),
        children,
    })
}

fn canonical_root(root: &Path) -> Result<PathBuf, String> {
    let root = root.canonicalize().map_err(|err| err.to_string())?;
    if root.is_dir() {
        Ok(root)
    } else {
        Err("project root is not a directory".to_string())
    }
}

fn should_skip(path: &Path) -> bool {
    let file_name = path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("");
    if file_name.starts_with('.') {
        return true;
    }

    fs::symlink_metadata(path)
        .map(|metadata| {
            metadata.file_type().is_symlink()
                || (metadata.is_file() && metadata.len() > LARGE_FILE_LIMIT_BYTES)
        })
        .unwrap_or(false)
}

fn extension(path: &Path) -> String {
    path.extension()
        .and_then(|ext| ext.to_str())
        .unwrap_or("")
        .to_lowercase()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn temp_root() -> tempfile::TempDir {
        tempfile::tempdir().expect("temp dir")
    }

    #[test]
    fn builds_tree_with_markdown_flags() {
        let root = temp_root();
        fs::write(root.path().join("chapter.md"), "# Chapter").unwrap();
        fs::write(root.path().join("cover.png"), "fake").unwrap();
        fs::create_dir(root.path().join("drafts")).unwrap();
        fs::write(root.path().join("drafts").join("scene.MD"), "# Scene").unwrap();

        let tree = scan_tree(root.path()).unwrap();

        let chapter = tree.iter().find(|node| node.name == "chapter.md").unwrap();
        let cover = tree.iter().find(|node| node.name == "cover.png").unwrap();
        let drafts = tree.iter().find(|node| node.name == "drafts").unwrap();
        let scene = drafts
            .children
            .as_ref()
            .unwrap()
            .iter()
            .find(|node| node.name == "scene.MD")
            .unwrap();

        assert!(chapter.is_markdown);
        assert_eq!(chapter.kind, FileKind::File);
        assert!(!cover.is_markdown);
        assert_eq!(drafts.kind, FileKind::Directory);
        assert!(scene.is_markdown);
    }

    #[test]
    fn refuses_paths_outside_root() {
        let root = temp_root();
        let outside = temp_root();
        let outside_file = outside.path().join("outside.md");
        fs::write(&outside_file, "# Outside").unwrap();

        let err = ensure_inside_root(root.path(), &outside_file).unwrap_err();

        assert!(err.contains("outside project root"));
    }

    #[test]
    fn read_write_markdown_round_trip_is_contained_and_explicit() {
        let root = temp_root();
        let chapter = root.path().join("chapter.md");
        fs::write(&chapter, "# Chapter").unwrap();

        let opened = read_markdown_file(
            root.path().to_string_lossy().to_string(),
            "chapter.md".to_string(),
        )
        .unwrap();
        assert_eq!(opened.markdown, "# Chapter");
        assert_eq!(opened.file.relative_path, "chapter.md");

        write_markdown_file(WriteFileRequest {
            root_path: root.path().to_string_lossy().to_string(),
            file_path: "chapter.md".to_string(),
            markdown: "# Revised\n\nText".to_string(),
        })
        .unwrap();

        assert_eq!(fs::read_to_string(&chapter).unwrap(), "# Revised\n\nText");

        let notes = root.path().join("notes.txt");
        fs::write(&notes, "not markdown").unwrap();
        let err = read_markdown_file(
            root.path().to_string_lossy().to_string(),
            "notes.txt".to_string(),
        )
        .unwrap_err();
        assert!(err.contains("only Markdown files"));
    }

    #[cfg(unix)]
    #[test]
    fn symlinked_directory_outside_root_is_skipped() {
        use std::os::unix::fs::symlink;

        let root = temp_root();
        let outside = temp_root();
        fs::write(outside.path().join("secret.md"), "# Outside").unwrap();
        symlink(outside.path(), root.path().join("outside-link")).unwrap();
        fs::write(root.path().join("chapter.md"), "# Chapter").unwrap();

        let tree = scan_tree(root.path()).unwrap();

        assert!(tree.iter().any(|node| node.name == "chapter.md"));
        assert!(!tree.iter().any(|node| node.name == "outside-link"));
        assert!(!tree.iter().any(|node| node.name == "secret.md"));
    }

    #[cfg(unix)]
    #[test]
    fn symlink_cycle_to_root_is_skipped() {
        use std::os::unix::fs::symlink;

        let root = temp_root();
        fs::write(root.path().join("chapter.md"), "# Chapter").unwrap();
        fs::create_dir(root.path().join("drafts")).unwrap();
        symlink(root.path(), root.path().join("drafts").join("root-cycle")).unwrap();

        let tree = scan_tree(root.path()).unwrap();
        let drafts = tree.iter().find(|node| node.name == "drafts").unwrap();
        let children = drafts.children.as_ref().unwrap();

        assert!(children.is_empty());
        assert!(tree.iter().any(|node| node.name == "chapter.md"));
    }
}
