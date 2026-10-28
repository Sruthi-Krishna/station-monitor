export class GraphQLRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GraphQLRequestError";
  }
}

type FetchLike = typeof fetch;

/**
 * Minimal GraphQL-over-HTTP client. Throws GraphQLRequestError for network
 * failures, non-2xx responses and GraphQL `errors`, so callers handle one type.
 */
export async function gql<T>(
  query: string,
  variables: Record<string, unknown> = {},
  fetchImpl: FetchLike = fetch,
  endpoint = "/api/graphql",
): Promise<T> {
  let response: Response;
  try {
    response = await fetchImpl(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables }),
      cache: "no-store",
    });
  } catch {
    throw new GraphQLRequestError("Network error: could not reach the API");
  }

  let payload: { data?: T; errors?: { message: string }[] };
  try {
    payload = await response.json();
  } catch {
    throw new GraphQLRequestError(`Bad response from API (HTTP ${response.status})`);
  }

  if (payload.errors && payload.errors.length > 0) {
    throw new GraphQLRequestError(payload.errors.map((e) => e.message).join("; "));
  }
  if (!response.ok || payload.data === undefined) {
    throw new GraphQLRequestError(`API request failed (HTTP ${response.status})`);
  }
  return payload.data;
}

export const INSTRUMENTS_QUERY = /* GraphQL */ `
  query Instruments {
    instruments {
      id
      name
      subsystem
      unit
      value
      status
      warnLow
      warnHigh
      faultLow
      faultHigh
      updatedAt
    }
  }
`;

export const HISTORY_QUERY = /* GraphQL */ `
  query History($id: ID!, $points: Int, $stepSeconds: Int) {
    history(id: $id, points: $points, stepSeconds: $stepSeconds) {
      t
      value
    }
  }
`;
