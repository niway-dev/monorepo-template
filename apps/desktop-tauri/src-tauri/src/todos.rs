//! The storage half of `ITodoRepository`.
//!
//! The use cases live in TypeScript (`@monorepo-template/application`) and run in
//! the renderer. `src/infrastructure/tauri-todo.repository.ts` implements the port
//! by calling the commands below, one per port method. Every statement here is
//! fixed and parameterized: the webview never sends SQL.

use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

use rusqlite::{params, Connection, OptionalExtension, Row};
use serde::{Deserialize, Serialize};
use specta::Type;
use tauri::State;

use crate::error::{to_message, Error, Result};

/// Mirrors the `max(500)` in the domain's todo schema. The renderer validates
/// first; this is the check that still holds if the webview is compromised.
const TITLE_MAX_CHARS: usize = 500;

/// The one SQLite connection, shared by every command.
pub struct Db(pub Mutex<Connection>);

/// A todo as it crosses the IPC boundary. Timestamps are epoch milliseconds as
/// `f64`: exact up to 2^53, and a plain `number` in TypeScript rather than the
/// `bigint` an `i64` would need.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct TodoDto {
    pub id: String,
    pub title: String,
    pub completed: bool,
    pub category_id: Option<String>,
    pub user_id: String,
    pub created_at: f64,
    pub updated_at: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct NewTodo {
    pub title: String,
    pub category_id: Option<String>,
    pub user_id: String,
}

/// `categoryId` has three states in the domain's `UpdateTodo`: absent (keep),
/// `null` (clear) and a string (set). JSON cannot carry "absent" through a
/// typed binding, so the patch spells it out.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum CategoryPatch {
    Keep,
    Set { value: Option<String> },
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct TodoPatch {
    pub title: Option<String>,
    pub completed: Option<bool>,
    pub category: CategoryPatch,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct TodoPage {
    pub data: Vec<TodoDto>,
    pub total: u32,
}

fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

fn validate_title(title: &str) -> Result<()> {
    if title.trim().is_empty() {
        return Err(Error::Invalid("Title is required".into()));
    }
    if title.chars().count() > TITLE_MAX_CHARS {
        return Err(Error::Invalid(format!(
            "Title must be at most {TITLE_MAX_CHARS} characters"
        )));
    }
    Ok(())
}

fn from_row(row: &Row<'_>) -> rusqlite::Result<TodoDto> {
    Ok(TodoDto {
        id: row.get("id")?,
        title: row.get("title")?,
        completed: row.get::<_, i64>("completed")? == 1,
        category_id: row.get("category_id")?,
        user_id: row.get("user_id")?,
        created_at: row.get::<_, i64>("created_at")? as f64,
        updated_at: row.get::<_, i64>("updated_at")? as f64,
    })
}

// ---------------------------------------------------------------------------
// Queries — plain functions over a connection, so tests need no Tauri runtime.
// ---------------------------------------------------------------------------

pub fn find_by_id(conn: &Connection, id: &str, user_id: &str) -> Result<Option<TodoDto>> {
    Ok(conn
        .query_row(
            "SELECT * FROM todos WHERE id = ?1 AND user_id = ?2",
            params![id, user_id],
            from_row,
        )
        .optional()?)
}

pub fn list(conn: &Connection, user_id: &str) -> Result<Vec<TodoDto>> {
    let mut stmt =
        conn.prepare("SELECT * FROM todos WHERE user_id = ?1 ORDER BY updated_at DESC")?;
    let rows = stmt.query_map(params![user_id], from_row)?;
    Ok(rows.collect::<rusqlite::Result<_>>()?)
}

pub fn list_paginated(
    conn: &Connection,
    user_id: &str,
    limit: u32,
    offset: u32,
) -> Result<TodoPage> {
    let mut stmt = conn.prepare(
        "SELECT * FROM todos WHERE user_id = ?1 ORDER BY updated_at DESC LIMIT ?2 OFFSET ?3",
    )?;
    let data = stmt
        .query_map(params![user_id, limit, offset], from_row)?
        .collect::<rusqlite::Result<_>>()?;
    let total: u32 = conn.query_row(
        "SELECT COUNT(*) FROM todos WHERE user_id = ?1",
        params![user_id],
        |row| row.get(0),
    )?;
    Ok(TodoPage { data, total })
}

pub fn create(conn: &Connection, input: NewTodo) -> Result<TodoDto> {
    validate_title(&input.title)?;
    let now = now_ms();
    let todo = TodoDto {
        id: uuid::Uuid::new_v4().to_string(),
        title: input.title,
        completed: false,
        category_id: input.category_id,
        user_id: input.user_id,
        created_at: now as f64,
        updated_at: now as f64,
    };
    conn.execute(
        "INSERT INTO todos (id, title, completed, category_id, user_id, created_at, updated_at)
         VALUES (?1, ?2, 0, ?3, ?4, ?5, ?5)",
        params![todo.id, todo.title, todo.category_id, todo.user_id, now],
    )?;
    Ok(todo)
}

/// Read-modify-write in one transaction, so a concurrent write cannot land
/// between the read and the update.
pub fn update(
    conn: &mut Connection,
    id: &str,
    user_id: &str,
    patch: TodoPatch,
) -> Result<Option<TodoDto>> {
    if let Some(title) = &patch.title {
        validate_title(title)?;
    }
    let tx = conn.transaction()?;
    let Some(existing) = find_by_id(&tx, id, user_id)? else {
        return Ok(None);
    };
    let now = now_ms();
    let next = TodoDto {
        title: patch.title.unwrap_or(existing.title),
        completed: patch.completed.unwrap_or(existing.completed),
        category_id: match patch.category {
            CategoryPatch::Keep => existing.category_id,
            CategoryPatch::Set { value } => value,
        },
        updated_at: now as f64,
        ..existing
    };
    tx.execute(
        "UPDATE todos SET title = ?1, completed = ?2, category_id = ?3, updated_at = ?4
         WHERE id = ?5 AND user_id = ?6",
        params![
            next.title,
            next.completed as i64,
            next.category_id,
            now,
            id,
            user_id
        ],
    )?;
    tx.commit()?;
    Ok(Some(next))
}

pub fn delete(conn: &Connection, id: &str, user_id: &str) -> Result<bool> {
    let changed = conn.execute(
        "DELETE FROM todos WHERE id = ?1 AND user_id = ?2",
        params![id, user_id],
    )?;
    Ok(changed > 0)
}

// ---------------------------------------------------------------------------
// Commands — the driven side of the IPC boundary. No logic beyond locking.
// ---------------------------------------------------------------------------

fn with_conn<T>(
    db: &State<'_, Db>,
    f: impl FnOnce(&mut Connection) -> Result<T>,
) -> std::result::Result<T, String> {
    let mut conn =
        db.0.lock()
            .map_err(|_| "database lock poisoned".to_string())?;
    f(&mut conn).map_err(to_message)
}

#[tauri::command]
#[specta::specta]
pub fn todos_find_by_id(
    db: State<'_, Db>,
    id: String,
    user_id: String,
) -> std::result::Result<Option<TodoDto>, String> {
    with_conn(&db, |conn| find_by_id(conn, &id, &user_id))
}

#[tauri::command]
#[specta::specta]
pub fn todos_list(db: State<'_, Db>, user_id: String) -> std::result::Result<Vec<TodoDto>, String> {
    with_conn(&db, |conn| list(conn, &user_id))
}

#[tauri::command]
#[specta::specta]
pub fn todos_list_paginated(
    db: State<'_, Db>,
    user_id: String,
    limit: u32,
    offset: u32,
) -> std::result::Result<TodoPage, String> {
    with_conn(&db, |conn| list_paginated(conn, &user_id, limit, offset))
}

#[tauri::command]
#[specta::specta]
pub fn todos_create(db: State<'_, Db>, input: NewTodo) -> std::result::Result<TodoDto, String> {
    with_conn(&db, |conn| create(conn, input))
}

#[tauri::command]
#[specta::specta]
pub fn todos_update(
    db: State<'_, Db>,
    id: String,
    user_id: String,
    patch: TodoPatch,
) -> std::result::Result<Option<TodoDto>, String> {
    with_conn(&db, |conn| update(conn, &id, &user_id, patch))
}

#[tauri::command]
#[specta::specta]
pub fn todos_delete(
    db: State<'_, Db>,
    id: String,
    user_id: String,
) -> std::result::Result<bool, String> {
    with_conn(&db, |conn| delete(conn, &id, &user_id))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::open_in_memory;

    const USER: &str = "local-user";
    const OTHER: &str = "someone-else";

    fn new_todo(title: &str) -> NewTodo {
        NewTodo {
            title: title.into(),
            category_id: None,
            user_id: USER.into(),
        }
    }

    fn keep() -> TodoPatch {
        TodoPatch {
            title: None,
            completed: None,
            category: CategoryPatch::Keep,
        }
    }

    #[test]
    fn round_trips_a_todo() {
        let conn = open_in_memory().unwrap();
        let created = create(&conn, new_todo("Write the ADR")).unwrap();
        assert_eq!(
            find_by_id(&conn, &created.id, USER).unwrap(),
            Some(created.clone())
        );
        assert!(!created.completed);
    }

    #[test]
    fn scopes_every_read_to_the_owner() {
        let conn = open_in_memory().unwrap();
        let created = create(&conn, new_todo("Private")).unwrap();
        assert_eq!(find_by_id(&conn, &created.id, OTHER).unwrap(), None);
        assert!(list(&conn, OTHER).unwrap().is_empty());
    }

    #[test]
    fn applies_a_partial_update() {
        let mut conn = open_in_memory().unwrap();
        let created = create(&conn, new_todo("Original")).unwrap();
        let updated = update(
            &mut conn,
            &created.id,
            USER,
            TodoPatch {
                completed: Some(true),
                ..keep()
            },
        )
        .unwrap()
        .unwrap();
        assert!(updated.completed);
        assert_eq!(updated.title, "Original");
    }

    #[test]
    fn distinguishes_keeping_and_clearing_the_category() {
        let mut conn = open_in_memory().unwrap();
        let created = create(
            &conn,
            NewTodo {
                category_id: Some("work".into()),
                ..new_todo("Categorized")
            },
        )
        .unwrap();

        let kept = update(&mut conn, &created.id, USER, keep())
            .unwrap()
            .unwrap();
        assert_eq!(kept.category_id.as_deref(), Some("work"));

        let cleared = update(
            &mut conn,
            &created.id,
            USER,
            TodoPatch {
                category: CategoryPatch::Set { value: None },
                ..keep()
            },
        )
        .unwrap()
        .unwrap();
        assert_eq!(cleared.category_id, None);
    }

    #[test]
    fn will_not_update_a_todo_the_user_does_not_own() {
        let mut conn = open_in_memory().unwrap();
        let created = create(&conn, new_todo("Theirs")).unwrap();
        let patch = TodoPatch {
            title: Some("Hijacked".into()),
            ..keep()
        };
        assert_eq!(update(&mut conn, &created.id, OTHER, patch).unwrap(), None);
    }

    #[test]
    fn reports_whether_a_delete_removed_anything() {
        let conn = open_in_memory().unwrap();
        let created = create(&conn, new_todo("Temporary")).unwrap();
        assert!(!delete(&conn, &created.id, OTHER).unwrap());
        assert!(delete(&conn, &created.id, USER).unwrap());
        assert!(!delete(&conn, &created.id, USER).unwrap());
    }

    #[test]
    fn paginates_and_counts() {
        let conn = open_in_memory().unwrap();
        for i in 0..3 {
            create(&conn, new_todo(&format!("Todo {i}"))).unwrap();
        }
        let page = list_paginated(&conn, USER, 2, 0).unwrap();
        assert_eq!(page.data.len(), 2);
        assert_eq!(page.total, 3);
    }

    #[test]
    fn rejects_blank_and_oversized_titles() {
        let conn = open_in_memory().unwrap();
        assert!(create(&conn, new_todo("   ")).is_err());
        assert!(create(&conn, new_todo(&"x".repeat(TITLE_MAX_CHARS + 1))).is_err());
    }
}
