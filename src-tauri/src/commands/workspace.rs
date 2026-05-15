use crate::model::{FileKind, FileNode, OpenFile, WriteFileRequest};
use std::ffi::OsStr;
use std::fs;
use std::fs::OpenOptions;
use std::io::Read;
use std::path::Component;
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;

const LARGE_FILE_LIMIT_BYTES: u64 = 2_000_000;

#[derive(Debug, Clone, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TreeOptions {
    #[serde(default = "default_true")]
    pub ignore_hidden: bool,
    #[serde(default = "default_true")]
    pub ignore_large_files: bool,
    #[serde(default = "default_true")]
    pub ignore_binary_files: bool,
}

#[tauri::command]
pub fn read_project_tree(
    root_path: String,
    options: Option<TreeOptions>,
) -> Result<Vec<FileNode>, String> {
    scan_tree_with_options(Path::new(&root_path), options.unwrap_or_default())
}

#[tauri::command]
pub fn read_markdown_file(root_path: String, file_path: String) -> Result<OpenFile, String> {
    let root = canonical_root(Path::new(&root_path))?;
    let file = ensure_inside_root(&root, Path::new(&file_path))?;

    let node = node_from_path(&root, &file, &TreeOptions::default())?;
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

#[tauri::command]
pub fn create_file(root_path: String, relative_path: String) -> Result<(), String> {
    let root = canonical_root(Path::new(&root_path))?;
    let target = ensure_new_target_inside_root(&root, Path::new(&relative_path))?;

    OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(target)
        .map(|_| ())
        .map_err(|err| err.to_string())
}

#[tauri::command]
pub fn create_folder(root_path: String, relative_path: String) -> Result<(), String> {
    let root = canonical_root(Path::new(&root_path))?;
    let target = ensure_new_target_inside_root(&root, Path::new(&relative_path))?;

    fs::create_dir(target).map_err(|err| err.to_string())
}

#[tauri::command]
pub fn rename_entry(root_path: String, path: String, new_name: String) -> Result<(), String> {
    validate_entry_name(&new_name)?;
    let root = canonical_root(Path::new(&root_path))?;
    let source = ensure_existing_entry_for_operation(&root, Path::new(&path))?;
    let parent = source
        .parent()
        .ok_or_else(|| "entry has no parent directory".to_string())?;
    let target = ensure_new_target_inside_root(parent, Path::new(&new_name))?;

    fs::rename(source, target).map_err(|err| err.to_string())
}

#[tauri::command]
pub fn delete_entry(root_path: String, path: String) -> Result<(), String> {
    let root = canonical_root(Path::new(&root_path))?;
    let target = ensure_existing_entry_for_operation(&root, Path::new(&path))?;
    let metadata = fs::symlink_metadata(&target).map_err(|err| err.to_string())?;

    if metadata.is_dir() {
        fs::remove_dir_all(target).map_err(|err| err.to_string())
    } else {
        fs::remove_file(target).map_err(|err| err.to_string())
    }
}

#[tauri::command]
pub fn move_entry(
    root_path: String,
    path: String,
    new_relative_path: String,
) -> Result<(), String> {
    let root = canonical_root(Path::new(&root_path))?;
    let source = ensure_existing_entry_for_operation(&root, Path::new(&path))?;
    let target = ensure_new_target_inside_root(&root, Path::new(&new_relative_path))?;

    fs::rename(source, target).map_err(|err| err.to_string())
}

#[cfg(test)]
fn scan_tree(root: &Path) -> Result<Vec<FileNode>, String> {
    scan_tree_with_options(root, TreeOptions::default())
}

pub fn scan_tree_with_options(root: &Path, options: TreeOptions) -> Result<Vec<FileNode>, String> {
    let root = canonical_root(root)?;
    scan_tree_from_root(&root, &root, &options)
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

fn ensure_existing_entry_for_operation(root: &Path, path: &Path) -> Result<PathBuf, String> {
    let root = canonical_root(root)?;
    let target = if path.is_absolute() {
        path.to_path_buf()
    } else {
        root.join(path)
    };
    let parent = target
        .parent()
        .ok_or_else(|| "entry path must have a parent directory".to_string())?
        .canonicalize()
        .map_err(|err| err.to_string())?;

    if !parent.starts_with(&root) {
        return Err("path is outside project root".to_string());
    }

    let metadata = fs::symlink_metadata(&target).map_err(|err| err.to_string())?;
    if metadata.file_type().is_symlink() {
        return Err("cannot operate on symlink entries".to_string());
    }

    let target = target.canonicalize().map_err(|err| err.to_string())?;

    if target == root {
        Err("cannot operate on the project root".to_string())
    } else {
        Ok(target)
    }
}

fn ensure_new_target_inside_root(root: &Path, target_path: &Path) -> Result<PathBuf, String> {
    let root = canonical_root(root)?;
    validate_new_target_path(target_path)?;
    let target = if target_path.is_absolute() {
        target_path.to_path_buf()
    } else {
        root.join(target_path)
    };
    let parent = target
        .parent()
        .ok_or_else(|| "target path must have a parent directory".to_string())?
        .canonicalize()
        .map_err(|err| err.to_string())?;

    if !parent.starts_with(&root) {
        return Err("path is outside project root".to_string());
    }

    if target.exists() {
        return Err("target already exists".to_string());
    }

    Ok(target)
}

fn validate_new_target_path(target_path: &Path) -> Result<(), String> {
    let mut components = target_path.components();
    let last = components
        .next_back()
        .ok_or_else(|| "path cannot be empty".to_string())?;

    if !matches!(last, Component::Normal(name) if !name.is_empty()) {
        return Err("path must end with a valid name".to_string());
    }

    Ok(())
}

fn validate_entry_name(name: &str) -> Result<(), String> {
    if name.trim().is_empty() {
        return Err("name cannot be empty".to_string());
    }
    if name.contains('/') || name.contains('\\') {
        return Err("name cannot contain path separators".to_string());
    }
    if !matches!(
        Path::new(name).components().next(),
        Some(Component::Normal(_))
    ) {
        return Err("name must be a file or folder name".to_string());
    }
    if Path::new(name).components().count() != 1 {
        return Err("name must be a file or folder name".to_string());
    }

    Ok(())
}

fn scan_tree_from_root(
    root: &Path,
    directory: &Path,
    options: &TreeOptions,
) -> Result<Vec<FileNode>, String> {
    if !directory.is_dir() {
        return Err("project root is not a directory".to_string());
    }

    let mut nodes = Vec::new();
    for entry in fs::read_dir(directory).map_err(|err| err.to_string())? {
        let entry = entry.map_err(|err| err.to_string())?;
        let path = entry.path();
        if should_skip(&path, options) {
            continue;
        }
        nodes.push(node_from_path(root, &path, options)?);
    }

    nodes.sort_by(|a, b| {
        a.name
            .to_lowercase()
            .cmp(&b.name.to_lowercase())
            .then_with(|| a.name.cmp(&b.name))
    });
    Ok(nodes)
}

fn node_from_path(root: &Path, path: &Path, options: &TreeOptions) -> Result<FileNode, String> {
    let metadata = fs::symlink_metadata(path).map_err(|err| err.to_string())?;
    let kind = if metadata.is_dir() {
        FileKind::Directory
    } else {
        FileKind::File
    };
    let children = if metadata.is_dir() {
        Some(scan_tree_from_root(root, path, options)?)
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

fn should_skip(path: &Path, options: &TreeOptions) -> bool {
    let file_name = path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("");
    if options.ignore_hidden && file_name.starts_with('.') {
        return true;
    }

    fs::symlink_metadata(path)
        .map(|metadata| {
            metadata.file_type().is_symlink()
                || (options.ignore_large_files
                    && metadata.is_file()
                    && metadata.len() > LARGE_FILE_LIMIT_BYTES)
                || (options.ignore_binary_files
                    && metadata.is_file()
                    && is_probably_binary(path, metadata.len()))
        })
        .unwrap_or(false)
}

fn is_probably_binary(path: &Path, size: u64) -> bool {
    if size == 0 {
        return false;
    }

    let mut file = match fs::File::open(path) {
        Ok(file) => file,
        Err(_) => return true,
    };
    let mut sample = [0; 1024];
    let bytes_read = match file.read(&mut sample) {
        Ok(bytes_read) => bytes_read,
        Err(_) => return true,
    };

    sample[..bytes_read].contains(&0)
}

fn extension(path: &Path) -> String {
    path.extension()
        .and_then(|ext| ext.to_str())
        .unwrap_or("")
        .to_lowercase()
}

fn default_true() -> bool {
    true
}

impl Default for TreeOptions {
    fn default() -> Self {
        Self {
            ignore_hidden: true,
            ignore_large_files: true,
            ignore_binary_files: true,
        }
    }
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
    fn tree_scan_options_control_hidden_large_and_binary_files() {
        let root = temp_root();
        fs::write(root.path().join(".hidden.md"), "# Hidden").unwrap();
        fs::write(root.path().join("chapter.md"), "# Chapter").unwrap();
        fs::write(root.path().join("binary.bin"), [0, 159, 146, 150]).unwrap();
        fs::write(
            root.path().join("large.md"),
            "x".repeat((LARGE_FILE_LIMIT_BYTES + 1) as usize),
        )
        .unwrap();

        let default_tree = scan_tree(root.path()).unwrap();
        assert!(default_tree.iter().any(|node| node.name == "chapter.md"));
        assert!(!default_tree.iter().any(|node| node.name == ".hidden.md"));
        assert!(!default_tree.iter().any(|node| node.name == "binary.bin"));
        assert!(!default_tree.iter().any(|node| node.name == "large.md"));

        let permissive_tree = scan_tree_with_options(
            root.path(),
            TreeOptions {
                ignore_hidden: false,
                ignore_large_files: false,
                ignore_binary_files: false,
            },
        )
        .unwrap();

        assert!(permissive_tree.iter().any(|node| node.name == ".hidden.md"));
        assert!(permissive_tree.iter().any(|node| node.name == "binary.bin"));
        assert!(permissive_tree.iter().any(|node| node.name == "large.md"));
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

    #[test]
    fn creates_and_renames_entries_inside_root() {
        let root = temp_root();

        create_folder(
            root.path().to_string_lossy().to_string(),
            "drafts".to_string(),
        )
        .unwrap();
        create_file(
            root.path().to_string_lossy().to_string(),
            "drafts/chapter.md".to_string(),
        )
        .unwrap();
        rename_entry(
            root.path().to_string_lossy().to_string(),
            "drafts/chapter.md".to_string(),
            "chapter-1.md".to_string(),
        )
        .unwrap();

        assert!(root.path().join("drafts").join("chapter-1.md").is_file());
        assert!(!root.path().join("drafts").join("chapter.md").exists());
    }

    #[test]
    fn deletes_files_and_directories_but_not_project_root() {
        let root = temp_root();
        fs::create_dir(root.path().join("drafts")).unwrap();
        fs::write(root.path().join("drafts").join("chapter.md"), "# Chapter").unwrap();

        delete_entry(
            root.path().to_string_lossy().to_string(),
            "drafts".to_string(),
        )
        .unwrap();

        assert!(!root.path().join("drafts").exists());

        let err =
            delete_entry(root.path().to_string_lossy().to_string(), ".".to_string()).unwrap_err();
        assert!(err.contains("project root"));
    }

    #[test]
    fn moves_entries_inside_root() {
        let root = temp_root();
        fs::create_dir(root.path().join("drafts")).unwrap();
        fs::create_dir(root.path().join("archive")).unwrap();
        fs::write(root.path().join("drafts").join("chapter.md"), "# Chapter").unwrap();

        move_entry(
            root.path().to_string_lossy().to_string(),
            "drafts/chapter.md".to_string(),
            "archive/chapter.md".to_string(),
        )
        .unwrap();

        assert!(root.path().join("archive").join("chapter.md").is_file());
        assert!(!root.path().join("drafts").join("chapter.md").exists());
    }

    #[test]
    fn rejects_traversal_and_invalid_rename_names() {
        let root = temp_root();
        let outside = temp_root();
        fs::write(root.path().join("chapter.md"), "# Chapter").unwrap();

        let create_err = create_file(
            root.path().to_string_lossy().to_string(),
            "../outside.md".to_string(),
        )
        .unwrap_err();
        assert!(create_err.contains("outside project root"));

        let move_err = move_entry(
            root.path().to_string_lossy().to_string(),
            "chapter.md".to_string(),
            outside
                .path()
                .join("chapter.md")
                .to_string_lossy()
                .to_string(),
        )
        .unwrap_err();
        assert!(move_err.contains("outside project root"));

        let rename_err = rename_entry(
            root.path().to_string_lossy().to_string(),
            "chapter.md".to_string(),
            "drafts/chapter.md".to_string(),
        )
        .unwrap_err();
        assert!(rename_err.contains("name"));
    }

    #[cfg(unix)]
    #[test]
    fn delete_rejects_in_root_symlink_source_without_touching_target() {
        use std::os::unix::fs::symlink;

        let root = temp_root();
        let real = root.path().join("real.md");
        let link = root.path().join("link.md");
        fs::write(&real, "# Real").unwrap();
        symlink(&real, &link).unwrap();

        let err = delete_entry(
            root.path().to_string_lossy().to_string(),
            "link.md".to_string(),
        )
        .unwrap_err();

        assert!(err.contains("symlink"));
        assert_eq!(fs::read_to_string(&real).unwrap(), "# Real");
        assert!(fs::symlink_metadata(&link)
            .unwrap()
            .file_type()
            .is_symlink());
    }

    #[cfg(unix)]
    #[test]
    fn rename_rejects_in_root_symlink_source_without_touching_target() {
        use std::os::unix::fs::symlink;

        let root = temp_root();
        let real = root.path().join("real.md");
        let link = root.path().join("link.md");
        fs::write(&real, "# Real").unwrap();
        symlink(&real, &link).unwrap();

        let err = rename_entry(
            root.path().to_string_lossy().to_string(),
            "link.md".to_string(),
            "renamed.md".to_string(),
        )
        .unwrap_err();

        assert!(err.contains("symlink"));
        assert_eq!(fs::read_to_string(&real).unwrap(), "# Real");
        assert!(fs::symlink_metadata(&link)
            .unwrap()
            .file_type()
            .is_symlink());
        assert!(!root.path().join("renamed.md").exists());
    }

    #[cfg(unix)]
    #[test]
    fn move_rejects_in_root_symlink_source_without_touching_target() {
        use std::os::unix::fs::symlink;

        let root = temp_root();
        let real = root.path().join("real.md");
        let link = root.path().join("link.md");
        fs::create_dir(root.path().join("archive")).unwrap();
        fs::write(&real, "# Real").unwrap();
        symlink(&real, &link).unwrap();

        let err = move_entry(
            root.path().to_string_lossy().to_string(),
            "link.md".to_string(),
            "archive/link.md".to_string(),
        )
        .unwrap_err();

        assert!(err.contains("symlink"));
        assert_eq!(fs::read_to_string(&real).unwrap(), "# Real");
        assert!(fs::symlink_metadata(&link)
            .unwrap()
            .file_type()
            .is_symlink());
        assert!(!root.path().join("archive").join("link.md").exists());
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
