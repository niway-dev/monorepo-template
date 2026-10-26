# Hiring Tool Server

## Setup

```
bun install
```

Local values come from the secrets provider; `env:pull` writes this app's `.env` (never edit it
by hand, and never create a `.dev.vars`: Wrangler would read it instead of `.env`).

```
bun run env:pull   # from the repo root
```

To deploy to Cloudflare Workers from a local machine, set the Worker secrets:

```
wrangler secret put DATABASE_URL
wrangler secret put BETTER_AUTH_SECRET
wrangler secret put CORS_ORIGIN
```

`CORS_ORIGIN` is the comma-separated list of origins Better Auth trusts; include the web origin.
Leave `BETTER_AUTH_URL` unset; only for OAuth, set it to the **web** origin, never the API's.

## Run the server

```
bun run dev
```

## Deploy the server

```
bun run deploy
```
