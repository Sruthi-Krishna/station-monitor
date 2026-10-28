import { buildSchema, graphql, type ExecutionResult } from "graphql";
import { findInstrument, history, snapshot, snapshotAll, type InstrumentSnapshot } from "../simulator";

export const typeDefs = /* GraphQL */ `
  enum Status {
    OK
    WARNING
    FAULT
    UNKNOWN
  }

  type Instrument {
    id: ID!
    name: String!
    subsystem: String!
    unit: String!
    value: Float!
    status: Status!
    warnLow: Float
    warnHigh: Float
    faultLow: Float
    faultHigh: Float
    updatedAt: String!
  }

  type Reading {
    t: String!
    value: Float!
  }

  type Query {
    instruments: [Instrument!]!
    instrument(id: ID!): Instrument
    history(id: ID!, points: Int = 30, stepSeconds: Int = 10): [Reading!]!
  }
`;

export const schema = buildSchema(typeDefs);

export const MAX_HISTORY_POINTS = 500;

interface Context {
  now: number;
}

function toGraph(s: InstrumentSnapshot) {
  return {
    id: s.id,
    name: s.name,
    subsystem: s.subsystem,
    unit: s.unit,
    value: s.value,
    status: s.status,
    warnLow: s.limits.warnLow ?? null,
    warnHigh: s.limits.warnHigh ?? null,
    faultLow: s.limits.faultLow ?? null,
    faultHigh: s.limits.faultHigh ?? null,
    updatedAt: new Date(s.updatedAt).toISOString(),
  };
}

export const rootValue = {
  instruments: (_args: unknown, ctx: Context) => snapshotAll(ctx.now).map(toGraph),

  instrument: ({ id }: { id: string }, ctx: Context) => {
    const def = findInstrument(id);
    return def ? toGraph(snapshot(def, ctx.now)) : null;
  },

  history: (
    { id, points, stepSeconds }: { id: string; points: number; stepSeconds: number },
    ctx: Context,
  ) => {
    const def = findInstrument(id);
    if (!def) throw new Error(`Unknown instrument: ${id}`);
    if (points < 1 || points > MAX_HISTORY_POINTS) {
      throw new Error(`points must be between 1 and ${MAX_HISTORY_POINTS}`);
    }
    if (stepSeconds < 1 || stepSeconds > 3600) {
      throw new Error("stepSeconds must be between 1 and 3600");
    }
    return history(def, ctx.now, points, stepSeconds).map((r) => ({
      t: new Date(r.t).toISOString(),
      value: r.value,
    }));
  },
};

/**
 * Run a GraphQL operation against the simulated instruments.
 * `now` is injected so tests are deterministic.
 */
export async function executeQuery(
  query: string,
  variables: Record<string, unknown> = {},
  now: number = Date.now(),
): Promise<ExecutionResult> {
  return graphql({
    schema,
    source: query,
    rootValue,
    contextValue: { now } satisfies Context,
    variableValues: variables,
  });
}
