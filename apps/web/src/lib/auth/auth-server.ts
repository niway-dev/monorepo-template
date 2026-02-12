import { betterAuth } from "better-auth";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { baseConfig } from "@monorepo-template/infra-auth";
import { env } from "@/env/server";

export const auth = betterAuth({
  ...baseConfig,
  trustedOrigins: [...env.CORS_ORIGIN],
  plugins: [...(baseConfig.plugins ?? []), tanstackStartCookies()],
});
