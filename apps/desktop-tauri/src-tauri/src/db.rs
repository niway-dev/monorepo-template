use std::path::Path;

use rusqlite::Connection;

use crate::error::Result;

/// Ordered schema steps. Step `n` runs once, when `PRAGMA user_version` is below
/// `n`, and the pragma is bumped in the same transaction — so a failed step
/// leaves the database exactly as it was. Append new steps; never edit a shipped
/// one.
///
/// Column shapes mirror `packages/infra-db`'s Drizzle table and the Electron
/// adapter, so every `ITodoRepository` adapter stays comparable: timestamps are
/// epoch milliseconds, and `completed` is 0/1 because SQLite has no boolean type.
const MIGRATIONS: &[&str] = &[
    // 1 — todos
    "CREATE TABLE IF NOT EXISTS todos (
        id          TEXT    PRIMARY KEY,
        title       TEXT    NOT NULL,
        completed   INTEGER NOT NULL DEFAULT 0,
        category_id TEXT,
        user_id     TEXT    NOT NULL,
        created_at  INTEGER NOT NULL,
        updated_at  INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS todos_user_id_idx ON todos (user_id);",
];

/// Open (creating if needed) the app database and bring its schema up to date.
pub fn open(path: &Path) -> Result<Connection> {
    if let Some(dir) = path.parent() {
        std::fs::create_dir_all(dir)?;
    }
    let mut conn = Connection::open(path)?;
    // WAL keeps reads from blocking on writes; foreign_keys is off by default.
    conn.pragma_update(None, "journal_mode", "WAL")?;
    conn.pragma_update(None, "foreign_keys", "ON")?;
    migrate(&mut conn)?;
    Ok(conn)
}

/// An in-memory database with the full schema, for tests.
#[cfg(test)]
pub fn open_in_memory() -> Result<Connection> {
    let mut conn = Connection::open_in_memory()?;
    migrate(&mut conn)?;
    Ok(conn)
}

fn migrate(conn: &mut Connection) -> Result<()> {
    let current: i64 = conn.pragma_query_value(None, "user_version", |row| row.get(0))?;
    for (index, sql) in MIGRATIONS.iter().enumerate() {
        let version = index as i64 + 1;
        if version <= current {
            continue;
        }
        let tx = conn.transaction()?;
        tx.execute_batch(sql)?;
        tx.pragma_update(None, "user_version", version)?;
        tx.commit()?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn migrations_set_user_version_and_are_idempotent() {
        let mut conn = open_in_memory().unwrap();
        migrate(&mut conn).unwrap();
        let version: i64 = conn
            .pragma_query_value(None, "user_version", |row| row.get(0))
            .unwrap();
        assert_eq!(version, MIGRATIONS.len() as i64);
    }
}
