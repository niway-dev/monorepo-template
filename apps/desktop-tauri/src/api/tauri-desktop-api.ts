import { createTodo, deleteTodo, listTodos, updateTodo } from "@monorepo-template/application";
import type { ITodoRepository } from "@monorepo-template/domain/repositories";
import { createTodoSchema, updateTodoSchema } from "@monorepo-template/domain/schemas";
import { unwrap } from "@monorepo-template/domain/types";
import { commands, events } from "../bindings";
import { TauriTodoRepository } from "../infrastructure/tauri-todo.repository";
import { LOCAL_USER_ID } from "./local-user";
import type { DesktopApi } from "./types";

/**
 * One page is enough for a local list; a real app would surface pagination in the
 * UI. 100 is the ceiling `paginationQuerySchema` allows, so staying at it keeps
 * this call valid against the same contract the HTTP API validates.
 */
const LIST_PAGE_SIZE = 100;

/**
 * Composition root of the renderer. The shared use cases run here, in the
 * webview, against `TauriTodoRepository`; storage stays in the Rust core behind
 * typed commands. Compare the Electron app, where the use cases run in the main
 * process and the renderer calls them over IPC — the port is the same, only the
 * side of the boundary it sits on differs.
 */
export function createTauriDesktopApi(
  repository: ITodoRepository = new TauriTodoRepository(),
): DesktopApi {
  return {
    settings: {
      get: () => commands.settingsGet(),
      setLocale: (locale) => commands.settingsSetLocale(locale),
      setTheme: (theme) => commands.settingsSetTheme(theme),
      onChanged: (listener) => {
        const unlisten = events.settingsChanged.listen((event) => listener(event.payload));
        return () => void unlisten.then((stop) => stop());
      },
    },
    todos: {
      list: async () => {
        const result = await listTodos({
          repo: repository,
          userId: LOCAL_USER_ID,
          pagination: { page: 1, limit: LIST_PAGE_SIZE },
        });
        return unwrap(result).data;
      },
      // Validate with the same domain schemas the server uses before a use case
      // runs; the Rust core re-checks the title as the last line of defence.
      create: (input) => createTodo(repository, createTodoSchema.parse(input), LOCAL_USER_ID),
      update: (id, input) =>
        updateTodo(repository, id, LOCAL_USER_ID, updateTodoSchema.parse(input)),
      remove: (id) => deleteTodo(repository, id, LOCAL_USER_ID),
    },
  };
}
