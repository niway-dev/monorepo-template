import { infisicalProvider } from "./infisical";
import type { EnvProvider } from "./types";

/** Every provider `env:pull` can use. Write the provider's file, then add it here. */
export const providers: Record<string, (root: string) => EnvProvider> = {
  infisical: infisicalProvider,
};
