import { createFileRoute } from "@tanstack/react-router";
import { handleShortLink } from "#/lib/short-link";

export const Route = createFileRoute("/api/shorten")({
  server: { handlers: { POST: ({ request }) => handleShortLink(request) } },
});
