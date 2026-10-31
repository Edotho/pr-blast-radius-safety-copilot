# Live demo instructions

## Start

1. Confirm `.env` has valid Daytona, Neo4j, and Nosana settings.
2. Seed the graph once with `npm run seed:graph` if it has not already been seeded.
3. Start the page with `npm run ui`.
4. Open `http://127.0.0.1:4173` in a browser.

## Walkthrough

1. Point out the fixed PR: it changes `src/permissions.js` from an owner/admin allowlist to allowing every non-guest role.
2. Click **Run safety review**. The three status chips show Daytona, Neo4j, and Nosana progress.
3. Show the test status: the deliberately unsafe patch should fail the contributor approval test.
4. Show the graph: `src/approval.js` depends on the changed permissions module, and `src/release.js` depends on approval.
5. Read the Nosana merge-risk report and its recommendation. The expected verdict is do not merge.

## Failure states

- If Daytona cannot start, its chip shows unavailable, later steps remain unrun, and the report panel says no recommendation was generated.
- If Neo4j returns no dependents, the page calls out the empty result and still displays the report based on that graph result.
- If Nosana inference fails after the checks, the page labels the text as a local fallback and states that it is not a model verdict.

The page binds to `127.0.0.1` by default. It runs the existing `demo.mjs` process, so the terminal remains available for live logs. The expected test failure is successful evidence for this fixture, not a demo setup failure.
