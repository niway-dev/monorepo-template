/// Every failure the Rust core can produce.
///
/// Commands return `Result<T, String>` rather than this type: the renderer only
/// needs a message to show, and a string keeps the generated bindings free of an
/// error type the TypeScript side would have to mirror.
#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error(transparent)]
    Db(#[from] rusqlite::Error),
    #[error(transparent)]
    Io(#[from] std::io::Error),
    #[error(transparent)]
    Json(#[from] serde_json::Error),
    #[error(transparent)]
    Tauri(#[from] tauri::Error),
    /// Input that is well-typed but breaks a rule the core enforces itself.
    #[error("{0}")]
    Invalid(String),
}

pub type Result<T> = std::result::Result<T, Error>;

/// Collapse a core error into the message a command hands back to the renderer.
pub fn to_message(error: Error) -> String {
    error.to_string()
}
