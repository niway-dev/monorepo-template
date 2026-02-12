import { Elysia, t } from "elysia";
import { env } from "@/env/server";
import { createDatabaseClient } from "@monorepo-template/infra-db/client";
import { TodoRepository } from "@monorepo-template/infra-db/repositories";
import {
  createTodoSchema,
  updateTodoSchema,
  paginationQuerySchema,
} from "@monorepo-template/domain/schemas";
import { listTodos } from "@monorepo-template/application";
import { authMacro } from "../plugins/auth.plugin";
import { errorHandlerPlugin } from "../utils/error-handler-plugin";
import { successBody, createdBody } from "../utils/response-helpers";
import { NotFoundError } from "../utils/errors";
import z from "zod";

export const todoRoutes = new Elysia({ prefix: "/todos" })
  .use(errorHandlerPlugin)
  .decorate("db", createDatabaseClient(env.DATABASE_URL))
  .derive(({ db }) => ({
    todoRepository: new TodoRepository(db),
  }))
  .use(authMacro)
  .get(
    "/",
    async ({ user, todoRepository, query }) => {
      const result = await listTodos({
        repo: todoRepository,
        userId: user.id,
        pagination: query,
      });
      if (result.error) throw result.error;
      return {
        data: result.data.data,
        error: null,
        meta: { pagination: result.data.meta },
      };
    },
    { query: paginationQuerySchema, isAuth: true },
  )
  .get(
    "/:id",
    async ({ user, todoRepository, params }) => {
      const todo = await todoRepository.findById(params.id, user.id);
      if (!todo) {
        throw new NotFoundError("Todo");
      }
      return successBody(todo);
    },
    { isAuth: true },
  )
  .post(
    "/",
    async ({ user, todoRepository, body }) => {
      // console.log("body => ", await body);
      // console.log("body.title => ", body.title);
      // console.log("title => ", title);
      // console.log("user => ", user);
      console.log("body => ", body);
      console.log("body.title => ", body.title);
      const bodyData = await body;
      console.log("bodyData => ", bodyData);
      const title = bodyData.title;
      console.log("title => ", title);
      const todo = await todoRepository.create({ title: title, userId: user.id });
      return createdBody(todo);
    },
    {
      // body: createTodoSchema,
      // body: z.object({
      //   title: z.string().min(1, "Title is required").max(500),
      // }),
      body: t.Object({ title: t.String() }),
      isAuth: true,
    },
  )
  .put(
    "/:id",
    async ({ user, todoRepository, params, body }) => {
      const todo = await todoRepository.update(params.id, user.id, body);
      if (!todo) {
        throw new NotFoundError("Todo");
      }
      return successBody(todo);
    },
    { body: updateTodoSchema, isAuth: true },
  )
  .delete(
    "/:id",
    async ({ user, todoRepository, params }) => {
      const deleted = await todoRepository.delete(params.id, user.id);
      if (!deleted) {
        throw new NotFoundError("Todo");
      }
      return successBody({ success: true });
    },
    { isAuth: true },
  );
