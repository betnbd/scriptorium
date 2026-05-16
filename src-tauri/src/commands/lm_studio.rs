use serde::{Deserialize, Serialize};
use std::time::Duration;

const LM_STUDIO_TIMEOUT: Duration = Duration::from_secs(120);

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LmStudioRequest {
    pub base_url: String,
    pub model: String,
    pub prompt: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LmStudioResponse {
    pub content: String,
}

#[tauri::command]
pub async fn send_lm_studio_request(request: LmStudioRequest) -> Result<LmStudioResponse, String> {
    let url = lm_studio_chat_completions_url(&request.base_url)?;
    let body = serde_json::json!({
        "model": request.model,
        "messages": [
            { "role": "user", "content": request.prompt }
        ],
        "temperature": 0.7
    });

    let client = reqwest::Client::builder()
        .timeout(LM_STUDIO_TIMEOUT)
        .build()
        .map_err(|err| format!("Could not configure LM Studio client: {err}"))?;

    let response = client
        .post(url)
        .json(&body)
        .send()
        .await
        .map_err(|err| format!("Network error while contacting LM Studio: {err}"))?;

    let status = response.status();
    let response_body = response
        .text()
        .await
        .map_err(|err| format!("Network error while reading LM Studio response: {err}"))?;

    if !status.is_success() {
        return Err(format!("LM Studio returned HTTP {status}: {response_body}"));
    }

    let value: serde_json::Value = serde_json::from_str(&response_body)
        .map_err(|err| format!("Malformed LM Studio response JSON: {err}"))?;
    let content = value["choices"][0]["message"]["content"]
        .as_str()
        .ok_or_else(|| {
            "Malformed LM Studio response: choices[0].message.content was missing".to_string()
        })?
        .to_string();

    Ok(LmStudioResponse { content })
}

fn lm_studio_chat_completions_url(base_url: &str) -> Result<reqwest::Url, String> {
    let trimmed = base_url.trim().trim_end_matches('/');
    if trimmed.is_empty() {
        return Err("LM Studio base URL cannot be empty".to_string());
    }

    let mut url = reqwest::Url::parse(trimmed)
        .map_err(|err| format!("LM Studio base URL is not a valid URL: {err}"))?;
    if !matches!(url.scheme(), "http" | "https") {
        return Err("LM Studio base URL must use http or https".to_string());
    }

    let host = url
        .host_str()
        .ok_or_else(|| "LM Studio base URL must include a host".to_string())?;
    if !matches!(host, "localhost" | "127.0.0.1" | "::1") {
        return Err(
            "LM Studio base URL must point to localhost or 127.0.0.1 for local manuscript privacy."
                .to_string(),
        );
    }

    let base_path = url.path().trim_end_matches('/');
    url.set_path(&format!("{base_path}/chat/completions"));
    url.set_query(None);
    url.set_fragment(None);

    Ok(url)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn builds_chat_completions_url_for_loopback_hosts() {
        assert_eq!(
            lm_studio_chat_completions_url("http://127.0.0.1:1234/v1")
                .unwrap()
                .as_str(),
            "http://127.0.0.1:1234/v1/chat/completions"
        );
        assert_eq!(
            lm_studio_chat_completions_url("http://localhost:1234/v1/")
                .unwrap()
                .as_str(),
            "http://localhost:1234/v1/chat/completions"
        );
    }

    #[test]
    fn rejects_non_local_lm_studio_urls() {
        let error = lm_studio_chat_completions_url("https://example.com/v1").unwrap_err();

        assert!(error.contains("localhost"));
    }
}
