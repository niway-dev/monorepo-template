import { createFileRoute } from "@tanstack/react-router";
import { app } from "@/api";

const handle = async ({ request }: { request: Request }) => {
  console.log("handle request => ----");
  const response = await app.fetch(request);
  const body = await response.clone().text();
  console.log("body => ", { body });
  if (!response.ok) {
    const body = await response.clone().text();
    console.error("[Elysia]", request.method, request.url, response.status, body);
  }
  return response;
};

// const handle = ({ request }: { request: Request }) => app.fetch(request);

export const Route = createFileRoute("/api/v1/$")({
  server: {
    handlers: {
      GET: handle,
      POST: handle,
      PUT: handle,
      DELETE: handle,
      PATCH: handle,
    },
  },
});
