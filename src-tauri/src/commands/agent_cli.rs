use serde::{Deserialize, Serialize};
use std::env;
use std::ffi::OsString;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::thread;
use std::time::SystemTime;
use std::time::{Duration, Instant};

const AGENT_TIMEOUT: Duration = Duration::from_secs(240);

#[derive(Debug, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum CliAgentProvider {
    OpenaiSubscription,
    AnthropicSubscription,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CliAgentRequest {
    pub provider: CliAgentProvider,
    pub root_path: String,
    pub prompt: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CliAgentResponse {
    pub content: String,
}

#[derive(Debug, PartialEq, Eq)]
struct AgentCommandSpec {
    program: OsString,
    args: Vec<OsString>,
    output_path: Option<PathBuf>,
}

#[tauri::command]
pub fn send_cli_agent_request(request: CliAgentRequest) -> Result<CliAgentResponse, String> {
    let root = canonical_root(Path::new(&request.root_path))?;
    let spec = command_spec_for_provider(&request.provider, &root)?;
    let content = run_agent_command(spec, &root, &request.prompt)?;

    Ok(CliAgentResponse { content })
}

fn command_spec_for_provider(
    provider: &CliAgentProvider,
    root: &Path,
) -> Result<AgentCommandSpec, String> {
    command_spec_for_provider_with_resolver(provider, root, resolve_command)
}

fn command_spec_for_provider_with_resolver<F>(
    provider: &CliAgentProvider,
    root: &Path,
    resolver: F,
) -> Result<AgentCommandSpec, String>
where
    F: Fn(&str) -> Result<OsString, String>,
{
    match provider {
        CliAgentProvider::OpenaiSubscription => {
            let output_path = temp_output_path("codex");
            Ok(AgentCommandSpec {
                program: resolver("codex")?,
                args: vec![
                    "exec".into(),
                    "--skip-git-repo-check".into(),
                    "--ephemeral".into(),
                    "--ignore-rules".into(),
                    "--sandbox".into(),
                    "read-only".into(),
                    "--color".into(),
                    "never".into(),
                    "--output-last-message".into(),
                    output_path.as_os_str().to_owned(),
                    "-C".into(),
                    root.as_os_str().to_owned(),
                    "-".into(),
                ],
                output_path: Some(output_path),
            })
        }
        CliAgentProvider::AnthropicSubscription => Ok(AgentCommandSpec {
            program: resolver("claude")?,
            args: vec![
                "--print".into(),
                "--output-format".into(),
                "text".into(),
                "--no-session-persistence".into(),
                "--permission-mode".into(),
                "default".into(),
                "--tools".into(),
                "".into(),
            ],
            output_path: None,
        }),
    }
}

fn run_agent_command(spec: AgentCommandSpec, root: &Path, prompt: &str) -> Result<String, String> {
    if prompt.trim().is_empty() {
        return Err("Assistant prompt cannot be empty.".to_string());
    }

    let mut child = Command::new(&spec.program)
        .args(spec.args)
        .current_dir(root)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|err| format!("Could not start {}: {err}", display_program(&spec.program)))?;

    if let Some(mut stdin) = child.stdin.take() {
        stdin
            .write_all(prompt.as_bytes())
            .and_then(|_| stdin.flush())
            .map_err(|err| format!("Could not send prompt to agent: {err}"))?;
    }

    let started_at = Instant::now();

    loop {
        match child.try_wait() {
            Ok(Some(_status)) => {
                let output = child
                    .wait_with_output()
                    .map_err(|err| format!("Could not read agent output: {err}"))?;
                return parse_command_output(output, spec.output_path.as_deref());
            }
            Ok(None) => {
                if started_at.elapsed() > AGENT_TIMEOUT {
                    let _ = child.kill();
                    let _ = child.wait();
                    cleanup_output_path(spec.output_path.as_deref());
                    return Err("Assistant request timed out.".to_string());
                }
                thread::sleep(Duration::from_millis(100));
            }
            Err(err) => {
                let _ = child.kill();
                let _ = child.wait();
                cleanup_output_path(spec.output_path.as_deref());
                return Err(format!("Could not wait for agent process: {err}"));
            }
        }
    }
}

fn parse_command_output(
    output: std::process::Output,
    output_path: Option<&Path>,
) -> Result<String, String> {
    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();

    if !output.status.success() {
        cleanup_output_path(output_path);
        return Err(if stderr.is_empty() {
            format!("Agent exited with status {}.", output.status)
        } else {
            stderr
        });
    }

    let content = if let Some(path) = output_path {
        let text = std::fs::read_to_string(path)
            .map_err(|err| format!("Could not read Codex response file: {err}"))?;
        cleanup_output_path(Some(path));
        text.trim().to_string()
    } else {
        stdout
    };

    if content.is_empty() {
        Err("Agent returned an empty response.".to_string())
    } else {
        Ok(content)
    }
}

fn resolve_command(name: &str) -> Result<OsString, String> {
    if name.contains('/') {
        return Ok(name.into());
    }

    let mut candidates = path_candidates(name);

    if let Some(home) = env::var_os("HOME") {
        candidates.push(PathBuf::from(&home).join(".local/bin").join(name));
        candidates.push(PathBuf::from(home).join(".npm-global/bin").join(name));
    }

    candidates.push(PathBuf::from("/usr/local/bin").join(name));
    candidates.push(PathBuf::from("/usr/bin").join(name));

    candidates
        .into_iter()
        .find(|candidate| candidate.is_file())
        .map(|candidate| candidate.into_os_string())
        .ok_or_else(|| format!("{name} was not found. Sign in or install the provider CLI first."))
}

fn path_candidates(name: &str) -> Vec<PathBuf> {
    env::var_os("PATH")
        .map(|path| {
            env::split_paths(&path)
                .map(|directory| directory.join(name))
                .collect()
        })
        .unwrap_or_default()
}

fn canonical_root(root: &Path) -> Result<PathBuf, String> {
    let root = root.canonicalize().map_err(|err| err.to_string())?;
    if root.is_dir() {
        Ok(root)
    } else {
        Err("project root is not a directory".to_string())
    }
}

fn temp_output_path(provider: &str) -> PathBuf {
    let nanos = SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .map(|duration| duration.as_nanos())
        .unwrap_or_default();

    env::temp_dir().join(format!(
        "draftagent-{provider}-{}-{nanos}.txt",
        std::process::id()
    ))
}

fn cleanup_output_path(path: Option<&Path>) {
    if let Some(path) = path {
        let _ = std::fs::remove_file(path);
    }
}

fn display_program(program: &OsString) -> String {
    program.to_string_lossy().into_owned()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::os::unix::process::ExitStatusExt;

    #[test]
    fn builds_codex_subscription_command_with_read_only_project_root() {
        let root = PathBuf::from("/tmp/novel");
        let spec = command_spec_for_provider_with_resolver(
            &CliAgentProvider::OpenaiSubscription,
            &root,
            fake_resolver,
        )
        .expect("codex command should build");
        let args: Vec<String> = spec
            .args
            .iter()
            .map(|arg| arg.to_string_lossy().into_owned())
            .collect();

        assert!(spec.program.to_string_lossy().contains("codex"));
        assert!(args.contains(&"exec".to_string()));
        assert!(args.contains(&"read-only".to_string()));
        assert!(args.contains(&"--output-last-message".to_string()));
        assert!(args.contains(&"/tmp/novel".to_string()));
        assert!(args.contains(&"-".to_string()));
        assert!(spec.output_path.is_some());
    }

    #[test]
    fn builds_claude_subscription_command_without_file_tools() {
        let root = PathBuf::from("/tmp/novel");
        let spec = command_spec_for_provider_with_resolver(
            &CliAgentProvider::AnthropicSubscription,
            &root,
            fake_resolver,
        )
        .expect("claude command should build");
        let args: Vec<String> = spec
            .args
            .iter()
            .map(|arg| arg.to_string_lossy().into_owned())
            .collect();

        assert!(spec.program.to_string_lossy().contains("claude"));
        assert!(args.contains(&"--print".to_string()));
        assert!(args.contains(&"--no-session-persistence".to_string()));
        assert!(args.contains(&"--tools".to_string()));
        assert!(args.contains(&"".to_string()));
        assert!(spec.output_path.is_none());
    }

    #[test]
    fn rejects_empty_prompts_before_starting_a_process() {
        let spec = AgentCommandSpec {
            program: "definitely-missing-agent".into(),
            args: vec![],
            output_path: None,
        };

        let error = run_agent_command(spec, Path::new("."), "  ").unwrap_err();

        assert_eq!(error, "Assistant prompt cannot be empty.");
    }

    #[test]
    fn reads_codex_last_message_file_instead_of_transcript_stdout() {
        let path = temp_output_path("test");
        std::fs::write(&path, "final answer\n").expect("temp output should write");
        let output = std::process::Output {
            status: std::process::ExitStatus::from_raw(0),
            stdout: b"codex transcript\nfinal answer\n".to_vec(),
            stderr: vec![],
        };

        let result = parse_command_output(output, Some(&path)).unwrap();

        assert_eq!(result, "final answer");
        assert!(!path.exists());
    }

    fn fake_resolver(name: &str) -> Result<OsString, String> {
        Ok(format!("/bin/{name}").into())
    }
}
