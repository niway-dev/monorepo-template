import { createIsomorphicFn } from "@tanstack/react-start";
import { treaty } from "@elysiajs/eden";
import type { App } from "@/api";
import { app } from "@/api";

export const getTreaty = createIsomorphicFn()
  .server(() => treaty(app).api.v1)
  .client(() => treaty<App>(window.location.origin).api.v1);
