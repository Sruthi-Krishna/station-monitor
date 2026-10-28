import { executeQuery } from "@/lib/graphql/schema";

// Readings depend on the current time, so this must never be cached.
export const dynamic = "force-dynamic";

const MAX_QUERY_LENGTH = 4000;

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ errors: [{ message: "Request body must be JSON" }] }, { status: 400 });
  }

  const { query, variables } = (body ?? {}) as { query?: unknown; variables?: unknown };

  if (typeof query !== "string" || query.trim() === "") {
    return Response.json({ errors: [{ message: "Missing 'query' string" }] }, { status: 400 });
  }
  if (query.length > MAX_QUERY_LENGTH) {
    return Response.json({ errors: [{ message: "Query too long" }] }, { status: 413 });
  }

  const vars =
    variables && typeof variables === "object" ? (variables as Record<string, unknown>) : {};

  const result = await executeQuery(query, vars, Date.now());
  return Response.json(result, { headers: { "Cache-Control": "no-store" } });
}

export async function GET() {
  return Response.json({
    message: "Station Monitor GraphQL endpoint. Send a POST with { query, variables }.",
  });
}
