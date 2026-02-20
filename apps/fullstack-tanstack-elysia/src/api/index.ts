import { Elysia, t } from "elysia";
import { todoRoutes } from "./routes/todos";
// import { CloudflareAdapter } from "elysia/adapter/cloudflare-worker";

export const app = new Elysia({
  prefix: "/api/v1",
  // aot: false,
})
  .use(todoRoutes)
  .post(
    "/test",
    ({ body }) => {
      console.log("body => ", body);
      return {
        message: "Hello, world!",
      };
    },
    {
      body: t.Object({ title: t.String() }),
    },
  )
  .get("/health", () => ({
    status: "healthy",
    timestamp: new Date().toISOString(),
  }));

export type App = typeof app;
