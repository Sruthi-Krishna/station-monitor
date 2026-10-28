# Station Monitor

[![CI](https://github.com/Sruthi-Krishna/station-monitor/actions/workflows/ci.yml/badge.svg)](https://github.com/Sruthi-Krishna/station-monitor/actions/workflows/ci.yml)

A small monitoring dashboard for a set of **simulated** instruments, built with Next.js, TypeScript and GraphQL. It is a demonstration project: the data is synthetic and it is not connected to any real system.

It shows the kind of interface used to watch equipment: live readings, alarm states, filtering, and a trend for any instrument you select.

<!-- Add a screenshot here: docs/screenshot.png -->

## Features

- Live table of 12 instruments across five subsystems, refreshed every 3 seconds
- Alarm states (OK, Warning, Fault, No data) with a banner summarising the worst case
- Search, status filter and sort (severity, name, subsystem)
- Click an instrument to see a trend chart with its warning and fault limits
- Keeps showing the last good data and says so when the connection drops
- Accessible by design: status is never colour alone, the table has proper headers, alerts use ARIA roles, and controls are keyboard operable

## Run it

Requires Node.js 20 or newer.

```bash
npm install
npm run dev        # http://localhost:3000
```

```bash
npm run lint         # ESLint
npm run typecheck    # TypeScript
npm test             # unit and component tests (Vitest)
npm run test:e2e     # end-to-end tests (Playwright); first run: npx playwright install chromium
npm run build && npm start
```

### Docker

```bash
docker build -t station-monitor .
docker run --rm -p 3000:3000 station-monitor
```

The image is multi-stage and runs the Next.js standalone server as a non-root user.

## How it works

```
Browser (React client)
   │  POST /api/graphql  every 3 s
   ▼
Next.js route handler  ──►  GraphQL schema (graphql-js)  ──►  Simulator (pure functions)
                                                              └─ Alarm logic (pure functions)
```

| Path | Responsibility |
| --- | --- |
| `lib/alarms.ts` | Classifies a reading against its limits. No UI, no I/O |
| `lib/simulator.ts` | Generates readings as a pure function of instrument and time |
| `lib/graphql/schema.ts` | GraphQL schema and resolvers; `executeQuery` is testable without HTTP |
| `app/api/graphql/route.ts` | Thin HTTP wrapper: validates input, runs the query |
| `lib/graphql-client.ts` | Small typed client with one error type for network, HTTP and GraphQL failures |
| `lib/filter.ts` | Search, filter and sort, as pure functions |
| `components/` | Presentational components plus the `Dashboard` container |

### Design decisions

- **Alarm logic is separate from the UI.** It is the part that matters most to an operator, so it is a small pure module with the heaviest tests, including boundary values.
- **Limits are inclusive.** A reading exactly on a limit trips it. Fail towards the alarm.
- **Missing data is "No data", never OK.** A silent sensor should not look healthy.
- **The simulator is stateless.** Each reading is computed from the instrument and the clock, so there is no database, no in-memory state to lose, and the API behaves the same on a laptop, in Docker, or on a serverless host.
- **Stale data is kept, and labelled.** If a poll fails, the table stays on screen with a warning, rather than blanking out.
- **No chart library.** The trend is about 60 lines of SVG, which keeps the bundle small and the behaviour easy to test.
- **Plain `graphql-js`, no server framework.** The API is one route handler, which is enough here.

## Testing

| Layer | Tool | What it covers |
| --- | --- | --- |
| Unit | Vitest | Alarm boundaries, simulator determinism and bounds, filtering and sorting, GraphQL schema and argument validation, client error handling |
| Component | Vitest + React Testing Library | Badge, banner, table, trend chart, and the dashboard's loading, error, retry and stale-data behaviour |
| End to end | Playwright | Page load, search, trend selection, live updates, and the GraphQL endpoint including error responses |

GitHub Actions (`.github/workflows/ci.yml`) runs lint, typecheck, unit tests and build on every push and pull request, then the Playwright tests and a Docker build.

## Limitations

- Data is synthetic. Nothing here talks to real hardware.
- Polling, not streaming. Real-time subscriptions (GraphQL subscriptions or WebSockets) would be the next step for genuinely live data.
- No authentication or persistence; history is recomputed rather than stored.
- 12 instruments. A real system would need virtualised lists and server-side filtering at much larger scale.

## Deploying

Any host that runs Node works. Vercel needs no configuration for a Next.js app. Cloudflare is possible through the OpenNext adapter; see the current Cloudflare guide for Next.js.
