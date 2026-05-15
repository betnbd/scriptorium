use serde::{Deserialize, Serialize};

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
    let base_url = request.base_url.trim_end_matches('/');
    if base_url.is_empty() {
        return Err("LM Studio base URL cannot be empty".to_string());
    }

    let url = format!("{base_url}/chat/completions");
    let body = serde_json::json!({
        "model": request.model,
        "messages": [
            { "role": "user", "content": request.prompt }
        ],
        "temperature": 0.7
    });

    let response = reqwest::Client::new()
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
