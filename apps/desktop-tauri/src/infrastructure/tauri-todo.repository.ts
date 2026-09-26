import type { ITodoRepository } from "@monorepo-template/domain/repositories";
import type { CreateTodo, TodoBase, UpdateTodo } from "@monorepo-template/domain/schemas";
import { commands, type CategoryPatch, type TodoDto } from "../bindings";

/** The subset of the generated bindings this adapter needs — injectable for tests. */
export type TodoCommands = Pick<
  typeof commands,
  | "todosFindById"
  | "todosList"
  | "todosListPaginated"
  | "todosCreate"
  | "todosUpdate"
  | "todosDelete"
>;

/**
 * specta types an `f64` as `number | null` (serde turns NaN into null). The core
 * only ever sends finite epoch milliseconds, so a null here is a broken contract.
 */
function toDate(ms: number | null, field: string): Date {
  if (ms === null) throw new Error(`todo.${field} is missing`);
  return new Date(ms);
}

function toDomain(dto: TodoDto): TodoBase {
  return {
    id: dto.id,
    title: dto.title,
    completed: dto.completed,
    categoryId: dto.categoryId,
    userId: dto.userId,
    createdAt: toDate(dto.createdAt, "createdAt"),
    updatedAt: toDate(dto.updatedAt, "updatedAt"),
  };
}

/** `undefined` means "leave it"; `null` means "clear it". */
function toCategoryPatch(categoryId: UpdateTodo["categoryId"]): CategoryPatch {
  return categoryId === undefined ? { kind: "keep" } : { kind: "set", value: categoryId };
}

/**
 * The Tauri adapter for `ITodoRepository` — the third one, after `infra-db`
 * (Postgres, for the server) and the Electron main-process SQLite adapter.
 *
 * It runs in the webview and owns no SQL: each method is one typed command in
 * `src-tauri/src/todos.rs`, which holds the connection and the statements. The
 * use cases in `@monorepo-template/application` call it without knowing that.
 */
export class TauriTodoRepository implements ITodoRepository {
  constructor(private readonly native: TodoCommands = commands) {}

  async findById(id: string, userId: string): Promise<TodoBase | null> {
    const dto = await this.native.todosFindById(id, userId);
    return dto ? toDomain(dto) : null;
  }

  async findAllByUserId(userId: string): Promise<TodoBase[]> {
    return (await this.native.todosList(userId)).map(toDomain);
  }

  async findAllByUserIdPaginated(
    userId: string,
    limit: number,
    offset: number,
  ): Promise<{ data: TodoBase[]; total: number }> {
    const page = await this.native.todosListPaginated(userId, limit, offset);
    return { data: page.data.map(toDomain), total: page.total };
  }

  async create(data: CreateTodo & { userId: string }): Promise<TodoBase> {
    const dto = await this.native.todosCreate({
      title: data.title,
      categoryId: data.categoryId ?? null,
      userId: data.userId,
    });
    return toDomain(dto);
  }

  async update(id: string, userId: string, data: UpdateTodo): Promise<TodoBase | null> {
    const dto = await this.native.todosUpdate(id, userId, {
      title: data.title ?? null,
      completed: data.completed ?? null,
      category: toCategoryPatch(data.categoryId),
    });
    return dto ? toDomain(dto) : null;
  }

  async delete(id: string, userId: string): Promise<boolean> {
    return this.native.todosDelete(id, userId);
  }
}
