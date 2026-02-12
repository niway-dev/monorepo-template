import { treaty } from "@elysiajs/eden";
import type { App } from "../../../server/src/index";
import { env } from "@/env/client";

export const clientTreaty = treaty<App>(env.VITE_SERVER_URL, {
  fetch: {
    credentials: "include", // Important for auth cookies to work
  },
});
