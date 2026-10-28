import { describe, expect, it, vi } from "vitest";
import { executeQuery, MAX_HISTORY_POINTS } from "@/lib/graphql/schema";
import { GraphQLRequestError, gql } from "@/lib/graphql-client";
import { INSTRUMENTS } from "@/lib/simulator";

const NOW = Date.UTC(2026, 9, 28, 4, 0, 0);

describe("GraphQL schema", () => {
  it("lists every instrument", async () => {
    const res = await executeQuery("{ instruments { id name status value unit } }", {}, NOW);
    expect(res.errors).toBeUndefined();
    const data = res.data as { instruments: { id: string; status: string }[] };
    expect(data.instruments).toHaveLength(INSTRUMENTS.length);
    expect(["OK", "WARNING", "FAULT", "UNKNOWN"]).toContain(data.instruments[0].status);
  });

  it("fetches one instrument by id, and null for an unknown id", async () => {
    const ok = await executeQuery(
      "query($id: ID!) { instrument(id: $id) { id name warnHigh } }",
      { id: INSTRUMENTS[0].id },
      NOW,
    );
    expect((ok.data as { instrument: { id: string } }).instrument.id).toBe(INSTRUMENTS[0].id);

    const missing = await executeQuery(
      "query($id: ID!) { instrument(id: $id) { id } }",
      { id: "nope" },
      NOW,
    );
    expect(missing.errors).toBeUndefined();
    expect((missing.data as { instrument: unknown }).instrument).toBeNull();
  });

  it("returns null for limits an instrument does not define", async () => {
    const res = await executeQuery(
      "query($id: ID!) { instrument(id: $id) { warnLow faultLow warnHigh } }",
      { id: "rx-lna-temp" },
      NOW,
    );
    const inst = (res.data as { instrument: { warnLow: number | null; warnHigh: number | null } })
      .instrument;
    expect(inst.warnLow).toBeNull();
    expect(inst.warnHigh).not.toBeNull();
  });

  it("returns history with the requested number of points", async () => {
    const res = await executeQuery(
      "query($id: ID!) { history(id: $id, points: 12, stepSeconds: 5) { t value } }",
      { id: INSTRUMENTS[0].id },
      NOW,
    );
    expect((res.data as { history: unknown[] }).history).toHaveLength(12);
  });

  it("rejects an unknown history id and out-of-range arguments", async () => {
    const unknown = await executeQuery('{ history(id: "nope") { t } }', {}, NOW);
    expect(unknown.errors?.[0].message).toMatch(/Unknown instrument/);

    const tooMany = await executeQuery(
      `{ history(id: "rx-gain", points: ${MAX_HISTORY_POINTS + 1}) { t } }`,
      {},
      NOW,
    );
    expect(tooMany.errors?.[0].message).toMatch(/points must be between/);

    const badStep = await executeQuery('{ history(id: "rx-gain", stepSeconds: 0) { t } }', {}, NOW);
    expect(badStep.errors?.[0].message).toMatch(/stepSeconds/);
  });

  it("reports invalid queries as GraphQL errors", async () => {
    const res = await executeQuery("{ notAField }", {}, NOW);
    expect(res.errors?.length).toBeGreaterThan(0);
  });
});

describe("gql client", () => {
  const jsonResponse = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

  it("returns data on success and posts the query and variables", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ data: { hello: "world" } }));
    const data = await gql<{ hello: string }>("{ hello }", { a: 1 }, fetchMock as typeof fetch);
    expect(data.hello).toBe("world");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/graphql");
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({
      query: "{ hello }",
      variables: { a: 1 },
    });
  });

  it("throws GraphQLRequestError on GraphQL errors", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ errors: [{ message: "boom" }, { message: "bang" }] }));
    await expect(gql("{ x }", {}, fetchMock as typeof fetch)).rejects.toThrow("boom; bang");
  });

  it("throws GraphQLRequestError on a network failure", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("fetch failed"));
    const err = (await gql("{ x }", {}, fetchMock as typeof fetch).catch((e: unknown) => e)) as Error;
    expect(err).toBeInstanceOf(GraphQLRequestError);
    expect(err.message).toMatch(/Network error/);
  });

  it("throws on a non-JSON response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("<html>502</html>", { status: 502 }));
    await expect(gql("{ x }", {}, fetchMock as typeof fetch)).rejects.toThrow(/HTTP 502/);
  });

  it("throws on an HTTP error without data", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({}, 500));
    await expect(gql("{ x }", {}, fetchMock as typeof fetch)).rejects.toThrow(/HTTP 500/);
  });
});
