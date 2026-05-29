use axum::{
    body::Body,
    http::{header, Uri},
    response::{Html, IntoResponse, Response},
};
use rust_embed::Embed;

#[derive(Embed)]
#[folder = "../frontend/dist/"]
#[prefix = ""]
struct Assets;

/// Serve embedded static files, with SPA fallback to index.html
pub async fn static_handler(uri: Uri) -> impl IntoResponse {
    let path = uri.path().trim_start_matches('/');

    // Try to find the exact file first
    if let Some(content) = Assets::get(path) {
        let mime = mime_guess::from_path(path).first_or_octet_stream();
        return Response::builder()
            .header(header::CONTENT_TYPE, mime.as_ref())
            .body(Body::from(content.data.to_vec()))
            .unwrap();
    }

    // SPA fallback: serve index.html for any non-file route
    if let Some(content) = Assets::get("index.html") {
        return Html(String::from_utf8_lossy(&content.data).to_string()).into_response();
    }

    // No frontend built yet - return a placeholder
    Html(
        r#"<html><head><title>SECRETUM</title><style>
        body{background:#0B0E14;color:#E0E8F0;font-family:'Inter','Noto Sans SC',sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}
        h1{color:#00F0FF;font-size:3rem;letter-spacing:8px;text-transform:uppercase}
        </style></head><body><h1>SECRETUM</h1></body></html>"#,
    )
    .into_response()
}
