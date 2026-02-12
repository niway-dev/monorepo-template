import { Elysia } from "elysia";
import { todoRoutes } from "./routes/todos";
// import { CloudflareAdapter } from "elysia/adapter/cloudflare-worker";

export const app = new Elysia({
  prefix: "/api/v1",
})
  .use(todoRoutes)
  .get("/health", () => ({
    status: "healthy",
    timestamp: new Date().toISOString(),
  }));

export type App = typeof app;
