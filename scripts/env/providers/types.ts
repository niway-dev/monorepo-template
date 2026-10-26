/**
 * A source of environment values. `bun run env:pull` only talks to this interface;
 * adding a provider means one file in this folder plus one line in ./index.ts.
 *
 * Implementations must never print a value: their output lands in terminals and logs.
 */
export type EnvProvider = {
  name: string;
  /** Fail fast with a message naming the fix (CLI missing, not logged in, not linked). */
  check(): Promise<void>;
  /** Every value the given consumer may read in the given environment. */
  fetch(request: { environment: string; consumer: string }): Promise<Record<string, string>>;
};

/** An expected failure whose message already tells the user what to do. */
export class ProviderError extends Error {}
