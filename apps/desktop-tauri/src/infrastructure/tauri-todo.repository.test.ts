import { clearMocks, mockIPC } from "@tauri-apps/api/mocks";
import { createTodo, listTodos, updateTodo } from "@monorepo-template/application";
import { unwrap } from "@monorepo-template/domain/types";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { NewTodo, TodoDto, TodoPatch } from "../bindings";
import { TauriTodoRepository } from "./tauri-todo.repository";

const USER = "local-user";

/**
 * A stand-in for the Rust core at the IPC layer. Going through Tauri's own
 * `mockIPC` (rather than faking `commands`) also checks the wire format: the
 * command names and argument keys the generated bindings send.
 */
function installFakeCore(): { calls: { cmd: string; args: unknown }[] } {
  const rows = new Map<string, TodoDto>();
  const calls: { cmd: string; args: unknown }[] = [];
  let clock = 1_000;

  mockIPC((cmd, payload) => {
    const args = payload as Record<string, unknown>;
    calls.push({ cmd, args });
    const own = (id: unknown) => {
      const row = rows.get(id as string);
      return row && row.userId === args.userId ? row : null;
    };

    switch (cmd) {
      case "todos_create": {
        const input = args.input as NewTodo;
        const now = ++clock;
        const row: TodoDto = {
          id: `todo-${rows.size + 1}`,
          ...input,
          completed: false,
          createdAt: now,
          updatedAt: now,
        };
        rows.set(row.id, row);
        return row;
      }
      case "todos_find_by_id":
        return own(args.id);
      case "todos_list_paginated": {
        const mine = [...rows.values()].filter((row) => row.userId === args.userId);
        const offset = args.offset as number;
        return { data: mine.slice(offset, offset + (args.limit as number)), total: mine.length };
      }
      case "todos_update": {
        const row = own(args.id);
        if (!row) return null;
        const patch = args.patch as TodoPatch;
        const next: TodoDto = {
          ...row,
          title: patch.title ?? row.title,
          completed: patch.completed ?? row.completed,
          categoryId: patch.category.kind === "keep" ? row.categoryId : patch.category.value,
          updatedAt: ++clock,
        };
        rows.set(row.id, next);
        return next;
      }
      case "todos_delete":
        return rows.delete(args.id as string);
      default:
        throw new Error(`unexpected command: ${cmd}`);
    }
  });

  return { calls };
}

describe("TauriTodoRepository", () => {
  let repo: TauriTodoRepository;
  let core: ReturnType<typeof installFakeCore>;

  beforeEach(() => {
    core = installFakeCore();
    repo = new TauriTodoRepository();
  });

  afterEach(() => clearMocks());

  it("runs the shared use cases unchanged", async () => {
    const created = await createTodo(repo, { title: "Write the ADR" }, USER);
    await updateTodo(repo, created.id, USER, { completed: true });

    const page = unwrap(
      await listTodos({ repo, userId: USER, pagination: { page: 1, limit: 100 } }),
    );

    expect(page.data).toHaveLength(1);
    expect(page.data[0]).toMatchObject({ title: "Write the ADR", completed: true });
    expect(page.data[0]?.createdAt).toBeInstanceOf(Date);
  });

  it("sends the argument names the Rust commands expect", async () => {
    await repo.create({ title: "Wire check", userId: USER });

    expect(core.calls.at(-1)).toEqual({
      cmd: "todos_create",
      args: { input: { title: "Wire check", categoryId: null, userId: USER } },
    });
  });

  it("keeps the category when the update leaves it out, and clears it on null", async () => {
    const created = await repo.create({ title: "Categorized", categoryId: "work", userId: USER });

    expect((await repo.update(created.id, USER, { title: "Renamed" }))?.categoryId).toBe("work");
    expect((await repo.update(created.id, USER, { categoryId: null }))?.categoryId).toBeNull();
  });

  it("returns null for a todo the user does not own", async () => {
    const created = await repo.create({ title: "Theirs", userId: USER });

    expect(await repo.findById(created.id, "someone-else")).toBeNull();
  });

  it("rejects a response with a missing timestamp", async () => {
    clearMocks();
    mockIPC(() => ({
      id: "x",
      title: "Broken",
      completed: false,
      categoryId: null,
      userId: USER,
      createdAt: null,
      updatedAt: null,
    }));

    await expect(repo.findById("x", USER)).rejects.toThrow("createdAt");
  });
});
