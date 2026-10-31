# PR Blast-Radius & Safety Copilot

A deterministic fixture demo: Daytona runs an intentionally unsafe PR in an isolated JavaScript sandbox, Neo4j traces transitive dependents, and Nosana writes the merge-risk report.

## Setup

1. Install dependencies with `npm install`.
2. Start Neo4j using `docker compose up -d`, or set the Neo4j connection fields for an existing database.
3. Copy `.env.example` to `.env`. Add a Daytona API key, a Nosana API key with `inference:use`, and a currently served model ID from `https://inference.nosana.com/v1/models`.
4. Seed the isolated fixture graph with `npm run seed:graph`.
5. Run `npm run demo`.

For the live presentation, run `npm run ui` and open `http://127.0.0.1:4173`. The page starts the same console pipeline and renders its result; credentials remain on the local server.

`npm run verify:daytona` creates and deletes a temporary Daytona sandbox, uploads the fixture, and confirms the crafted PR fails its test suite. It needs a valid Daytona key but not the Neo4j or Nosana settings.

The demo uploads only `fixture/` (five source, manifest, and test files plus the fixed PR patch) to Daytona. It does not clone a live repository or use GitHub credentials. The graph seed is separate from the live run. Daytona sandboxes are deleted afterward.

## Walkthrough

1. `fixture/pr.diff` changes `canApprove` so every non-guest role can approve.
2. The fixture test suite catches that contributors now pass the approval gate. Daytona runs the patched fixture and returns the real test output.
3. Neo4j follows `DEPENDS_ON` from `src/permissions.js` to `src/approval.js` and `src/release.js`.
4. Nosana receives the diff, actual sandbox test result, and graph result, then returns a short recommendation.

The test is expected to fail. That failure is the evidence that the sample PR should not be merged.

The UI shows an unavailable-sandbox error if Daytona cannot start, an explicit empty-graph state if Neo4j finds no dependents, and a clearly labeled no-verdict fallback if Nosana inference fails.

## Integration requirements

- Daytona requires an API key in `DAYTONA_API_KEY`. The isolated fixture run has been verified.
- Neo4j requires a reachable database. The graph is scoped to the `hacksprint-t1-demo` repository key so seeding leaves unrelated data alone.
- Nosana requires an API key with `inference:use` and a model that is currently serving. This demo uses the OpenAI-compatible inference API; inference calls use account credits.

No secrets belong in source control. Keep credentials in the ignored `.env` file.

## References

- Daytona TypeScript SDK: https://www.daytona.io/docs/en/typescript-sdk/
- Neo4j JavaScript driver: https://neo4j.com/docs/javascript-manual/current/
- Nosana Builders challenge endpoint configuration: https://github.com/nosana-ci/agent-challenge
